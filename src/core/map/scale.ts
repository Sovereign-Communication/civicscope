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

/**
 * A map figure.
 *
 * Most are a single cached ACS column. The rest are *derived*: arithmetic on
 * figures already held, so they cost no extra request and cannot introduce a
 * value the publishers did not supply. They exist because the questions people
 * actually ask when they are moving are not phrased in terms of a single ACS
 * variable. Nobody asks "what is B19013_001E here"; they ask "what can I afford
 * on what I earn", which is a ratio.
 */
export interface MapMetric {
  key: string
  label: string
  unit: string
  /** Which direction reads as the answer to the question. Never a judgement. */
  betterWhen: 'lower' | 'higher'
  /** Present only for derived figures; returns null when it cannot be formed. */
  derive?: (m: Record<string, number | null>) => number | null
  /** One line shown under the selector, saying what the figure is and is not. */
  blurb: string
}

/**
 * The figures offered on the map.
 *
 * Order matters: the ones people look for when moving come first.
 */
export const MAP_METRICS: MapMetric[] = [
  {
    key: 'median_rent_burden_pct',
    label: 'Rent burden',
    unit: 'percent',
    betterWhen: 'lower',
    blurb:
      'The published median of rent as a share of household income. Lower means rent takes a smaller share of what a household earns.',
  },
  {
    key: 'price_to_income',
    label: 'Home price vs income',
    unit: 'ratio',
    betterWhen: 'lower',
    blurb:
      'Median home value divided by median household income, as a plain multiple. 3 means a typical home costs three times the typical income; 6 means six times. This is arithmetic on two published figures, not a lending or valuation judgement.',
    derive: (m) => {
      const price = m.median_home_value
      const income = m.median_household_income
      if (price === null || price === undefined || income === null || income === undefined) return null
      if (income <= 0) return null
      return price / income
    },
  },
  {
    key: 'median_gross_rent',
    label: 'Median gross rent',
    unit: 'usd_monthly',
    betterWhen: 'lower',
    blurb: 'Median monthly gross rent for a unit, straight from the published estimate.',
  },
  {
    key: 'median_home_value',
    label: 'Median home value',
    unit: 'usd',
    betterWhen: 'lower',
    blurb: 'Median home value as published. A dollar figure, not an assessment or an offer.',
  },
  {
    key: 'median_household_income',
    label: 'Median household income',
    unit: 'usd',
    betterWhen: 'higher',
    blurb: 'Median household income as published, in the survey year.',
  },
  {
    key: 'rent_to_income',
    label: 'Annual rent vs income',
    unit: 'ratio',
    betterWhen: 'lower',
    blurb:
      'Twelve months of median gross rent divided by median household income. It is a gross ratio and sits beside the published rent burden rather than replacing it, because the published figure accounts for which households actually rent.',
    derive: (m) => {
      const rent = m.median_gross_rent
      const income = m.median_household_income
      if (rent === null || rent === undefined || income === null || income === undefined) return null
      if (income <= 0) return null
      return (rent * 12) / income
    },
  },
  {
    key: 'households',
    label: 'Households',
    unit: 'count',
    betterWhen: 'lower',
    blurb: 'Number of households, which is a measure of size rather than of quality.',
  },
]

export type MapMetricKey = string

/**
 * Sequential ramp, light to dark, in a single hue: higher values are darker.
 *
 * This was inverted at first and the inversion is worth recording, because it is
 * the kind of thing that looks deliberate and is simply wrong. Darker ink on a
 * pale background reads as MORE, everywhere a reader has seen a map before:
 * population choropleths, weather heatmaps, dark-mode interfaces. A ramp that
 * darkens toward the low end therefore draws the eye to the lowest values and
 * gives the reader the opposite of what they were expecting. The original
 * choice was made so that dark text would stay legible on a light fill, which
 * is a real concern for a labelled choropleth and irrelevant here, because most
 * hexagons carry no label.
 *
 * Every step keeps real chroma, including the palest, so no step can be
 * mistaken for the flat grey used for absent data. That collision is the cost
 * of flipping the ramp and it is why the pale end is a tinted blue rather than
 * the near-white it would otherwise be.
 */
export const RAMP = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e3a8a',
  '#172554',
]

/**
 * Absent data.
 *
 * A flat neutral grey with no blue in it at all, and lighter than every ramp
 * step, so "no figure" cannot be read as "a low figure". It is the only colour
 * on the map that is not in the blue family.
 */
export const NO_DATA_COLOR = '#e7e5e4'
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
  // A multiple, not a percentage. "3.1x" reads correctly as a ratio and cannot
  // be mistaken for three per cent, which matters because the derived figures
  // sit beside percentages on the same screen.
  if (unit === 'ratio') return `${value.toFixed(1)}x`
  return Math.round(value).toLocaleString('en-US')
}
