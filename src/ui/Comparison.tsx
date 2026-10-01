import { MetricCard } from './MetricCard'
import { CompositeCard } from './CompositeCard'
import type { DrillState } from '../core/useHousingQuery'

/**
 * Side-by-side comparison of the areas the user selected.
 *
 * The point of this surface is that the user assembled it. There is no
 * recommended ordering, no "winner", and no composite that implies one place is
 * better than another — the figures are laid out so the user can read across
 * and decide for themselves.
 */
export function Comparison({
  drilldowns,
  onDeselect,
}: {
  drilldowns: Record<string, DrillState>
  onDeselect: (zcta: string) => void
}) {
  const entries = Object.values(drilldowns)
  if (entries.length === 0) return null

  return (
    <section aria-labelledby="comparison-heading" className="mt-8">
      <h2 id="comparison-heading" className="section-title">
        Comparing {entries.length} {entries.length === 1 ? 'area' : 'areas'}
      </h2>

      <div className="mt-3 space-y-4">
        {entries.map((d) => (
          <article key={d.zcta} className="panel panel-padded">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  <span className="font-mono">{d.zcta}</span>
                  {d.label && <span className="ml-2 font-normal text-slate-600">{d.label}</span>}
                </h3>
                {d.loading && (
                  <p className="mt-1 text-sm text-slate-600" role="status">
                    Fetching detail…
                  </p>
                )}
                {d.error && (
                  <p className="mt-1 text-sm text-red-800" role="alert">
                    {d.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDeselect(d.zcta)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
              >
                Remove
              </button>
            </div>

            {d.composites.some((c) => c.score !== null) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.composites.map((c) => (
                  <CompositeCard key={c.id} composite={c} />
                ))}
              </div>
            )}

            {d.metrics.length > 0 && (
              <>
                <h4 className="mt-5 text-sm font-semibold text-slate-900">Every figure, unmodified</h4>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {d.metrics.map((m) => (
                    <MetricCard key={`${d.zcta}-${m.key}-${m.source.tableId}`} metric={m} />
                  ))}
                </div>
              </>
            )}

            {d.hasSchools && (
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <span className="font-medium text-slate-700">About school data here:</span> district funding
                and staffing figures cover all 50 states. Named-school detail — enrolment, graduation and
                attendance for individual schools — is available for{' '}
                <strong>New York</strong> so far, because no free licensed national source of per-school
                results exists and each state publishes its own data differently. A graduation rate is blank for
                schools that serve no graduating cohort, which means not applicable rather than poor.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
