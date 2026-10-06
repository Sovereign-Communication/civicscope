/**
 * Similarity between ZIP codes, computed by the reader's own weights.
 *
 * Four positions this module takes, all of them recorded decisions rather than
 * defaults:
 *
 * **It ships off.** No visitor sees a ranking unless they turn this on, because
 * "the ZIP codes most like yours" is inherently a ranking — an earlier draft of
 * this feature's plan claimed "user agency eliminates steering risk", which is not
 * true: letting a reader choose weights changes who picks the ranking function,
 * not whether the output ranks. Making it opt-in is what actually changes the
 * default position. The flag lives in localStorage, next to the Census key.
 *
 * **The reader sets every weight.** There are no operator-chosen defaults standing
 * in for a preference, and no outcome-named templates — "Schools Priority" was
 * dropped, not deferred, because a template that names an outcome is the highest-
 * steering thing in the plan and there is no attorney review to clear it later.
 *
 * **The weights draw from the sortable allowlist.** `src/core/sortable-surface.ts`
 * is the same allowlist the sort columns and the figure filters draw from, and it
 * is the mechanism that keeps protected-class metrics out: a weight key is typed as
 * an allowlisted metric, a test asserts the set, and `src/core/scoring.ts` refuses
 * such metrics from composites besides. CDC PLACES health measures are flagged
 * `protectedClassProxy` and cannot appear here.
 *
 * **The output is alphabetical, never by score.** Showing "the closest N" is
 * itself a ranking even when displayed A-Z, so the distance cut-off is visible and
 * reader-adjustable and the count says how many matched. What alphabetical order
 * guarantees is that the tool is not choosing which of the matching areas to put
 * in front of you.
 *
 * The whole computation is local. The country-wide screen is already in memory when
 * this runs, so comparing one ZIP against all 33,791 costs no request and needs no
 * baked payload — the plan's original design baked 0.5-1 MB of figures into the
 * bundle, which would have been five to ten times the entire application, for data
 * the visitor already holds. Measured against that design this costs zero bytes.
 */
import type { AreaRow } from './plugins/acs'
import { SCORE_RULES } from './scoring'
import type { SortableMetricKey } from './sortable-surface'

/**
 * The four dimensions a reader may weight.
 *
 * Deliberately narrower than the allowlist: `households` is on the sortable
 * surface because it is meaningful to sort by, but "similar number of
 * households" is not a question anyone asks about a neighbourhood, and including
 * it would add a dimension that dilutes the four that matter. Everything here is
 * allowlisted, which is the constraint that matters.
 */
export const SIMILARITY_METRICS = [
  'median_rent_burden_pct',
  'median_gross_rent',
  'median_home_value',
  'median_household_income',
] as const satisfies readonly SortableMetricKey[]

export type SimilarityMetric = (typeof SIMILARITY_METRICS)[number]
export type Weights = Record<SimilarityMetric, number>

/** The reader's cut-off: a pair is "similar" at or below this distance. */
export const DEFAULT_CUTOFF = 0.5

/** Equal weights, so the first run has no operator opinion baked into it. */
export const DEFAULT_WEIGHTS: Weights = {
  median_rent_burden_pct: 1,
  median_gross_rent: 1,
  median_home_value: 1,
  median_household_income: 1,
}

/**
 * Documented reference bounds, reused from the affordability composite.
 *
 * `src/core/scoring.ts` publishes these precisely so the methodology is not
 * duplicated, and so a reader comparing the composite and the similarity view
 * sees one set of numbers, not two that nearly agree.
 */
const BOUNDS = new Map<SimilarityMetric, { floor: number; ceiling: number }>(
  SCORE_RULES.affordability
    .filter((r) => (SIMILARITY_METRICS as readonly string[]).includes(r.key))
    .map((r) => [r.key as SimilarityMetric, { floor: r.floor, ceiling: r.ceiling }]),
)

/** Scales a raw figure into 0..1 against the published bounds. */
function normalise(metric: SimilarityMetric, value: number): number {
  const b = BOUNDS.get(metric)
  if (!b) return 0
  const t = (value - b.floor) / (b.ceiling - b.floor)
  return Math.max(0, Math.min(1, t))
}

export interface SimilarArea {
  zcta: string
  /** Weighted distance in 0..1. Smaller is closer; shown, never used for ordering. */
  distance: number
  /** The figures the distance was computed from, so the reader can check it. */
  figures: Partial<Record<SimilarityMetric, number | null>>
}

/**
 * Weighted distance between two areas, over the dimensions both carry.
 *
 * A metric missing from either side is skipped and the weights renormalised over
 * what remains, for the same reason `scoring.ts` renormalises a composite: a
 * distance computed from three of four dimensions is a different measurement than
 * one from all four, and quietly treating the missing one as equal to zero would
 * make rural areas with no rent figure look closest of all.
 *
 * Returns null when the two areas share no weighted dimension at all — there is
 * no honest distance to report, and the pair must not appear in results.
 */
export function distance(
  a: AreaRow,
  b: AreaRow,
  weights: Weights,
): number | null {
  let total = 0
  let weightSum = 0
  for (const metric of SIMILARITY_METRICS) {
    const w = weights[metric]
    if (!w || w <= 0) continue
    const av = a.metrics[metric] ?? null
    const bv = b.metrics[metric] ?? null
    if (av === null || bv === null) continue
    const d = normalise(metric, av) - normalise(metric, bv)
    total += w * d * d
    weightSum += w
  }
  if (weightSum === 0) return null
  // Root-mean-square, so the result stays in 0..1 whatever the weights total.
  return Math.sqrt(total / weightSum)
}

/**
 * The areas similar to `origin`, within the reader's cut-off.
 *
 * Sorted **alphabetically by ZIP code**, not by distance. The distance is
 * computed, returned and displayed — hiding it would be worse — but it never
 * decides the order, because the order is the one thing this application
 * refuses to choose for anyone.
 */
export function findSimilar(
  sweep: readonly AreaRow[],
  origin: AreaRow,
  weights: Weights,
  cutoff: number = DEFAULT_CUTOFF,
): SimilarArea[] {
  const out: SimilarArea[] = []
  for (const row of sweep) {
    if (row.zcta === origin.zcta) continue
    const d = distance(origin, row, weights)
    if (d === null || d > cutoff) continue
    const figures: Partial<Record<SimilarityMetric, number | null>> = {}
    for (const metric of SIMILARITY_METRICS) figures[metric] = row.metrics[metric] ?? null
    out.push({ zcta: row.zcta, distance: d, figures })
  }
  // A-Z by ZIP code. Deliberate: see the function comment.
  out.sort((x, y) => (x.zcta < y.zcta ? -1 : x.zcta > y.zcta ? 1 : 0))
  return out
}

/** The origin's own figures, to sit beside each result in the breakdown. */
export function originFigures(origin: AreaRow): Partial<Record<SimilarityMetric, number | null>> {
  const figures: Partial<Record<SimilarityMetric, number | null>> = {}
  for (const metric of SIMILARITY_METRICS) figures[metric] = origin.metrics[metric] ?? null
  return figures
}

/**
 * Rejects a weight key that is not a similarity metric.
 *
 * The type system already prevents this at compile time; this holds the same line
 * at runtime, where weights arrive from localStorage and a hand-edited value could
 * name any key. A smuggled key is ignored rather than crashing — the reader's
 * stored weights survive, and the metric simply does not participate.
 */
export function isSimilarityMetric(key: string): key is SimilarityMetric {
  return (SIMILARITY_METRICS as readonly string[]).includes(key)
}
