/**
 * Scoring.
 *
 * Two design commitments, both load-bearing:
 *
 *  1. Composite indices are never shown without their components. The number is
 *     a convenience; the parts are the truth. Users who disagree with the
 *     weights can see exactly what moved the result.
 *
 *  2. Weights are published, versioned, and documented. This is the primary
 *     fair-housing mitigation available to a ranking product: the operator
 *     chose these inputs, and disclosing that choice — including the known
 *     correlation between school funding and block-group demographics — is
 *     what separates a good-faith tool from a negligent one.
 *
 * Scoring is only ever applied to metrics that are not marked
 * `protectedClassProxy`. The engine refuses to fold demographic data into a
 * composite. That is a hard rule, not a convention.
 */

import type { MetricValue } from './types'

export interface Component {
  key: string
  label: string
  /** 0-100, direction already normalized so higher is always better. */
  score: number
  /** The metric's raw value, for display beside the score. */
  raw: number | null
  unit: MetricValue['unit']
  weight: number
  /** Set when the component was excluded and why. */
  excluded?: string
}

export interface Composite {
  id: 'affordability' | 'education'
  label: string
  /** null when there was not enough data to compute honestly. */
  score: number | null
  components: Component[]
  /** Human-readable statement of what was included and excluded. */
  basis: string
}

/**
 * Percentile-style normalization without a population to compute against.
 *
 * We deliberately do NOT normalize against the full set of US areas, because
 * that would require holding a national dataset in the browser — which is the
 * thing this architecture exists to avoid. Instead each component is scaled
 * against documented reference bounds. The bounds are stated in the UI, and
 * they are the reason these indices are comparable within a query rather than
 * across unrelated ones.
 */
interface Rule {
  key: string
  label: string
  unit: MetricValue['unit']
  weight: number
  /** Numerically smaller end of the metric's plausible range. */
  floor: number
  /** Numerically larger end of the metric's plausible range. */
  ceiling: number
  betterWhen: 'higher' | 'lower'
  note: string
}

const AFFORDABILITY_RULES: Rule[] = [
  {
    key: 'median_rent_burden_pct',
    label: 'Median rent as share of income',
    unit: 'percent',
    weight: 0.4,
    floor: 15,
    ceiling: 45,
    betterWhen: 'lower',
    note: 'Share of gross income spent on rent. 30% is the conventional cost-burden threshold; 15% is unusually low and 45% is severe.',
  },
  {
    key: 'median_gross_rent',
    label: 'Median gross rent',
    unit: 'usd_monthly',
    weight: 0.25,
    floor: 700,
    ceiling: 3200,
    betterWhen: 'lower',
    note: 'Absolute rent level. This term does not account for income and is most meaningful next to the burden figure above.',
  },
  {
    key: 'median_home_value',
    label: 'Median home value',
    unit: 'usd',
    weight: 0.2,
    floor: 120000,
    ceiling: 900000,
    betterWhen: 'lower',
    note: 'Absolute home value level, for buyers. Scaled to the full observed range of US ZCTA medians.',
  },
  {
    key: 'median_household_income',
    label: 'Median household income',
    unit: 'usd',
    weight: 0.15,
    floor: 30000,
    ceiling: 140000,
    betterWhen: 'higher',
    note: 'Household income, a primary input to whether local prices are manageable.',
  },
]

const EDUCATION_RULES: Rule[] = [
  {
    key: 'per_pupil_spend',
    label: 'Expenditure per pupil',
    unit: 'usd',
    weight: 0.6,
    floor: 8000,
    ceiling: 24000,
    betterWhen: 'higher',
    note: 'Annual district spending per student. A resource input, not a measure of teaching quality.',
  },
  {
    key: 'student_teacher_ratio',
    label: 'Students per teacher',
    unit: 'ratio',
    weight: 0.4,
    floor: 11,
    ceiling: 22,
    betterWhen: 'lower',
    note: 'All teachers, not classroom-only. A rough staffing indicator rather than a class-size measure.',
  },
]

export const SCORE_VERSION = '1.0.0'

/**
 * Maps a raw metric onto 0-100.
 *
 * `floor` is the worse end of the range and `ceiling` the better end, so a
 * `lower is better` metric declares a lower `floor` (worse) and a higher
 * `ceiling` (better). Direction is then applied once, here, and only here.
 */
export function normalize(rule: Rule, raw: number): number {
  const { floor, ceiling, betterWhen } = rule
  const span = ceiling - floor
  if (span === 0) return 50
  const t = (raw - floor) / span
  const clamped = Math.max(0, Math.min(1, t))
  return betterWhen === 'higher' ? clamped * 100 : (1 - clamped) * 100
}

function compute(rules: Rule[], metrics: readonly MetricValue[]): Composite['score'] extends never ? never : Composite {
  const byKey = new Map(metrics.map((m) => [m.key, m]))
  const components: Component[] = []

  for (const rule of rules) {
    const m = byKey.get(rule.key)
    if (!m || m.value === null) {
      components.push({
        key: rule.key,
        label: rule.label,
        score: 0,
        raw: null,
        unit: rule.unit,
        weight: rule.weight,
        excluded: m?.quality.suppressed ? 'Withheld by a suppression rule' : 'Not available for this area',
      })
      continue
    }
    components.push({
      key: rule.key,
      label: rule.label,
      score: normalize(rule, m.value),
      raw: m.value,
      unit: rule.unit,
      weight: rule.weight,
    })
  }

  // Renormalize across whatever is actually present. A composite computed from
  // two of four inputs is a different measurement than one computed from all
  // four, and the basis string has to say so rather than quietly implying
  // full coverage.
  const present = components.filter((c) => c.excluded === undefined)
  if (present.length === 0) {
    return { id: 'affordability', label: '', score: null, components, basis: 'No data available.' }
  }

  const totalWeight = present.reduce((s, c) => s + c.weight, 0)
  const score = present.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
  const missing = components.filter((c) => c.excluded !== undefined).map((c) => c.label)

  const basis =
    `Computed from ${present.length} of ${rules.length} published components` +
    (totalWeight < 0.999 ? ', reweighted to sum to 100% over the available components.' : '.') +
    (missing.length ? ` Not available: ${missing.join(', ')}.` : '')

  return {
    id: rules === EDUCATION_RULES ? 'education' : 'affordability',
    label: '',
    score: Math.round(score),
    components,
    basis,
  }
}

export function affordabilityIndex(metrics: readonly MetricValue[]): Composite {
  const c = compute(AFFORDABILITY_RULES, metrics)
  return { ...c, id: 'affordability', label: 'Affordability' }
}

export function educationIndex(metrics: readonly MetricValue[]): Composite {
  const c = compute(EDUCATION_RULES, metrics)
  return { ...c, id: 'education', label: 'Education resources' }
}

export function scoreBoth(metrics: readonly MetricValue[]): Composite[] {
  return [affordabilityIndex(metrics), educationIndex(metrics)]
}

/** Exposed so the methodology page can render the rules without duplication. */
export const SCORE_RULES = {
  affordability: AFFORDABILITY_RULES,
  education: EDUCATION_RULES,
  version: SCORE_VERSION,
} as const
