import { describe, expect, it } from 'vitest'
import { affordabilityIndex, educationIndex, normalize, SCORE_RULES } from './scoring'
import type { MetricValue } from './types'

function m(key: string, value: number | null, unit: MetricValue['unit'] = 'count'): MetricValue {
  return {
    key,
    label: key,
    value,
    unit,
    category: 'cost',
    source: { publisher: 'p', dataset: 'd', tableId: 't', vintage: 'v', url: 'u' },
    quality: {},
  }
}

describe('normalize', () => {
  const rule = SCORE_RULES.affordability[0]! // rent burden: floor 15%, ceiling 45%, lower is better

  // Semantics: `floor` and `ceiling` are the numerically smaller and larger
  // ends of a metric's plausible range. `betterWhen` decides which end scores
  // high. For rent burden, 15% is the smaller number and the better outcome,
  // so the smaller end scores 100.
  it('scores the better end 100 and the worse end 0', () => {
    expect(normalize(rule, rule.floor)).toBe(100)
    expect(normalize(rule, rule.ceiling)).toBe(0)
  })

  it('clamps beyond the bounds instead of overshooting', () => {
    // A rent burden below the range is better than the best case, not worse.
    expect(normalize(rule, rule.floor - 999)).toBe(100)
    expect(normalize(rule, rule.ceiling + 999)).toBe(0)
  })

  it('is monotonic for a lower-is-better metric: lower raw value scores higher', () => {
    expect(normalize(rule, rule.floor + 1)).toBeGreaterThan(normalize(rule, rule.ceiling - 1))
  })

  it('is monotonic for a higher-is-better metric: higher raw value scores higher', () => {
    const income = SCORE_RULES.affordability.find((r) => r.key === 'median_household_income')!
    expect(normalize(income, income.floor)).toBe(0)
    expect(normalize(income, income.ceiling)).toBe(100)
  })

  it('places the midpoint at 50', () => {
    const mid = (rule.floor + rule.ceiling) / 2
    expect(normalize(rule, mid)).toBeCloseTo(50, 0)
  })
})

describe('affordabilityIndex', () => {
  it('returns null rather than a misleading number when nothing is available', () => {
    const out = affordabilityIndex([])
    expect(out.score).toBeNull()
    expect(out.basis).toMatch(/No data/i)
  })

  it('reports a partial basis when only some components exist', () => {
    const out = affordabilityIndex([m('median_rent_burden_pct', 20, 'percent')])
    expect(out.score).not.toBeNull()
    expect(out.basis).toMatch(/1 of 4/)
    expect(out.basis).toMatch(/reweighted/i)
  })

  it('reweights over available components so a missing metric cannot deflate the score', () => {
    const onlyBurden = affordabilityIndex([m('median_rent_burden_pct', 20, 'percent')])
    const bestPossible = onlyBurden.components.find((c) => c.key === 'median_rent_burden_pct')!.score
    // With a single component the composite must equal that component, not a
    // fraction of it diluted by absent components.
    expect(onlyBurden.score).toBe(Math.round(bestPossible))
  })

  it('flags excluded components with a reason', () => {
    const out = affordabilityIndex([m('median_gross_rent', null, 'usd_monthly')])
    const excluded = out.components.filter((c) => c.excluded)
    expect(excluded.length).toBeGreaterThan(0)
    expect(excluded.every((c) => typeof c.excluded === 'string')).toBe(true)
  })

  it('scores an expensive, high-burden area worse than a cheap one', () => {
    const poor = affordabilityIndex([
      m('median_rent_burden_pct', 40, 'percent'),
      m('median_gross_rent', 3000, 'usd_monthly'),
      m('median_home_value', 800000, 'usd'),
      m('median_household_income', 35000, 'usd'),
    ])
    const rich = affordabilityIndex([
      m('median_rent_burden_pct', 18, 'percent'),
      m('median_gross_rent', 900, 'usd_monthly'),
      m('median_home_value', 150000, 'usd'),
      m('median_household_income', 130000, 'usd'),
    ])
    expect(poor.score!).toBeLessThan(rich.score!)
  })
})

describe('educationIndex', () => {
  it('weights spending above staffing, and documents why', () => {
    const spend = SCORE_RULES.education.find((r) => r.key === 'per_pupil_spend')!
    const ratio = SCORE_RULES.education.find((r) => r.key === 'student_teacher_ratio')!
    expect(spend.weight).toBeGreaterThan(ratio.weight)
    expect(spend.weight + ratio.weight).toBeCloseTo(1, 5)
  })

  it('scores a well-resourced district above a poorly resourced one', () => {
    const strong = educationIndex([
      m('per_pupil_spend', 22000, 'usd'),
      m('student_teacher_ratio', 12, 'ratio'),
    ])
    const weak = educationIndex([
      m('per_pupil_spend', 9000, 'usd'),
      m('student_teacher_ratio', 20, 'ratio'),
    ])
    expect(weak.score!).toBeLessThan(strong.score!)
  })

  it('only references metrics the education plugin actually produces', () => {
    // Guards against a composite silently degrading to null because a rule
    // points at a metric no plugin emits.
    const available = ['per_pupil_spend', 'student_teacher_ratio']
    for (const r of SCORE_RULES.education) {
      expect(available).toContain(r.key)
    }
  })

  it('always exposes its components alongside the score', () => {
    const out = educationIndex([m('per_pupil_spend', 15000, 'usd')])
    expect(out.components.length).toBe(SCORE_RULES.education.length)
    expect(out.components.some((c) => c.key === 'per_pupil_spend' && c.raw === 15000)).toBe(true)
  })
})

describe('composite safety', () => {
  it('never folds a protected-class metric into a composite', () => {
    const ruleKeys = [
      ...SCORE_RULES.affordability.map((r) => r.key),
      ...SCORE_RULES.education.map((r) => r.key),
    ]
    // A demographic key reaching a scoring rule would be the single worst bug
    // in this codebase, so it is pinned by an explicit assertion.
    for (const key of ruleKeys) {
      expect(key).not.toMatch(/pct_(white|black|asian|hispanic|population)/i)
    }
  })
})
