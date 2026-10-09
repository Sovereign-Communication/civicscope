import { registry } from '../core/useHousingQuery'
import { SCORE_RULES, SCORE_VERSION } from '../core/scoring'
import { CENSUS_ATTRIBUTION } from '../core/censusKey'
import { METRIC_DEFS_BY_KEY, METRIC_KEYS, tableOfMetric, VINTAGE } from '../core/plugins/acs'
import { isSortableMetricKey } from '../core/sortable-surface'

/**
 * The methodology page is generated from the plugin registry and the scoring
 * rules rather than written by hand. That is deliberate: in a project whose
 * entire value proposition is that its numbers are auditable, documentation
 * that can silently drift out of date with the code is worse than no
 * documentation at all.
 */
export function Methodology() {
  const plugins = registry.all()
  const byCategory = new Map<string, typeof plugins>()
  for (const p of plugins) {
    const list = byCategory.get(p.category) ?? []
    list.push(p)
    byCategory.set(p.category, list)
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-title">
          How CivicScope works
        </h2>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            CivicScope fetches data directly from its publishers in your browser. There is no server between you
            and the source, no database of our own, and no record of what you searched for. That is a technical
            decision with a purpose: an operator that cannot see who searched where cannot deliver different
            results to different people.
          </p>
          <p>
            We show three things for every figure: the value, its margin of error where the publisher supplies
            one, and the exact dataset, table, and query it came from. If a number here is wrong, you can fetch
            the original and check.
          </p>
          <p>
            We publish our scoring weights rather than hiding them. School funding and neighbourhood
            demographics are correlated in the United States, and any index that uses one implies something
            about the other. We would rather state that openly than present a composite as if it were an
            objective verdict on a place.
          </p>
        </div>
      </section>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="section-title">
          What we collect
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            <strong>Nothing</strong>, unless you choose to add a Census API key. That key is stored in your
            browser&rsquo;s local storage and is transmitted only to Census.gov.
          </li>
          <li>No accounts, no analytics, no advertising, no third-party scripts, no cookies.</li>
          <li>Fetched data is cached in your browser so pages load quickly and work offline. Clear it any time.</li>
        </ul>
      </section>

      <section aria-labelledby="stewardship-heading">
        <h2 id="stewardship-heading" className="section-title">
          Who owns this
        </h2>
        <p className="section-note mt-2">
          Nobody, in the sense that matters operationally: there is no company behind this, nobody is paid to
          work on it, and there is no way for anyone to buy a better result. It carries no advertising, no
          referral fees and no paid placement.
        </p>
        <p className="section-note mt-2">
          Three things are true and worth stating plainly rather than glossing. The repository sits in a GitHub
          organisation, which is an organisation that can delete it, so it is not unowned in the strict sense.
          Donations are possible, but they go to a person&rsquo;s accounts rather than to a collective, so the
          money is personal property and the balance is not public. And nothing here is funded, so nothing here
          is guaranteed &mdash; a source can change and the maintainer can stop.
        </p>
        <p className="section-note mt-2">
          What survives all of that is the part that matters for your trust in a number: every figure here is
          fetched from its publisher directly by your browser, and can be re-fetched independently to check it.
          The full position, including what would have to change for the claim to be stronger, is in{' '}
          <code>docs/governance.md</code> in the source repository.
        </p>
      </section>

      {/*
        The figure dictionary. Generated from METRIC_DEFS_BY_KEY at render, not
        written by hand, so a metric cannot appear in the app without appearing
        here and cannot be described here except by its own registry entry. The
        sortable column is derived from the same allowlist the sort controls are
        typed against, which is the mechanism that keeps a demographic figure
        from ever becoming an ordering control — the one thing this table must
        be able to state truthfully.
      */}
      <section aria-labelledby="figures-heading">
        <h2 id="figures-heading" className="section-title">
          Every figure, and what it means
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Every figure this tool shows, from the American Community Survey {VINTAGE} 5-year estimates. Generated from
          the same registry the application renders from, so this list cannot drift from what is on screen. You can
          sort the screening table by five of these figures; the rest are shown for reading only, because ordering
          places by the age or education of the people in them would be this tool ranking neighbourhoods by who
          lives there.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="px-3 py-2 text-left text-xs text-slate-600">
            {METRIC_KEYS.length} figures, each with the Census table it comes from. Any number can be re-fetched from
            that table and checked.
          </caption>
          <thead className="border-b border-slate-200">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700">Figure</th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700">What it measures</th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700">Table</th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700">Sortable</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_KEYS.map((key) => {
              const def = METRIC_DEFS_BY_KEY.get(key)
              if (!def) return null
              const sortable = isSortableMetricKey(key)
              return (
                <tr key={key} className="border-b border-slate-100 align-top">
                  <th scope="row" className="px-3 py-2 font-medium text-slate-900">
                    {def.label}
                  </th>
                  <td className="px-3 py-2 text-slate-700">{def.note}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{tableOfMetric(key) ?? 'ACS'}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {sortable ? 'Yes, you choose the order' : 'No, reading only'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="data-heading">
        <h2 id="data-heading" className="section-title">
          Data sources
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Every source currently registered, grouped by the kind of question it answers. Adding a source adds it
          here automatically.
        </p>
        <div className="mt-3 space-y-4">
          {[...byCategory.entries()].map(([category, list]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold capitalize text-slate-800">{category}</h3>
              <ul className="mt-1 space-y-2">
                {list.map((p) => (
                  <li key={p.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-medium text-slate-900">{p.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Geography: {p.geography} · Appears from depth {p.minZoom} and deeper
                      {p.requiresCensusKey ? ' · requires a Census key' : ' · no key required'}
                    </p>
                    {p.legal.notice && <p className="mt-1 text-xs italic text-slate-600">{p.legal.notice}</p>}
                    {p.legal.suppressBelow !== undefined && (
                      <p className="mt-1 text-xs text-slate-600">
                        Figures below {p.legal.suppressBelow} in a count unit are withheld to protect
                        small-population privacy.
                      </p>
                    )}
                    {p.legal.protectedClassProxy && (
                      <p className="mt-1 text-xs font-medium text-slate-700">
                        Describes area composition. Shown for context and never used to rank or filter.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="scoring-heading">
        <h2 id="scoring-heading" className="section-title">
          How the indices are calculated
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Version {SCORE_VERSION}. Each component is scaled to 0&ndash;100 against a stated range and combined
          by weight. Components that are unavailable are dropped and the remaining weights are renormalised, so
          the index always states which inputs it actually used.
        </p>
        <div className="mt-3 space-y-4">
          {(
            [
              ['Affordability', SCORE_RULES.affordability],
              // There was an education composite here. It is gone, and the
              // reason is on the page rather than in a commit message nobody
              // reads: its spending component never existed — the NCES layer
              // publishes no finance field, and the metric carried a teacher
              // count under a dollars label, which scored every district in the
              // country exactly 40. It returns when a real finance source is
              // wired in.
            ] as const
          ).map(([label, rules]) => (
            <div key={label} className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <caption className="px-3 pt-2 text-left text-xs text-slate-600">{label} index components</caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-3 py-2 font-semibold text-slate-800">Component</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-slate-800">Weight</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-slate-800">Range</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-slate-800">Higher is</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100 align-top">
                      <th scope="row" className="px-3 py-2 font-normal text-slate-800">
                        {r.label}
                        <span className="mt-0.5 block text-xs text-slate-500">{r.note}</span>
                      </th>
                      <td className="px-3 py-2 tabular-nums text-slate-700">{Math.round(r.weight * 100)}%</td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {r.floor.toLocaleString('en-US')} to {r.ceiling.toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.betterWhen === 'higher' ? 'better' : 'worse'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-700">
          These ranges describe the plausible span of values across US areas. They are not national averages,
          because computing against a national distribution would require holding national data in your
          browser, which is the thing this design avoids. Compare indices within one search, not across
          unrelated ones.
        </p>
      </section>

      <section aria-labelledby="fair-heading">
        <h2 id="fair-heading" className="section-title">
          Fair housing commitments
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          <li>
            We never filter, sort, or rank by race or ethnicity. Area composition is shown as context, in its
            own section, and is excluded from both indices.
          </li>
          <li>
            We never show a ranked list of neighbourhoods, and we never tell you which place is best. You choose
            the criteria; we show the numbers.
          </li>
          <li>
            We take no advertising, no referral fees, and no payment for placement. There is nothing to sell and
            no service to withhold, so there is no allocation for us to make.
          </li>
          <li>
            We use the coarsest geography the data supports, withhold small counts, and publish margins of
            error.
          </li>
          <li>
            We publish our weights, our sources, and the known correlation between school funding and area
            demographics.
          </li>
        </ul>
      </section>

      <section aria-labelledby="attr-heading">
        <h2 id="attr-heading" className="section-title">
          Attribution
        </h2>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          <p>{CENSUS_ATTRIBUTION}</p>
          <p>
            Contains information from the U.S. Department of Education&rsquo;s NCES Common Core of Data and
            from the CDC PLACES programme.
          </p>
          <p>
            Geocoding by{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-800 underline"
            >
              OpenStreetMap
            </a>{' '}
            contributors, available under the Open Database License.
          </p>
        </div>
      </section>
    </div>
  )
}
