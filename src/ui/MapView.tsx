/** The state the map opens in, and the target every reset returns to. */
const INITIAL_VIEWPORT: Viewport = { width: 900, height: 560, scale: 1, offsetX: 0, offsetY: 0 }

/** Below this zoom, hexagons are too small and too many to letter. */
const LABEL_MIN_SCALE = 2.6
/** Labels are pointless in a hexagon smaller than this. */
const LABEL_MIN_RADIUS = 11

/**
 * The map view.
 *
 * Canvas 2D, no tile server, no map framework. That is a deliberate choice
 * rather than a simplification: a tile-based map would mean a third-party origin
 * in the Content-Security-Policy, a runtime dependency on someone else's
 * uptime, and a request log for every visitor. All this needs is 33,791
 * positions the app already has numbers for, and those are baked into a
 * 165 KB file served from the same origin.
 *
 * Accessibility drives one thing above all: a canvas is invisible to a screen
 * reader. So the map is presented as a *visual* view of the same data, with the
 * screening table remaining the accessible path to every figure, and the legend
 * spelled out in text rather than in colour swatches alone. Nothing on this
 * surface can be the only way to reach a number.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { hexbin, hexRadius, HEX_CORNERS, type BinInput } from '../core/map/binning'
import { loadMapAssets, createView, fitBase, zoomAround, type Basemap, type Viewport } from '../core/map/projection'
import type { ZctaPoint } from '../core/map/centroids'
import {
  buildBins,
  binFor,
  formatValue,
  MAP_METRICS,
  NO_DATA_COLOR,
  NO_DATA_LABEL,
  type MapMetricKey,
} from '../core/map/scale'
import type { AreaRow } from '../core/plugins/acs'
import { FairHousingNotice } from './FairHousingNotice'

interface Props {
  rows: readonly AreaRow[]
  onSelect: (zctas: string[]) => void
  /** Areas already in the comparison set, outlined on the map. */
  selectedZctas: readonly string[]
}

interface Hover {
  cx: number
  cy: number
  value: number | null
  count: number
  withValue: number
  zctas: string[]
}

export function MapView({ rows, onSelect, selectedZctas }: Props) {
  const headingId = useId()
  const legendId = useId()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  // Pointer and touch state for panning. Held in a ref rather than React state
  // so a drag never triggers a render; only the resulting viewport does.
  const drag = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null)
  const dragged = useRef(false)

  const [metric, setMetric] = useState<MapMetricKey>('median_rent_burden_pct')
  const [assets, setAssets] = useState<{ centroids: ZctaPoint[]; basemap: Basemap | null } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT)

  const unit = useMemo(
    () => MAP_METRICS.find((m) => m.key === metric)?.unit ?? 'usd',
    [metric],
  )

  // Values by ZIP, so a point and its figure are looked up the same way.
  const valueByZcta = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const row of rows) m.set(row.zcta, row.metrics[metric] ?? null)
    return m
  }, [rows, metric])

  const bins = useMemo(
    () => buildBins([...valueByZcta.values()].filter((v): v is number => v !== null)),
    [valueByZcta],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadMapAssets(controller.signal)
      .then(setAssets)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLoadError(err instanceof Error ? err.message : 'the map could not be loaded')
      })
    return () => controller.abort()
  }, [])

  // Keep the backing store matched to the CSS box, so the map is not blurry on
  // a high-DPI screen.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      setViewport((v) => ({ ...v, width: Math.round(rect.width), height: Math.round(rect.height) }))
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // The fit is computed once when the assets arrive, not per frame: it
  // projects all 33,791 positions, and recomputing it on every pan or zoom
  // would make dragging the map janky for no benefit.
  const fit = useMemo(() => (assets ? fitBase(assets.centroids) : null), [assets])

  const geoms = useMemo(() => {
    if (!assets || !fit) return []
    const view = createView(fit, viewport, assets.basemap)
    const radius = hexRadius(viewport.scale)
    const inputs: BinInput[] = []
    for (const point of assets.centroids) {
      const p = view.project(point.lon, point.lat)
      if (!p) continue
      if (p[0] < -40 || p[0] > viewport.width + 40 || p[1] < -40 || p[1] > viewport.height + 40) continue
      const value = valueByZcta.get(point.zcta)
      // A point with no usable figure is kept, so it renders as explicitly
      // absent rather than quietly vanishing from the map.
      inputs.push({
        x: p[0],
        y: p[1],
        value: value === null || value === undefined ? Number.NaN : value,
        zctas: [point.zcta],
      })
    }
    return hexbin(inputs, radius)
  }, [assets, fit, viewport, valueByZcta])

  // Canvas has no accessibility tree, so an equivalent is published as live
  // text. A screen-reader user gets the bins, not silence.
  const summary = useMemo(() => {
    const shown = geoms.length
    const withValue = geoms.filter((g) => g.value !== null).length
    const single = geoms.filter((g) => g.count === 1).length
    if (shown === 0) return 'The map has not drawn any areas yet.'
    return (
      `The map shows ${shown.toLocaleString('en-US')} areas. ` +
      `${withValue.toLocaleString('en-US')} have a ${MAP_METRICS.find((m) => m.key === metric)?.label} figure. ` +
      `${single.toLocaleString('en-US')} of them cover exactly one ZIP code, where the figure shown is that ZIP ` +
      `code's own published value rather than a median across several. ` +
      `Every figure is also listed in the screening table.`
    )
  }, [geoms, metric])


  /**
   * Zooms about the centre of what is actually drawn.
   *
   * Zooming about the geometric centre of the canvas looks correct until the
   * canvas centre is empty ocean, which is where repeated clicks land: the map
   * went blank at around seventeen times zoom with every figure off screen. The
   * centroid of the drawn hexagons is always somewhere worth looking at.
   */
  const zoomAtData = useCallback(
    (factor: number) => {
      setViewport((v) => {
        const drawn = geoms.filter(
          (g) => g.cx >= 0 && g.cx <= v.width && g.cy >= 0 && g.cy <= v.height,
        )
        if (drawn.length === 0) return zoomAround(v, factor, v.width / 2, v.height / 2)
        let sx = 0
        let sy = 0
        for (const g of drawn) {
          sx += g.cx
          sy += g.cy
        }
        return zoomAround(v, factor, sx / drawn.length - v.width / 2, sy / drawn.length - v.height / 2)
      })
    },
    [geoms],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets || !fit) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(viewport.width * dpr)
    canvas.height = Math.round(viewport.height * dpr)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewport.width, viewport.height)

    const view = createView(fit, viewport, assets.basemap)
    const radius = hexRadius(viewport.scale)

    // Basemap first, so data sits on top of it.
    if (assets.basemap) {
      ctx.save()
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      view.outlines()(ctx)
      ctx.restore()
    }

    for (const bin of geoms) {
      const r = radius
      const isSelected = bin.zctas.some((z) => selectedZctas.includes(z))
      const color = bin.value === null ? NO_DATA_COLOR : (binFor(bins, bin.value)?.color ?? NO_DATA_COLOR)
      ctx.beginPath()
      HEX_CORNERS.forEach(([dx, dy], i) => {
        const x = bin.cx + dx * r
        const y = bin.cy + dy * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      // An outline keeps adjacent hexagons separable and gives the no-data grey
      // a visible edge rather than blending into the background.
      ctx.strokeStyle = isSelected ? '#0f172a' : '#ffffff'
      ctx.lineWidth = isSelected ? 2.5 : 0.75
      ctx.stroke()
    }

    /*
     * Labels, once there is room for them.
     *
     * An unlabelled hexbin map tells you where a figure is high and where it is
     * low but never where you are, which is the objection Jev raised after the
     * accuracy and completeness review: the colours were right and the places
     * were anonymous. Below the threshold nothing is drawn, because a hexagon
     * too small to hold its own name is better left blank than lettered with
     * overlapping text.
     */
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const bin of geoms) {
      if (bin.count !== 1 && viewport.scale < LABEL_MIN_SCALE) continue
      if (radius < LABEL_MIN_RADIUS) continue
      const text = bin.count === 1 ? bin.zctas[0]! : String(bin.count)
      ctx.font = `${Math.max(9, Math.min(13, radius * 0.62))}px ui-monospace, monospace`
      const w = ctx.measureText(text).width
      // Skip anything that would not fit its own hexagon, which is what stops a
      // dense area turning into an unreadable grey smear of letters.
      if (w > radius * 1.75) continue
      // A dark halo keeps the label legible over both ends of the colour ramp.
      ctx.lineWidth = 2.5
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.strokeText(text, bin.cx, bin.cy)
      ctx.fillStyle = '#0f172a'
      ctx.fillText(text, bin.cx, bin.cy)
    }
  }, [assets, fit, viewport, geoms, bins, selectedZctas])

  useEffect(() => {
    draw()
  }, [draw])

  const hit = useCallback(
    (clientX: number, clientY: number): Hover | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      for (const bin of geoms) {
        const r = hexRadius(viewport.scale)
        const dx = x - bin.cx
        const dy = y - bin.cy
        // Hexagon containment, without solving the polygon: the bounding
        // hexagon test is a regular hexagon, so the exact apothem check is
        // both cheaper and correct.
        if (Math.abs(dx) > r || Math.abs(dy) > r) continue
        if (Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5 <= r) {
          return {
            cx: bin.cx,
            cy: bin.cy,
            value: bin.value,
            count: bin.count,
            withValue: bin.withValue,
            zctas: bin.zctas,
          }
        }
      }
      return null
    },
    [geoms, viewport.scale],
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((v) => ({ ...v, scale: v.scale * factor }))
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      const step = 40
      switch (event.key) {
        case 'ArrowLeft':
          setViewport((v) => ({ ...v, offsetX: v.offsetX + step }))
          break
        case 'ArrowRight':
          setViewport((v) => ({ ...v, offsetX: v.offsetX - step }))
          break
        case 'ArrowUp':
          setViewport((v) => ({ ...v, offsetY: v.offsetY + step }))
          break
        case 'ArrowDown':
          setViewport((v) => ({ ...v, offsetY: v.offsetY - step }))
          break
        case '+':
        case '=':
          zoomBy(1.4)
          break
        case '-':
        case '_':
          zoomBy(1 / 1.4)
          break
        case '0':
          setViewport((v) => ({ ...v, scale: 1, offsetX: 0, offsetY: 0 }))
          break
        default:
          return
      }
      event.preventDefault()
    },
    [zoomBy],
  )

  const active = MAP_METRICS.find((m) => m.key === metric)
  const covered = useMemo(() => geoms.filter((g) => g.value !== null).length, [geoms])

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-lg font-semibold text-slate-900">
        Map
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-700">
        One hexagon per area, coloured by the selected figure. Each hexagon covers one or more ZIP codes and
        shows the median of those that have a figure, and only where at least half of them do. Zoom in and the
        hexagons separate: at the deepest zoom each one holds a single ZIP code and shows that ZIP code's published
        figure unaltered, because a median across many ZIP codes is a figure that exists nowhere in the data. Where
        a hexagon is labelled with a number, that is how many ZIP codes it covers. Point at one to see the detail.
        Every figure is also in the screening table, which is the accessible way to read this data.
      </p>

      <fieldset className="mt-3">
        <legend className="text-sm font-semibold text-slate-900">Figure to map</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {MAP_METRICS.map((m) => (
            <label key={m.key} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name={`map-metric-${headingId}`}
                value={m.key}
                checked={metric === m.key}
                onChange={() => setMetric(m.key)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`inline-block h-3 w-3 rounded-full border ${
                  metric === m.key ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
                }`}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {loadError ? (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          The map could not be drawn: {loadError}. The screening table below still shows every figure.
        </p>
      ) : null}

      <div
        ref={wrapRef}
        className="relative mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-labelledby={`${headingId} ${legendId}`}
          onKeyDown={onKeyDown}
          style={{ touchAction: 'none' }}
          onMouseMove={(e) => setHover(hit(e.clientX, e.clientY))}
          onMouseLeave={() => setHover(null)}
          onPointerDown={(e) => {
            // Primary button only, and only after the pointer has actually
            // moved, so a plain click to select an area does not also drag.
            if (e.button !== 0) return
            drag.current = {
              pointerId: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              startX: e.clientX,
              startY: e.clientY,
            }
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || d.pointerId !== e.pointerId) return
            const dx = e.clientX - d.x
            const dy = e.clientY - d.y
            // A few pixels of movement means this is a drag, not a click.
            if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 4) return
            d.x = e.clientX
            d.y = e.clientY
            dragged.current = true
            setViewport((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }))
          }}
          onPointerUp={(e) => {
            if (drag.current?.pointerId === e.pointerId) drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onWheel={(e) => {
            // Zooming about the cursor rather than the origin is what makes the
            // map feel attached to the pointer; without it every zoom yanks the
            // point under the cursor off screen.
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const mx = e.clientX - rect.left - viewport.width / 2
            const my = e.clientY - rect.top - viewport.height / 2
            const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18
            setViewport((v) => zoomAround(v, factor, mx, my))
          }}
          onClick={() => {
            // A drag ends with a click event too, so selecting here would add
            // an area the reader only panned past.
            if (dragged.current) {
              dragged.current = false
              return
            }
            if (hover && hover.zctas.length > 0) onSelect(hover.zctas)
          }}
          className="block h-[560px] w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        />
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-slate-300 bg-white p-2 text-xs shadow-sm"
            style={{
              left: Math.min(hover.cx + 12, viewport.width - 180),
              top: Math.min(hover.cy + 12, viewport.height - 90),
            }}
          >
            <p className="font-semibold text-slate-900">
              {hover.value === null
                ? NO_DATA_LABEL
                : formatValue(hover.value, unit)}
            </p>
            <p className="text-slate-700">
              {hover.count === 1 ? hover.zctas[0] : `${hover.count} ZIP codes`}
              {hover.withValue < hover.count
                ? `, ${hover.withValue} with a figure`
                : ''}
            </p>
            {hover.zctas.length <= 4 ? (
              <p className="text-slate-600">{hover.zctas.join(', ')}</p>
            ) : null}
          </div>
        ) : null}
{/*
          Pointer affordances. Zoom was previously reachable only from the
          keyboard, which is fine for accessibility and useless for anyone
          using a mouse or a touchscreen, so the same three actions are offered
          as buttons.
        */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoomAtData(1.5)}
            aria-label="Zoom in"
            className="h-8 w-8 rounded-md border border-slate-300 bg-white text-lg leading-none text-slate-900 shadow-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            onClick={() => zoomAtData(1 / 1.5)}
            aria-label="Zoom out"
            className="h-8 w-8 rounded-md border border-slate-300 bg-white text-lg leading-none text-slate-900 shadow-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <span aria-hidden="true">&minus;</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport({ ...INITIAL_VIEWPORT, width: viewport.width, height: viewport.height })}
            aria-label="Reset the map to the whole country"
            className="h-8 w-8 rounded-md border border-slate-300 bg-white text-xs leading-none text-slate-900 shadow-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <span aria-hidden="true">&#8634;</span>
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-slate-700">
          Drag to pan, scroll or pinch to zoom, or use the buttons. Arrow keys pan, + and &minus; zoom, 0
          resets. Click an area to compare it.
        </p>
      </div>

      {/* The legend is real text, not swatches alone, so the scale is readable
          without colour perception. */}
      <div id={legendId} className="mt-2 text-sm">
        <p className="font-semibold text-slate-900">
          Legend — {active?.label}
          {bins.length === 0 ? ' (no figures loaded yet)' : ''}
        </p>
        {bins.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
            {bins.map((bin) => (
              <li key={bin.color} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-sm border border-white"
                  style={{ backgroundColor: bin.color }}
                />
                {formatValue(bin.from, unit)} to {bin.to === null ? 'the highest' : formatValue(bin.to, unit)}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm border border-white"
                style={{ backgroundColor: NO_DATA_COLOR }}
              />
              {NO_DATA_LABEL}
            </li>
          </ul>
        ) : null}
        <p className="mt-1 text-xs text-slate-600">
          {covered.toLocaleString('en-US')} of {geoms.length.toLocaleString('en-US')} areas have a figure, and
          a grey hexagon is one where fewer than half of its ZIP codes had one. Alaska, Hawaii and Puerto Rico
          are drawn as insets.
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {summary}
      </p>

      <div className="mt-4">
        <FairHousingNotice />
      </div>
    </section>
  )
}
