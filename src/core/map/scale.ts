/**
 * The map's colour scale.
 *
 * Two decisions are load-bearing and both are constraints rather than taste.
 *
 * Colour. A sequential single-hue ramp, not a rainbow. A rainbow ramp invents
 * boundaries that are not in the data and is unreadable to the most common form
 * of colour blindness. The ramp is also used only for magnitude; it is never used
 * to imply that a colour is good or bad, because "high home value" is not a
 * judgement and a map that reads as one is a fair-housing problem.
 *
 * Binning. Quantiles rather than equal intervals, because housing distributions
 * are heavily skewed: a few ZIPs hold extreme values that would flatten the rest
 * of the country into a single step. Quantiles keep the map readable, and the
 * legend prints the real boundaries so nothing is hidden by the binning.
 */

export const MAP_METRICS = [
  { key: 'median_gross_rent', label: 'Median gross rent', unit: 'usd_monthly', betterWhen: 'lower' },
  { key: 'median_rent_burden_pct', label: 'Median rent burden', unit: 'percent', betterWhen: 'lower' },
  { key: 'median_home_value', label: 'Median home value', unit: 'usd', betterWhen: 'higher' },
  { key: 'median_household_income', label: 'Median household income', unit: 'usd', betterWhen: 'higher' },
  { key: 'households', label: 'Households', unit: 'count', betterWhen: 'lower' },
] as const

export type MapMetricKey = (typeof MAP_METRICS)[number]['key']

/**
 * Sequential ramp, dark to light, in a single hue.
 *
 * Steps are chosen so adjacent bins stay distinguishable in greyscale, which
 * keeps the map readable for a colour-blind viewer and in print. The no-data
 * colour is deliberately a desaturated grey rather than a pale ramp step, so an
 * area with no figure can never be mistaken for an area with a low one.
 */
export const RAMP = ['#1e3a8a', '#2c5aa0', '#3d7fb8', '#5c9fd0', '#8bbcde', '#bcd8ea']
export const NO_DATA_COLOR = '#e2e8f0'
export const NO_DATA_LABEL = 'not yet imported'

export interface Bin {
  /** Inclusive lower bound of the value range this bin covers. */
  from: number
  /** Exclusive upper bound, or null for the open-ended top bin. */
  to: number | null
  color: string
  count: number
}

/** Linearly interpolates a sorted array at a fractional index. */
function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return Number.NaN
  const at = (sorted.length - 1) * fraction
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  const low = sorted[lo]
  const high = sorted[hi]
  if (low === undefined || high === undefined) return low ?? high ?? Number.NaN
  return low + (high - low) * (at - lo)
}

/**
 * Builds quantile breaks over the values that actually exist.
 *
 * Quantiles rather than equal intervals because housing distributions are
 * heavily skewed: a few ZIPs hold extreme values that would flatten the rest of
 * the country into a single step. Quantiles keep the map readable, and the
 * legend prints the real boundaries so nothing is hidden by the binning.
 */
export function buildBins(values: readonly number[], ramp: readonly string[] = RAMP): Bin[] {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (clean.length === 0) return []

  return ramp.map((color, i) => ({
    from: i === 0 ? clean[0]! : quantile(clean, (i - 1) / ramp.length),
    to: i === ramp.length - 1 ? null : quantile(clean, i / ramp.length),
    color,
    count: 0,
  }))
}

/** Finds the bin a value falls in, or null when it has no usable figure. */
export function binFor(bins: readonly Bin[], value: number | null | undefined): Bin | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  for (const bin of bins) {
    if (value >= bin.from && (bin.to === null || value < bin.to)) return bin
  }
  return null
}

export function formatValue(value: number, unit: string): string {
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'usd_monthly') return `$${Math.round(value).toLocaleString('en-US')}/mo`
  if (unit === 'usd') return `$${Math.round(value).toLocaleString('en-US')}`
  return Math.round(value).toLocaleString('en-US')
}
