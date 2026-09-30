/**
 * The baked map assets.
 *
 * A mistake in the centroid format is the worst kind of bug here: the map would
 * render, look plausible, and place homes in the wrong states. These tests
 * therefore pin the packer against the decoder, and check the committed asset
 * against the country it is supposed to describe.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { decodeCentroids, encodeCentroids, type ZctaPoint } from './centroids'
import { buildBins, binFor, MAP_METRICS, RAMP } from './scale'
import { hexbin } from './binning'
import { clampScale, createView, fitBase, type Basemap } from './projection'

const ROOT = join(__dirname, '..', '..', '..')
const BIN = join(ROOT, 'public', 'map', 'zcta-centroids.bin')
const STATES = join(ROOT, 'public', 'map', 'us-states.json')

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('the centroid format round-trips', () => {
  it('survives a pack and unpack unchanged', () => {
    const points: ZctaPoint[] = [
      { zcta: '00601', lon: -66.1063, lat: 18.4661 },
      { zcta: '78701', lon: -97.7431, lat: 30.2672 },
      { zcta: '99501', lon: -149.9003, lat: 61.2181 },
      { zcta: '99999', lon: 145.7537, lat: -14.28 },
    ]
    const decoded = decodeCentroids(encodeCentroids(points))
    expect(decoded).toHaveLength(points.length)
    // Half a quantisation step is the worst case: 360/65535 of a degree of
    // longitude, and 95/65535 of a degree of latitude. That is about 270 m and
    // 85 m respectively, which is far narrower than the smallest ZIP area, so
    // asserting anything tighter would be asserting an error that does not
    // exist rather than one that does.
    const LON_STEP = 360 / 65535
    const LAT_STEP = 95 / 65535
    for (const original of points) {
      const match = decoded.find((d) => d.zcta === original.zcta)
      expect(match, `no point for ${original.zcta}`).toBeDefined()
      expect(Math.abs(match!.lon - original.lon)).toBeLessThanOrEqual(LON_STEP / 2)
      expect(Math.abs(match!.lat - original.lat)).toBeLessThanOrEqual(LAT_STEP / 2)
    }
  })

  it('keeps codes exact, so a filtered point cannot shift every other ZIP', () => {
    // The bug this guards against: deriving a point's ZIP from its index, which
    // silently mislabels every point after any gap in the sequence.
    const sparse: ZctaPoint[] = [
      { zcta: '16332', lon: -79.3687, lat: 41.3609 },
      { zcta: '99701', lon: -150.6, lat: 64.8 },
    ]
    const decoded = decodeCentroids(encodeCentroids(sparse))
    expect(decoded.map((d) => d.zcta)).toEqual(['16332', '99701'])
  })

  it('reads a truncated file as fewer points rather than throwing', () => {
    const full = encodeCentroids([
      { zcta: '00601', lon: -66.1, lat: 18.4 },
      { zcta: '78701', lon: -97.7, lat: 30.2 },
      { zcta: '99501', lon: -149.9, lat: 61.2 },
    ])
    const decoded = decodeCentroids(full.slice(0, full.byteLength - 4))
    expect(decoded.length).toBeLessThan(3)
  })

  it('treats an empty or absent file as empty, not as an error', () => {
    expect(decodeCentroids(new ArrayBuffer(0))).toEqual([])
    expect(decodeCentroids(new ArrayBuffer(4))).toEqual([])
  })
})

describe('the committed centroid asset describes the real country', () => {
  const points = decodeCentroids(toArrayBuffer(readFileSync(BIN)))

  it('holds every ZCTA the Census publishes', () => {
    expect(points.length).toBe(33791)
  })

  it('has unique, well-formed ZIP codes', () => {
    const seen = new Set(points.map((p) => p.zcta))
    expect(seen.size).toBe(points.length)
    for (const p of points) expect(p.zcta).toMatch(/^\d{5}$/)
  })

  it('places them all in or near the United States and its territories', () => {
    for (const p of points) {
      expect(p.lat, `${p.zcta} latitude`).toBeGreaterThanOrEqual(-20)
      expect(p.lat, `${p.zcta} latitude`).toBeLessThanOrEqual(75)
      expect(p.lon, `${p.zcta} longitude`).toBeGreaterThanOrEqual(-180)
      expect(p.lon, `${p.zcta} longitude`).toBeLessThanOrEqual(180)
    }
  })

  it('gets three check ZIPs into the right states', () => {
    // A handful of places whose coordinates are not in dispute. If a projection
    // or format change moved these, the map is wrong everywhere.
    const at = (zcta: string) => points.find((p) => p.zcta === zcta)
    const austin = at('78701')!
    expect(austin.lat).toBeGreaterThan(29)
    expect(austin.lat).toBeLessThan(32)
    expect(Math.abs(austin.lon + 97.7)).toBeLessThan(1.5)

    const anchorage = at('99501')!
    expect(anchorage.lat).toBeGreaterThan(60)
    expect(anchorage.lon).toBeLessThan(-148)

    const honolulu = at('96813')!
    expect(honolulu.lat).toBeGreaterThan(21)
    expect(honolulu.lat).toBeLessThan(22)
    expect(honolulu.lon).toBeLessThan(-157)
  })
})

describe('the committed basemap', () => {
  interface ParsedGeometry {
    type: string
    coordinates: number[][][] | number[][][][]
  }
  const basemap = JSON.parse(readFileSync(STATES, 'utf8')) as {
    features: {
      properties?: { STUSAB?: string }
      geometry: ParsedGeometry
    }[]
  }

  it('covers the states and territories', () => {
    const codes = new Set(basemap.features.map((f) => f.properties?.STUSAB))
    // 50 states, DC, Puerto Rico and the inhabited territories.
    expect(codes.size).toBeGreaterThanOrEqual(53)
    for (const required of ['CA', 'TX', 'NY', 'FL', 'AK', 'HI', 'PR', 'DC']) {
      expect(codes.has(required), `missing ${required}`).toBe(true)
    }
  })

  it('is drawn as polygons, not as an error payload', () => {
    for (const f of basemap.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type)
    }
  })

  it('has only drawable rings, so the renderer cannot throw', () => {
    // Simplifying an outline can collapse a ring below the four positions
    // GeoJSON requires. d3-geo throws on one of those, which unmounts the
    // whole page rather than just the map, so every ring is checked here.
    const ringsOf = (g: ParsedGeometry): number[][][] => {
      if (g.type === 'Polygon') return g.coordinates as number[][][]
      if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][]).flat()
      return []
    }
    for (const f of basemap.features) {
      const rings = ringsOf(f.geometry)
      expect(rings.length, `${f.properties?.STUSAB} has no ring`).toBeGreaterThan(0)
      for (const ring of rings) {
        expect(ring.length, `${f.properties?.STUSAB} ring too short`).toBeGreaterThanOrEqual(4)
        const first = ring[0]!
        const last = ring[ring.length - 1]!
        expect(first[0], `${f.properties?.STUSAB} ring is not closed`).toBe(last[0])
        expect(first[1], `${f.properties?.STUSAB} ring is not closed`).toBe(last[1])
        for (const pt of ring) {
          expect(Number.isFinite(pt[0]), `${f.properties?.STUSAB} has a bad x`).toBe(true)
          expect(Number.isFinite(pt[1]), `${f.properties?.STUSAB} has a bad y`).toBe(true)
        }
      }
    }
  })

  it('is actually fed to the path renderer without throwing', () => {
    // The end-to-end version of the check above: build the real path and walk
    // every feature through it. This is what the page actually does.
    const view = createView(
      fitBase([]),
      { width: 900, height: 560, scale: 1, offsetX: 0, offsetY: 0 },
      basemap as unknown as Basemap,
    )
    const commands: string[] = []
    const ctx = {
      save: () => commands.push('save'),
      restore: () => commands.push('restore'),
      transform: () => commands.push('transform'),
      beginPath: () => commands.push('beginPath'),
      closePath: () => commands.push('closePath'),
      moveTo: () => commands.push('moveTo'),
      lineTo: () => commands.push('lineTo'),
      stroke: () => commands.push('stroke'),
      fill: () => commands.push('fill'),
    } as unknown as CanvasRenderingContext2D
    expect(() => view.outlines()(ctx), 'the path renderer threw on the real basemap').not.toThrow()
    expect(commands.length, 'the path renderer drew nothing').toBeGreaterThan(0)
  })
})

describe('the colour scale', () => {
  it('produces one bin per ramp step with real boundaries', () => {
    const values = Array.from({ length: 1000 }, (_, i) => i + 1)
    const bins = buildBins(values)
    expect(bins).toHaveLength(RAMP.length)
    expect(bins[0]!.from).toBe(1)
    expect(bins[bins.length - 1]!.to).toBeNull()
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i]!.from).toBeGreaterThanOrEqual(bins[i - 1]!.from)
    }
  })

  it('assigns every real value to exactly one bin', () => {
    const values = Array.from({ length: 5000 }, (_, i) => (i * 7919) % 4800)
    const bins = buildBins(values)
    for (const v of [0, 1, 25, 2400, 4799]) {
      expect(binFor(bins, v), `no bin for ${v}`).not.toBeNull()
    }
  })

  it('never assigns a bin to a missing or impossible value', () => {
    const bins = buildBins([10, 20, 30, 40])
    expect(binFor(bins, null)).toBeNull()
    expect(binFor(bins, undefined)).toBeNull()
    expect(binFor(bins, Number.NaN)).toBeNull()
    expect(binFor(bins, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('shows every figure the sweep can actually supply', () => {
    // A metric that the sweep never fetches would render an empty map while
    // looking broken, so the two lists are pinned together.
    expect(MAP_METRICS.map((m) => m.key).sort()).toEqual(
      [
        'households',
        'median_gross_rent',
        'median_home_value',
        'median_household_income',
        'median_rent_burden_pct',
      ].sort(),
    )
  })
})

describe('the projection', () => {
  const points = [
    { zcta: '78701', lon: -97.7431, lat: 30.2672 },
    { zcta: '10001', lon: -74.006, lat: 40.7128 },
    { zcta: '99501', lon: -149.9003, lat: 61.2181 },
    { zcta: '96813', lon: -157.8583, lat: 21.3069 },
    { zcta: '00601', lon: -66.1063, lat: 18.4661 },
  ]

  it('places every point on the canvas, whatever the canvas size', () => {
    // A fresh d3 projection clips to 960x500. Anything wider silently dropped
    // points, so the map rendered blank on a common screen size while every
    // unit test still passed.
    for (const [w, h] of [
      [900, 560],
      [1248, 614],
      [1600, 900],
      [320, 240],
    ] as const) {
      const view = createView(fitBase(points), { width: w, height: h, scale: 1, offsetX: 0, offsetY: 0 }, null)
      for (const p of points) {
        const at = view.project(p.lon, p.lat)
        expect(at, `${p.zcta} dropped at ${w}x${h}`).not.toBeNull()
        expect(at![0]).toBeGreaterThan(-w)
        expect(at![0]).toBeLessThan(w * 2)
        expect(at![1]).toBeGreaterThan(-h)
        expect(at![1]).toBeLessThan(h * 2)
      }
    }
  })

  it('includes Puerto Rico, which d3 albersUsa clips out', () => {
    // Roughly 150 ZIP codes live in Puerto Rico. A projection of San Juan
    // returns null under albersUsa, so without an inset of its own they vanish
    // from the map while still being listed in the table.
    const view = createView(fitBase(points), { width: 900, height: 560, scale: 1, offsetX: 0, offsetY: 0 }, null)
    const sanJuan = view.project(-66.1063, 18.4661)
    expect(sanJuan, 'Puerto Rico was dropped from the map').not.toBeNull()
    // It must land in the inset, away from the mainland, or it would be drawn
    // in the Gulf.
    const austin = view.project(-97.7431, 30.2672)!
    expect(Math.abs(sanJuan![0] - austin[0]) + Math.abs(sanJuan![1] - austin[1])).toBeGreaterThan(50)
  })

  it('keeps the mainland and the Alaska and Hawaii insets apart', () => {
    // geoAlbersUsa draws AK and HI as inset boxes. If a change dropped that,
    // they would sit thousands of miles from the mainland and the map would be
    // geographically wrong in a way no arithmetic test would describe.
    const view = createView(fitBase(points), { width: 900, height: 560, scale: 1, offsetX: 0, offsetY: 0 }, null)
    const austin = view.project(-97.7431, 30.2672)!
    const anchorage = view.project(-149.9003, 61.2181)!
    const honolulu = view.project(-157.8583, 21.3069)!
    expect(anchorage[0], 'Alaska should be inset west of the mainland').toBeLessThan(austin[0])
    expect(honolulu[0], 'Hawaii should be inset west of the mainland').toBeLessThan(austin[0])
  })

  it('moves points and outlines together as the viewport changes', () => {
    // If zoom were applied to the points but not the basemap, the outlines
    // would slide out from under the data at the first zoom.
    const before = createView(fitBase(points), { width: 900, height: 560, scale: 1, offsetX: 0, offsetY: 0 }, null)
    const after = createView(fitBase(points), { width: 900, height: 560, scale: 3, offsetX: 40, offsetY: 20 }, null)
    const a = before.project(-97.7431, 30.2672)!
    const b = after.project(-97.7431, 30.2672)!
    expect(b[0]).not.toBeCloseTo(a[0], 3)
    expect(b[1]).not.toBeCloseTo(a[1], 3)
  })

  it('returns nothing for a coordinate it cannot place', () => {
    const view = createView(fitBase(points), { width: 900, height: 560, scale: 1, offsetX: 0, offsetY: 0 }, null)
    // Null rather than (0, 0), so a corrupt coordinate cannot be mistaken for
    // a real place at the map's origin.
    expect(view.project(0, 0)).toBeNull()
  })
})

describe('hexbinning', () => {
  it('groups nearby points and reports the median, not the mean', () => {
    // 1 and 2 sit together; 1000 alone. A mean over the group would be ~334,
    // which would misstate a neighbourhood dominated by two ordinary homes.
    const bins = hexbin([
      { x: 10, y: 10, value: 1, zctas: ['00001'] },
      { x: 11, y: 10, value: 2, zctas: ['00002'] },
      { x: 400, y: 400, value: 1000, zctas: ['00003'] },
    ])
    const small = bins.find((b) => b.zctas.includes('00001'))!
    expect(small.count).toBe(2)
    expect(small.value).toBe(1.5)
    expect(bins.find((b) => b.zctas.includes('00003'))!.value).toBe(1000)
  })

  it('keeps a group whose members all lack a figure', () => {
    // Dropping it would make "no data" and "not there" indistinguishable, which
    // is exactly the confusion this app exists to avoid.
    const bins = hexbin([{ x: 10, y: 10, value: Number.NaN, zctas: ['00001'] }])
    expect(bins).toHaveLength(1)
    expect(bins[0]!.value).toBeNull()
  })

  it('reports a median once half the group has figures, and not before', () => {
    // Requiring every ZIP to have a figure greyed roughly six cells in seven,
    // because a hexagon holds about eighteen ZIP codes and one gap was enough.
    // Requiring none would let a single rural ZIP speak for twenty neighbours.
    const four = (values: number[]) =>
      hexbin([
        { x: 10, y: 10, value: values[0]!, zctas: ['00001'] },
        { x: 11, y: 10, value: values[1]!, zctas: ['00002'] },
        { x: 12, y: 10, value: values[2]!, zctas: ['00003'] },
        { x: 13, y: 10, value: values[3]!, zctas: ['00004'] },
      ])[0]!

    const half = four([10, 20, Number.NaN, Number.NaN])
    expect(half.value, 'exactly half should be enough').not.toBeNull()
    expect(half.value).toBe(15)
    expect(half.withValue).toBe(2)
    expect(half.count).toBe(4)

    const under = four([10, Number.NaN, Number.NaN, Number.NaN])
    expect(under.value, 'a quarter should not be enough').toBeNull()
    expect(under.withValue).toBe(1)
    // The count of what was missing is still reported, so the cell is auditable.
    expect(under.count).toBe(4)
  })

  it('assigns every ZIP to exactly one hexagon', () => {
    const inputs = Array.from({ length: 500 }, (_, i) => ({
      x: (i % 25) * 9,
      y: Math.floor(i / 25) * 9,
      value: i,
      zctas: [String(i).padStart(5, '0')],
    }))
    const seen = hexbin(inputs).flatMap((b) => b.zctas)
    expect(seen).toHaveLength(500)
    expect(new Set(seen).size).toBe(500)
  })
})

describe('zoom bounds', () => {
  it('clamps so the map cannot be zoomed into an unreadable block or out of frame', () => {
    expect(clampScale(0.01)).toBe(1)
    expect(clampScale(1)).toBe(1)
    expect(clampScale(4)).toBe(4)
    expect(clampScale(10000)).toBeLessThanOrEqual(60)
  })
})
