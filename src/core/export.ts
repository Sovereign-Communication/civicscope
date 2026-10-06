/**
 * CSV export of the loaded screen.
 *
 * Why this exists at all, in an application whose whole position is that the
 * browser fetches everything from the publisher: a reader who has just paid 43
 * Census requests for the country cannot keep it. Closing the tab drops it, and
 * re-loading tomorrow means paying again once the cache expires. An export is the
 * difference between reading the data and being able to use it, and it costs no
 * server, no account and no new request — the rows are already in memory.
 *
 * Two decisions, both of which deviate from the plan on purpose:
 *
 * **Raw numbers, not formatted strings.** The plan asked for separate unit
 * columns (`rent` then `rent_unit = "USD"`); that duplicates a constant down
 * 33,791 rows to say something the header can say once. The header names carry
 * the unit instead — `median_gross_rent_usd_monthly` — and every cell is the
 * number the publisher published. A spreadsheet's job is formatting; shipping
 * pre-formatted strings means shipping `$1,234` that no tool can sort.
 *
 * **Missing values are empty cells, not "N/A".** The plan asked for N/A. Empty is
 * what a spreadsheet and every dataframe reader parse as missing; N/A forces the
 * column to text and silently breaks arithmetic on the values that are present.
 * The absence is not hidden — an empty cell in a CSV is the conventional, honest
 * representation of "the publisher published no value here", and the app itself
 * distinguishes the reasons in its own UI where there is room to.
 *
 * **Formula injection is treated as an attack.** Cell values here come from the
 * Census Bureau, so an attacker-controlled string is unlikely — but the city names
 * arrive via a baked file that a future contributor could regenerate from a
 * different source, and the export must not become the one place a spreadsheet
 * executes something. Any value beginning with `=`, `+`, `-`, `@`, a tab or a
 * carriage return is prefixed with an apostrophe, which every major spreadsheet
 * reads as literal text. This is the OWASP guidance for CSV, and the cost is zero
 * when nothing matches.
 */
import type { AreaRow } from './plugins/acs'

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r'])

/**
 * Escapes one CSV cell.
 *
 * Quotes only when needed — a quote, comma, newline or carriage return in the
 * value — because a file where every cell is quoted is 20% larger and no easier to
 * read. A leading apostrophe is added to formula-looking values *after* the
 * quoting decision, so the apostrophe is inside the quotes where it belongs.
 */
export function escapeCell(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value)
  const guarded = FORMULA_PREFIXES.has(value[0] ?? '') ? `'${value}` : value
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/** The columns, in order. Kept as data so the test can assert header and rows agree. */
export const COLUMNS = [
  { key: 'zcta', header: 'zcta' },
  { key: 'city', header: 'city' },
  { key: 'state', header: 'state' },
  { key: 'median_rent_burden_pct', header: 'median_rent_burden_pct_percent' },
  { key: 'median_gross_rent', header: 'median_gross_rent_usd_monthly' },
  { key: 'median_home_value', header: 'median_home_value_usd' },
  { key: 'median_household_income', header: 'median_household_income_usd' },
  { key: 'households', header: 'households_count' },
] as const

export interface ExportOptions {
  /** `"Austin, TX"` for a ZIP code, or null when the mapping is unavailable. */
  placeLabel?: (zip: string) => string | null
}

/**
 * Builds the CSV for the loaded rows.
 *
 * The rows arrive in whatever order the caller last sorted them, and the export
 * preserves that order deliberately: a person who sorted by rent before exporting
 * gets a file in that order, and the alternative — re-sorting here — would mean
 * this module owning a definition of "the right order", which is exactly the
 * ranking decision this application does not make.
 */
export function toCsv(rows: readonly AreaRow[], options: ExportOptions = {}): string {
  const header = COLUMNS.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((row) => {
    const label = options.placeLabel?.(row.zcta) ?? null
    // The place label is "Name, ST", so the comma is split into two columns
    // rather than escaping a comma into one cell — a city and its state are
    // separate fields to anyone loading this into a tool.
    const city = label ? label.split(', ')[0] ?? '' : ''
    const state = label ? label.split(', ')[1] ?? '' : ''

    const cells = COLUMNS.map((col) => {
      if (col.key === 'zcta') return escapeCell(row.zcta)
      if (col.key === 'city') return escapeCell(city)
      if (col.key === 'state') return escapeCell(state)
      const value = row.metrics[col.key] ?? null
      // null is an empty cell, not a zero and not a placeholder: the publisher
      // published no value, and writing anything else would invent one.
      return value === null ? '' : String(value)
    })
    return cells.join(',')
  })
  return [header, ...body].join('\r\n') + '\r\n'
}

/** A filename that names what it holds, without a timestamp nobody asked for. */
export const EXPORT_FILENAME = 'civicscope-zip-codes.csv'

/**
 * Triggers a download in the browser.
 *
 * A Blob URL rather than a data: URL, because a data URL of the country-wide
 * export is several megabytes of base64 built as one string, while a Blob streams.
 * The URL is revoked immediately after the click; the browser keeps its own
 * reference, and leaving it would leak on every export.
 */
export function downloadCsv(csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = EXPORT_FILENAME
  a.click()
  URL.revokeObjectURL(url)
}
