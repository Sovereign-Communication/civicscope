/**
 * The country-wide screening table.
 *
 * This is the surface that makes a single request worth it: the entire country
 * is already in memory, so sorting and filtering are local operations with no
 * further requests and no quota cost. The user chooses what to sort by and can
 * put any number of areas into the comparison set.
 *
 * Every column is sortable but nothing is pre-sorted into a "best" list, and no
 * cell recommends a place. The ordering is always something the user picked.
 *
 * The table is windowed rather than truncated. There are 33,791 rows, and the
 * earlier version drew the first 200 of whatever the current sort produced and
 * silently hid the other 33,591 — which meant a visitor who sorted by median
 * home value ascending saw the least expensive corner of the country and had no
 * way to reach the rest. Only the visible window is in the DOM; the caption and
 * the row count state the true total, and a screen reader is told how many rows
 * the table holds in total rather than only how many are mounted.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

import { absenceLabel, type AbsentReason, type AreaRow } from '../core/plugins/acs'

const num = new Intl.NumberFormat('en-US')

/**
 * A row's height in pixels, used to size the window.
 *
 * 46 rather than the 36 this was when a row held only a ZIP code. Each row now
 * carries the city beneath the code, so a row is two lines of text plus padding.
 * The window is arithmetic on this number — the scroll offset divided by it gives
 * the first visible row — so understating it does not merely look wrong, it
 * scrolls the wrong rows into view. Measured in the browser rather than
 * calculated from the font size.
 */
const ROW_HEIGHT = 46
/** Rows rendered above and below the viewport, so a fast scroll shows nothing blank. */
const OVERSCAN = 8
/**
 * How many rows to render per screen height.
 *
 * 30 rather than 60, because the container is 560px tall and a row is now 46px:
 * 30 rows is still roughly four screens of scroll, which is what the overscan
 * exists to cover.
 */
const WINDOW_SIZE = 30

const COLUMNS = [
  { key: 'zcta', label: 'ZIP & location', sort: null },
  { key: 'median_rent_burden_pct', label: 'Rent burden', sort: 'median_rent_burden_pct' as const },
  { key: 'median_gross_rent', label: 'Median rent', sort: 'median_gross_rent' as const },
  { key: 'median_home_value', label: 'Home value', sort: 'median_home_value' as const },
  { key: 'median_household_income', label: 'Median income', sort: 'median_household_income' as const },
  { key: 'households', label: 'Households', sort: 'households' as const },
] as const

const UNIT_OF: Record<string, string> = {
  median_rent_burden_pct: 'percent',
  median_gross_rent: 'usd_monthly',
  median_home_value: 'usd',
  median_household_income: 'usd',
  households: 'count',
  population: 'count',
}

/**
 * Formats a margin of error, or returns null when there is nothing to show.
 *
 * Separate from `fmt` on purpose. `fmt` is the display formatter and returns the
 * absent label for anything it will not vouch for, which is right for a figure
 * and wrong for a margin: a rent-burden margin is routinely larger than 100
 * points, so routing it through `fmt` produced a literal "+/- not yet imported"
 * beside a perfectly valid 9%. A margin is also not a currency or a percentage
 * in its own right, so it carries no unit suffix either.
 */
function fmtMargin(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  if (value === 0) return '0'
  return num.format(Math.round(value))
}
  function fmt(value: number | null, unit: string, reason?: AbsentReason): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    // "Not yet imported" implied a queue: that the figure exists and has not
    // arrived, so waiting would help. An audit of all 33,791 areas found every
    // absence in the country is "not applicable" — a ZIP code with no rental
    // units has no median rent — and no amount of importing will change that.
    return reason ? absenceLabel(reason) : 'not yet imported'
  }
  // A percentage cannot exceed 100. When the publisher nevertheless returns
  // one, the data has arrived and cannot be shown, so it is labelled as
  // out of range rather than as still loading. Falling through to "not yet
  // imported" here is how the phrase kept surviving on a fully loaded map.
if (unit === 'percent' && value > 100) return absenceLabel(reason ?? 'out-of-range')
  if (unit === 'usd_monthly') return `${usd.format(value)}/mo`
  if (unit === 'usd') return usd.format(value)
  return num.format(value)
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function SweepTable({
  rows,
  onAdd,
  selectedZctas,
  initialSort,
  placeLabel,
}: {
  rows: AreaRow[]
  onAdd: (zcta: string) => void
  selectedZctas: string[]
  initialSort: (typeof COLUMNS)[number]['sort']
  /**
   * `"Austin, TX"` for a ZIP code, or null when the mapping is unavailable.
   *
   * Null is passed through and rendered as nothing rather than as a placeholder,
   * because the alternative is a column of dashes down 33,791 rows saying "not
   * yet imported" about a figure that is simply not part of the ACS row.
   */
  placeLabel?: (zip: string) => string | null
  visibleCount?: number
  totalCount?: number
  onShowMore?: () => void
}) {
  const [sortKey, setSortKey] = useState<(typeof COLUMNS)[number]['sort']>(initialSort)
  const [asc, setAsc] = useState(true)
  const [filter, setFilter] = useState('')
  const [start, setStart] = useState(0)
  const scroller = useRef<HTMLDivElement | null>(null)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const arr = [...rows]
    // Rows missing the sort metric always sort last, in either direction. Without
    // this, a column whose absent values were briefly numeric put every
    // missing row at the top, which is what put ZIPs with no renter households
    // above the list.
    arr.sort((a, b) => {
      const av = a.metrics[sortKey] ?? null
      const bv = b.metrics[sortKey] ?? null
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return asc ? av - bv : bv - av
    })
    return arr
  }, [rows, sortKey, asc])

  const visible = useMemo(() => {
    const f = filter.trim()
    if (!f) return sorted
    return sorted.filter((r) => r.zcta.startsWith(f) || r.name.toLowerCase().includes(f.toLowerCase()))
  }, [sorted, filter])

  // Any change to which rows are shown has to return the reader to the top.
  // Keeping the old offset would leave them looking at row 20,000 of a
  // different ordering, which reads as the sort having done nothing.
  useEffect(() => {
    setStart(0)
    if (scroller.current) scroller.current.scrollTop = 0
  }, [sortKey, asc, filter])

  // The window is derived from the scroll offset held in state, rather than
  // read from the node during render: reading `scrollTop` while rendering is
  // not reactive and would produce a window that disagrees with the scrollbar.
  const from = Math.max(0, start)
  const to = Math.min(visible.length, from + WINDOW_SIZE + OVERSCAN * 2)
  const window = visible.slice(from, to)

  function header(col: (typeof COLUMNS)[number]) {
    if (!col.sort) {
      return <th scope="col" className="px-3 py-2 text-left text-[0.8125rem] font-semibold text-slate-700">{col.label}</th>
    }
    const active = sortKey === col.sort
    return (
      <th scope="col" className="px-3 py-2 text-right text-[0.8125rem] font-semibold text-slate-700" aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => {
            if (active) setAsc((a) => !a)
            else {
              setSortKey(col.sort)
              setAsc(true)
            }
          }}
          className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          {col.label}
          <span aria-hidden="true" className="text-slate-400">{active ? (asc ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="zip-filter" className="text-sm font-medium text-slate-800">
            Filter ZIP codes
          </label>
          <input
            id="zip-filter"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            placeholder="787"
            className="mt-1 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
        </div>
        <p className="text-xs text-slate-600">
          {num.format(visible.length)} of {num.format(sorted.length)} ZIP codes shown. Select areas to compare
          them side by side.
        </p>
      </div>

      {/*
        A scroll container of fixed height with a spacer of the full list height,
        and the window translated into place. The table element keeps real
        semantics, so a screen reader still reads a table with a header row and
        row headers; only the number of mounted rows is bounded.
      */}
      <div
        ref={scroller}
        onScroll={(e) => setStart(Math.floor((e.target as HTMLDivElement).scrollTop / ROW_HEIGHT) - OVERSCAN)}
        className="mt-3 max-h-[560px] overflow-auto panel"
      >
        <table className="w-full text-left text-sm">
          <caption className="px-3 py-2 text-left text-xs text-slate-600">
            US ZIP code tabulation areas, American Community Survey 5-year estimates. The table holds{' '}
            {num.format(visible.length)} areas in total and is scrolled rather than truncated, so every ZIP
            code is reachable. Every column is sortable; no ordering is recommended.
          </caption>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
            <tr>
              {COLUMNS.map((c) => header(c))}
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          {/*
            `aria-rowcount` and the spacer rows give assistive technology the
            real size of the set, so "33,791 rows" is not silently reduced to
            "60 rows" by the windowing.
          */}
          <tbody aria-rowcount={visible.length}>
            {start > 0 ? (
              <tr aria-hidden="true" style={{ height: start * ROW_HEIGHT }}>
                <td colSpan={COLUMNS.length + 1} />
              </tr>
            ) : null}
            {window.map((r) => {
              const isSelected = selectedZctas.includes(r.zcta)
              return (
                <tr key={r.zcta} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/60" style={{ height: ROW_HEIGHT }}>
                  {/*
                    The city sits in the same cell as the ZIP code rather than in
                    a column of its own. A 33,791-row table already scrolls
                    sideways on a phone, and the two fields are read together every
                    time, so separating them doubles the width for no gain.
                  */}
                  <th scope="row" className="px-3 py-1.5 text-left text-[0.8125rem] font-medium text-slate-900">
                    <span className="block font-mono tabular-nums">{r.zcta}</span>
                    {placeLabel?.(r.zcta) && (
                      <span className="block text-[0.6875rem] font-normal not-italic text-slate-500">
                        {placeLabel(r.zcta)}
                      </span>
                    )}
                  </th>
                  {COLUMNS.filter((c) => c.sort).map((c) => {
                    const value = r.metrics[c.sort!] ?? null
                    const marginText = fmtMargin(r.moes?.[c.sort!] ?? null)
                    return (
                      <td key={c.key} className="px-3 py-1.5 text-right text-[0.8125rem] tabular-nums text-slate-700">
                        {fmt(
                          value,
                          UNIT_OF[c.sort!] ?? 'count',
                          r.absent?.[c.sort!] ?? (value !== null && value > 100 ? 'out-of-range' : undefined),
                        )}
                        {/*
                          The margin is rendered beside the figure rather than in
                          a separate column, because a survey estimate without
                          its precision attached is the thing this app exists to
                          avoid. It only appears when the publisher supplies one.
                        */}
                        {marginText !== null && value !== null ? (
                          <span
                            className="ml-1 text-[0.6875rem] tabular-nums text-slate-500"
                            title={`Margin of error plus or minus ${marginText}`}
                          >
                            &plusmn;{marginText}
                          </span>
                        ) : null}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onAdd(r.zcta)}
                      disabled={isSelected}
                      className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
                    >
                      {isSelected ? 'Added' : 'Compare'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {to < visible.length ? (
              <tr aria-hidden="true" style={{ height: (visible.length - to) * ROW_HEIGHT }}>
                <td colSpan={COLUMNS.length + 1} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
