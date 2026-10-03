import { absenceLabel, type AbsentReason } from '../core/plugins/acs'
import { useId, useState } from 'react'
import type { MetricValue } from '../core/types'

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/**
 * Renders a figure, or states plainly that there is none.
 *
 * The same guard as the screening table: a value that is absent, non-finite, or
 * implausibly large is described rather than displayed. The Census Bureau encodes
 * an absent estimate as a large negative number, and showing that as a figure
 * would be a confident lie rather than a placeholder.
 */


function isDisplayable(value: number | null, unit: MetricValue['unit']): boolean {
  if (value === null || !Number.isFinite(value) || value < 0) return false
  if (unit === 'percent' && value > 100) return false
  return true
}

/**
 * Formats a margin of error in the unit of the figure it belongs to.
 *
 * It used to be rendered as currency for anything that was not a percentage or
 * a ratio, so a count of renter-occupied units came out as "0 plus or minus $0"
 * — a dollar sign on a headcount. Percent and ratio carry no currency either,
 * and a plain count does not, so only the two monetary units get one.
 */
function formatMargin(moe: number, unit: MetricValue['unit']): string {
  if (unit === 'usd' || unit === 'usd_monthly') return usd.format(moe)
  return num.format(moe)
}

function format(m: MetricValue, reason?: AbsentReason): string {
  /*
   * The cause is shown when we have one. The panel this came from displayed
   * "not yet imported" beside four medians the Census Bureau had explicitly
   * marked not applicable, which told the reader the data was still on its way
   * when the publisher had said there is nothing to have. Verified against the
   * live endpoint: ZCTA 20771 returns -666666666 for every median and a real 0
   * for households, population and renter units. Both are facts about the area;
   * only one of them was being described correctly.
   */
  // "Not yet imported" is now only ever true when the figure genuinely has
  // not been loaded. A figure that arrived but cannot be shown, because the
  // publisher returned something outside the possible range, is labelled as
  // that instead.
  if (!isDisplayable(m.value, m.unit)) {
    // A value that arrived but cannot be shown is out of range, not unloaded.
    if (m.value !== null) return absenceLabel(reason ?? 'out-of-range')
    // Every drilldown source now runs automatically, so a null reaching here is
    // a value the publisher does not hold, not a request that has not been made.
    // The phrase was surviving on exactly this path: the school and health
    // plugins never set a reason, so their nulls fell back to it and read as a
    // queue for data that was never going to arrive.
    return absenceLabel(reason ?? 'missing')
  }
  const v = m.value as number
  switch (m.unit) {
    case 'usd':
      return usd.format(v)
    case 'usd_monthly':
      return `${usd.format(v)}/mo`
    case 'percent':
      return `${v}%`
    case 'ratio':
      return `${v}`
    case 'count':
      return v.toLocaleString('en-US')
    default:
      return String(v)
  }
}

/**
 * A single figure with its uncertainty and its provenance.
 *
 * Two rules are enforced structurally rather than by convention:
 *  - A margin of error is never hidden. If the source published one, it is
 *    rendered next to the value. Presenting a bare point estimate would
 *    misrepresent what survey data can support.
 *  - Every figure links to the exact table it came from, so any claim on this
 *    site can be independently re-fetched.
 */
export function MetricCard({ metric, notice }: { metric: MetricValue; notice?: string }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const moe = metric.quality.marginOfError

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-700">{metric.label}</h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {format(metric, metric.absentReason)}
            {moe !== undefined && isDisplayable(metric.value, metric.unit) && (
              <span className="ml-1 text-sm font-normal text-slate-500">
                ±{formatMargin(moe, metric.unit)}
              </span>
            )}
          </p>
        </div>
        {metric.quality.derived && (
          <span
            className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            title="Calculated by us from published data, not a figure the publisher released."
          >
            computed
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="mt-2 text-xs text-slate-600 underline hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
      >
        {open ? 'Hide detail' : 'Where this number comes from'}
      </button>

      {open && (
        <div id={panelId} className="mt-2 space-y-2 text-xs text-slate-600">
          {metric.note && <p className="text-slate-700">{metric.note}</p>}
          {metric.quality.derivation && (
            <p>
              <span className="font-medium">How we computed it: </span>
              {metric.quality.derivation}
            </p>
          )}
          {moe !== undefined && (
            <p>
              <span className="font-medium">Margin of error: </span>±
              {formatMargin(moe, metric.unit)} at the 90% confidence
              level, as published by {metric.source.publisher}.
            </p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-2">
            <dt className="font-medium">Source</dt>
            <dd>{metric.source.publisher}</dd>
            <dt className="font-medium">Dataset</dt>
            <dd>{metric.source.dataset}</dd>
            <dt className="font-medium">Table</dt>
            <dd className="font-mono">{metric.source.tableId}</dd>
            <dt className="font-medium">Vintage</dt>
            <dd>{metric.source.vintage}</dd>
          </dl>
          <a
            href={metric.source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-block font-mono break-all underline hover:text-slate-900"
          >
            {metric.source.citation ?? 'Open the original query'}
          </a>
        </div>
      )}

      {notice && <p className="mt-2 border-t border-slate-200 pt-2 text-xs italic text-slate-500">{notice}</p>}
    </div>
  )
}
