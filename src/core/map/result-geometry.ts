/**
 * Geometry for the result map: the reference area's outline beneath a result
 * choropleth.
 *
 * `projection.ts` fits one national base and then zooms a canvas over it, which
 * is right for the country-wide sweep: 33,791 points are projected once and a
 * pan costs nothing. It is wrong for a result map, which shows a handful of ZIP
 * codes inside one state. Reusing the national fit there drew a two-ZIP result
 * as two pixels in a corner of an empty country, which is what row I12 records:
 * the referenced state's outline has to be drawn *under* the result and the view
 * has to be fitted to it.
 *
 * So this fits the projection to the state, and the outline and the points are
 * then placed by the same projection. That is the property that matters: two
 * projections would let the outline drift away from the points it is meant to be
 * under, and the drift would be invisible until someone compared them.
 *
 * Path data is returned as a string rather than a `Path2D`, because `Path2D`
 * does not exist in the node test environment, and an outline nobody can assert
 * on is an outline that breaks quietly. SVG takes the same string.
 */
import {
  geoAlbersUsa,
  geoConicEqualArea,
  geoPath,
  type GeoPermissibleObjects,
  type GeoProjection,
} from 'd3-geo'

import type { Basemap } from './projection'

/** Distance kept between the drawn reference area and the panel edge, in px. */
export const RESULT_MAP_PADDING = 12

export interface ResultMapFit {
  /**
   * SVG path data for the reference area's outline. Empty when no basemap
   * feature was available, which is a stated absence rather than a failure.
   */
  outline: string
  /** Projects lon/lat into the same box the outline was fitted to. */
  project(lon: number, lat: number): [number, number] | null
  /**
   * True when the outline came from the basemap. False means the view was fitted
   * to the result points alone, so the caller must say the outline is missing
   * rather than let an empty panel imply the state has no shape.
   */
  fromBasemap: boolean
  /** The postcode abbreviation the outline was drawn for, if any. */
  state: string | null
}

/** The basemap feature for one postal abbreviation, or null. */
export function stateFeature(basemap: Basemap | null, state: string | null): Basemap['features'][number] | null {
  if (!basemap || !state) return null
  const wanted = state.trim().toUpperCase()
  if (!wanted) return null
  return basemap.features.find((f) => String(f.properties?.STUSAB ?? '').toUpperCase() === wanted) ?? null
}

/**
 * Fits one state and the result points into a box, and returns the outline path
 * plus a projector for the points.
 *
 * Returns null only when there is nothing to fit at all - no state feature and no
 * points - or when d3 cannot place the geometry, because a caller that draws a
 * fitted view it did not get is the defect this module exists to prevent.
 */
export function buildResultMapFit(
  basemap: Basemap | null,
  state: string | null,
  points: readonly { lon: number; lat: number }[],
  width: number,
  height: number,
  padding: number = RESULT_MAP_PADDING,
): ResultMapFit | null {
  if (!(width > 0) || !(height > 0)) return null

  const feature = stateFeature(basemap, state)
  const placed = points.filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
  if (!feature && placed.length === 0) return null

  /*
   * The same projection split `projection.ts` already makes: `albersUsa` covers
   * the lower 48, Alaska and Hawaii, and d3 leaves Puerto Rico out of it, so PR
   * is drawn through its own conic equal-area. Measured here rather than assumed:
   * asking `albersUsa` for a PR coordinate returns null, which is why the first
   * version of this fit silently produced an empty panel for the territory.
   */
  const projection = projectionFor(state).fitExtent(
    [
      [padding, padding],
      [Math.max(padding, width - padding), Math.max(padding, height - padding)],
    ],
    (feature ?? { type: 'MultiPoint', coordinates: placed.map((p) => [p.lon, p.lat]) }) as GeoPermissibleObjects,
  )

  // A degenerate target (one point, or points at one coordinate) makes d3 divide
  // by a zero extent and answer Infinity, which then draws nothing anywhere.
  if (!Number.isFinite(projection.scale()) || !Number.isFinite(projection.translate()[0])) return null

  const path = geoPath(projection)
  return {
    outline: feature ? (path(feature as unknown as GeoPermissibleObjects) ?? '') : '',
    project: projectWith(projection),
    fromBasemap: feature !== null,
    state: feature ? String(feature.properties?.STUSAB ?? state ?? '') : null,
  }
}

/** The projection a state's outline and its points must share. */
function projectionFor(state: string | null): GeoProjection {
  return (state ?? '').trim().toUpperCase() === 'PR'
    ? geoConicEqualArea().parallels([18, 18])
    : geoAlbersUsa()
}

/** Wraps a d3 projection as a projector that reports unplaceable points. */
function projectWith(projection: GeoProjection): (lon: number, lat: number) => [number, number] | null {
  return (lon, lat) => {
    const out = projection([lon, lat])
    if (!out) return null
    const [x, y] = out
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null
  }
}
