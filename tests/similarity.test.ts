/**
 * Similarity, pinned.
 *
 * The assertions here are the recorded decisions of the feature, not its
 * arithmetic. The arithmetic (distance falls out of bounds and weights) is easy
 * to get right; the decisions — nothing is ranked, nothing protected-class can
 * be weighted, a missing figure never fakes closeness — are exactly the things
 * that would erode quietly under future edits, so each has a test that names it.
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WEIGHTS,
  distance,
  findSimilar,
  isSimilarityMetric,
  SIMILARITY_METRICS,
  type Weights,
} from '../src/core/similarity'
import { SORTABLE_METRIC_KEYS } from '../src/core/sortable-surface'
import type { AreaRow } from '../src/core/plugins/acs'

const row = (zcta: string, metrics: Partial<AreaRow['metrics']>): AreaRow => ({
  zcta,
  name: zcta,
  metrics: {
    median_rent_burden_pct: 30,
    median_gross_rent: 1200,
    median_home_value: 300000,
    median_household_income: 60000,
    ...metrics,
  } as AreaRow['metrics'],
  moes: {},
})

const W = DEFAULT_WEIGHTS

describe('the weightable dimensions', () => {
  it('are drawn from the sortable allowlist, so no protected-class metric can be weighted', () => {
    for (const m of SIMILARITY_METRICS) {
      expect(SORTABLE_METRIC_KEYS, `"${m}" must be allowlisted to be weightable`).toContain(m)
    }
  })

  it('exclude health and school measures by name, which is the Phase 2B decision', () => {
    const joined = SIMILARITY_METRICS.join(',')
    expect(joined).not.toMatch(/places|health|disability|school|per_pupil|student_teacher/)
  })

  it('reject an unknown key at runtime, where weights arrive from storage', () => {
    expect(isSimilarityMetric('median_gross_rent')).toBe(true)
    expect(isSimilarityMetric('obesity_crudeprev')).toBe(false)
    expect(isSimilarityMetric('median_age')).toBe(false)
  })
})

describe('distance', () => {
  it('is zero for identical areas', () => {
    const a = row('11111', {})
    const b = row('22222', {})
    expect(distance(a, b, W)).toBe(0)
  })

  it('is symmetric', () => {
    const a = row('11111', { median_gross_rent: 800 })
    const b = row('22222', { median_gross_rent: 2800 })
    expect(distance(a, b, W)).toBeCloseTo(distance(b, a, W)!, 12)
  })

  it('grows as the figures grow apart, and stays inside 0..1', () => {
    const origin = row('11111', {})
    const near = row('22222', { median_gross_rent: 1300 })
    const far = row('33333', { median_gross_rent: 3000 })
    const dNear = distance(origin, near, W)!
    const dFar = distance(origin, far, W)!
    expect(dFar).toBeGreaterThan(dNear)
    expect(dFar).toBeLessThanOrEqual(1)
  })

  it('skips a dimension missing from either side, and renormalises rather than discarding the pair', () => {
    // Identical in the three dimensions both carry, different in the one that is
    // missing. The distance is computed from those three, so the pair scores
    // what it is — close — rather than being thrown away or scored as identical
    // to a pair that matches on all four.
    const origin = row('11111', {})
    const noRentClose = row('22222', { median_gross_rent: null, median_home_value: 302000 })
    expect(distance(origin, noRentClose, W)).not.toBe(0)
    expect(distance(origin, noRentClose, W)).not.toBeNull()
    // And a pair identical in every present dimension is at zero.
    const noRentIdentical = row('33333', { median_gross_rent: null })
    expect(distance(origin, noRentIdentical, W)).toBe(0)
  })

  it('is null when the two areas share no weighted dimension', () => {
    const origin = row('11111', {})
    const empty = row('44444', {
      median_rent_burden_pct: null,
      median_gross_rent: null,
      median_home_value: null,
      median_household_income: null,
    })
    expect(distance(origin, empty, W)).toBeNull()
  })

  it('ignores a metric the reader weighted at zero', () => {
    const origin = row('11111', {})
    const differsOnlyInRent = row('22222', { median_gross_rent: 3200 })
    const zeroRent: Weights = { ...W, median_gross_rent: 0 }
    expect(distance(origin, differsOnlyInRent, zeroRent)).toBe(0)
  })
})

describe('findSimilar', () => {
  const sweep = [
    row('90001', { median_gross_rent: 1250 }),
    row('10001', { median_gross_rent: 1200 }),
    row('70001', { median_gross_rent: 2900 }),
    row('11111', {}),
  ]
  const origin = row('11111', { median_gross_rent: 1200 })

  it('returns areas within the cut-off and not the origin itself', () => {
    // 2900 against 1200 normalises to a 0.68 raw difference, which is
    // sqrt(0.68^2 / 4) = 0.34 as a four-dimension RMS — inside the default 0.5.
    // The RMS shape is the design: a maximal difference in one of four
    // dimensions lands at 0.5, so the default cut-off reads as "about half
    // maximally different, on average".
    const out = findSimilar(sweep, origin, W, 0.5)
    const zips = out.map((s) => s.zcta)
    expect(zips).not.toContain('11111')
    expect(zips).toContain('10001')
    expect(zips).toContain('90001')
    expect(zips).toContain('70001')
  })

  it('excludes an area that is too far, at a tighter cut-off', () => {
    const out = findSimilar(sweep, origin, W, 0.2)
    const zips = out.map((s) => s.zcta)
    expect(zips).toContain('10001')
    expect(zips, '0.34 RMS is further than a 0.2 cut-off allows').not.toContain('70001')
  })

  it('orders results alphabetically by ZIP code, never by distance', () => {
    // 90001 is closer to the origin than 10001 is not the point; the point is
    // that whichever is closer, the order must not follow it.
    const out = findSimilar(sweep, origin, W, 1)
    const zips = out.map((s) => s.zcta)
    expect(zips).toEqual([...zips].sort())
    const byDistance = [...out].sort((a, b) => a.distance - b.distance).map((s) => s.zcta)
    expect(zips).not.toEqual(byDistance)
  })

  it('carries each result\'s figures, so the reader can check the comparison', () => {
    const out = findSimilar(sweep, origin, W, 1)
    for (const s of out) {
      expect(Object.keys(s.figures)).toHaveLength(SIMILARITY_METRICS.length)
    }
  })

  it('respects a tighter cut-off than the default', () => {
    const loose = findSimilar(sweep, origin, W, 1).length
    const tight = findSimilar(sweep, origin, W, 0.01).length
    expect(tight).toBeLessThanOrEqual(loose)
  })

  it('is deterministic', () => {
    const first = findSimilar(sweep, origin, W, 1).map((s) => `${s.zcta}:${s.distance}`)
    for (let i = 0; i < 3; i++) {
      expect(findSimilar(sweep, origin, W, 1).map((s) => `${s.zcta}:${s.distance}`)).toEqual(first)
    }
  })
})
