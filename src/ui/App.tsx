import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHousingQuery } from '../core/useHousingQuery'
import { loadPlaceIndex, type PlaceIndex, type PlaceSuggestion } from '../core/zcta-place-index'
import { FairHousingNotice } from './FairHousingNotice'
import { KeyPrompt } from './KeyPrompt'
import { Methodology } from './Methodology'
import { SearchAutocomplete } from './SearchAutocomplete'
import { CityZipBrowser } from './CityZipBrowser'
import { SweepTable } from './SweepTable'
import { Comparison } from './Comparison'
import { FundingSection } from './Funding'
import { StateFilter } from './StateFilter'
import { MapView } from './MapView'

type View = 'explore' | 'map' | 'methodology'

/**
 * Screening presets.
 *
 * A preset is a named, published filter configuration the user chooses. It
 * changes which criterion the country-wide screen sorts by; it never changes
 * the underlying data, and every figure remains visible. We do not rank places
 * or declare a best option â€” the user picks the criteria and the ordering.
 */
const PRESETS = [
  { id: 'renter', label: 'Renting', sort: 'median_rent_burden_pct' as const },
  { id: 'cheap', label: 'Cheapest rent', sort: 'median_gross_rent' as const },
  { id: 'income', label: 'Higher income', sort: 'median_household_income' as const },
  { id: 'scale', label: 'Most households', sort: 'households' as const },
]

const DEFAULT_PRESET = PRESETS[0]!

const num = new Intl.NumberFormat('en-US')

/** The ACS release the cached figures come from, so a cached number is never read as current. */
const VINTAGE_LABEL = '2023 5-year release'

export default function App() {
  const [view, setView] = useState<View>('explore')
  const [term, setTerm] = useState('')
  const [preset, setPreset] = useState<string>('budget')
  const [showKeyPrompt, setShowKeyPrompt] = useState(false)
  const [chosenPlace, setChosenPlace] = useState<PlaceSuggestion | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)
  /**
   * `undefined` means still loading; `null` means it could not be fetched.
   *
   * The distinction is kept because they need different copy. While loading, the
   * combobox simply offers nothing yet. Once failed, the reader is told city
   * search is unavailable rather than left waiting for suggestions that will
   * never arrive â€” and ZIP lookup keeps working either way.
   */
  const [placeIndex, setPlaceIndex] = useState<PlaceIndex | null | undefined>(undefined)
  const statusRef = useRef<HTMLParagraphElement>(null)

  const q = useHousingQuery()

  /**
   * Fetches the ZIP-to-place mapping once, on mount.
   *
   * It is ~187 kB gzipped and served from `/map/` under an immutable year-long
   * header, so this costs one request the first visit and nothing thereafter. It
   * is fetched eagerly rather than on first keystroke because the screening table
   * shows the city beside every ZIP code, and a column that fills in a second
   * after the table appears is worse than one that was simply never available.
   */
  useEffect(() => {
    let cancelled = false
    void loadPlaceIndex().then((index) => {
      if (!cancelled) setPlaceIndex(index)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const searchPlacesIn = useCallback(
    (query: string, limit?: number) => (placeIndex ? placeIndex.search(query, limit) : []),
    [placeIndex],
  )

  /** `"Austin, TX"` for a ZIP code, or null when the mapping is unavailable. */
  const placeLabel = useCallback(
    (zip: string) => placeIndex?.label(zip) ?? null,
    [placeIndex],
  )

  /** Adds one ZIP code, resolving its city for the header when we have one. */
  const addZip = useCallback(
    (zip: string) => {
      const place = placeIndex?.lookup(zip)
      void q.selectPlace({ name: place?.displayName ?? `ZIP ${zip}`, zip, state: place?.state })
    },
    [placeIndex, q],
  )

  /**
   * Submits the search box.
   *
   * A five-digit code is a direct lookup. Anything else is resolved against the
   * mapping, and the result is a list of ZIP codes to choose from rather than one
   * area picked for the reader: "Springfield" is a city in at least six states,
   * and silently choosing one would put the wrong neighbourhood on screen with no
   * indication that a choice had been made. Previously this path asked Photon,
   * which returned a single city centroid with no ZIP at all â€” and `selectPlace`
   * returns immediately without one, so clicking that suggestion did nothing.
   */
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = term.trim()
    if (!text) return
    setPlaceError(null)

    if (/^\d{5}$/.test(text)) {
      setChosenPlace(null)
      void q.search(text)
      return
    }

    if (!placeIndex) {
      setPlaceError(
        'City search is not available right now, because the ZIP-to-city list could not be loaded. A five-digit ZIP code still works.',
      )
      return
    }

    const matches = placeIndex.search(text, 8)
    if (matches.length === 0) {
      setChosenPlace(null)
      setPlaceError(
        `No US city or ZIP code matches "${text}". This tool covers United States data only â€” there are about 33,800 ZIP codes.`,
      )
      return
    }
    // One match is still shown as a list rather than opened directly, because the
    // reader may want a specific ZIP code inside it.
    setChosenPlace(matches[0]!)
    if (matches.length > 1) {
      setTerm('')
    }
  }

  // Announce async state to assistive technology. With a sweep of ~41,000 rows
  // the loading transition is substantial, and silence here would strand a
  // screen-reader user.
  useEffect(() => {
    const el = statusRef.current
    if (!el) return
    if (q.sweepStatus === 'loading') {
      const p = q.sweepProgress
      el.textContent = p
        ? `Loading ${p.scope}: ${p.done} of ${p.total} areas, ${num.format(p.rows)} ZIP codes so far.`
        : 'Loading housing data for ZIP codes.'
    } else if (q.sweepStatus === 'ready')
      el.textContent = `Loaded ${num.format(q.sweep.length)} ZIP codes${q.sweepScope.length ? '' : ' for the whole country'}.`
    else if (q.sweepStatus === 'needs-key') el.textContent = 'A free Census key is needed to load the data.'
    else if (q.sweepStatus === 'error') el.textContent = q.sweepError ?? 'Could not load the data.'
    else if (q.status === 'error') el.textContent = q.error ?? 'Something went wrong.'
  }, [
    q.sweepStatus,
    q.sweep.length,
    q.sweepError,
    q.sweepScope.length,
    q.sweepProgress?.done,
    q.sweepProgress?.total,
    q.sweepProgress?.rows,
    q.sweepProgress?.scope,
    q.status,
    q.error,
  ])


  // Affordability screen, derived from the sweep. This is the "check every ZIP
  // code for one aspect" capability: the whole country is already in memory, so
  // a filter is a local operation and costs nothing.
  const activePreset = PRESETS.find((p) => p.id === preset) ?? DEFAULT_PRESET

  const sweepRows = useMemo(() => {
    if (q.sweep.length === 0) return []
    const key = activePreset.sort
    // Every loaded ZIP is kept, including those with no figure for this
    // column. Filtering them out here used to hide about 7,290 of the 33,791 ZIP
    // codes from the screening table whenever a sparse column was chosen, which
    // reads as "this area does not exist" rather than "no estimate published" â€”
    // the one confusion this app exists to avoid. Absent figures now render as
    // "not yet imported" and sort last, which is what they mean.
    return [...q.sweep].sort((a, b) => {
      const av = a.metrics[key] ?? null
      const bv = b.metrics[key] ?? null
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return av - bv
    })
  }, [q.sweep, activePreset.sort])

  /**
   * The lookup form and the Census key prompt.
   *
   * Shared by Explore and Map rather than duplicated, because a visitor who
   * opens the map and then wants to compare a specific ZIP has to be able to
   * search from there. Two copies of a search box that subtly drift apart is a
   * worse bug than one shared component.
   */
  const searchPanel = (
    <>
      <section aria-labelledby="search-heading" className="panel panel-padded">
        <h2 id="search-heading" className="text-sm font-semibold text-slate-900">
          Look up a ZIP code or a city
        </h2>
        <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
          <label htmlFor="place" className="sr-only">
            US ZIP code, or city and state
          </label>
          {/*
            The input is a combobox and owns the suggestion relationship itself, so
            the autocomplete component renders it. `role="combobox"`,
            `aria-expanded` and `aria-activedescendant` all live on the field,
            which is what keeps focus in the text box while a virtual cursor
            moves through the options.
          */}
          <SearchAutocomplete
            value={term}
            onChange={setTerm}
            onChoose={(place) => {
              setPlaceError(null)
              setChosenPlace(place)
            }}
            loading={placeIndex === undefined}
            search={searchPlacesIn}
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            Add to comparison
          </button>
        </form>

        <p className="mt-2 text-xs text-slate-600">
          A five-digit ZIP code goes straight to that area. A city name offers every ZIP code inside it, so you can
          pick the neighbourhood rather than whichever one comes first.
        </p>

        {placeError && (
          <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            {placeError}
          </p>
        )}

        {chosenPlace && (
          <CityZipBrowser
            place={chosenPlace}
            selectedZctas={q.selectedZctas}
            onAdd={(zip) => addZip(zip)}
            onDismiss={() => setChosenPlace(null)}
          />
        )}

        <p ref={statusRef} role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-700" />

        {q.status === 'error' && (
          <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-900" role="alert">
            {q.error}
          </p>
        )}
      </section>

      {q.sweepStatus === 'needs-key' && !showKeyPrompt && (
        <button
          type="button"
          onClick={() => setShowKeyPrompt(true)}
          className="mt-4 w-full rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
        >
          <span className="font-semibold text-amber-950">Load every ZIP code in the country â€” free.</span>
          <span className="mt-1 block text-amber-900">
            The Census Bureau requires a free API key so they can track usage. It takes about a minute, and your
            key is stored only in this browser. We never see it and keep no record of your searches.
          </span>
        </button>
      )}

      {showKeyPrompt && (
        <div className="mt-4">
          <KeyPrompt onDismiss={() => setShowKeyPrompt(false)} />
        </div>
      )}
    </>
  )

  /*
   * The shell.
   *
   * The header is sticky and translucent with a backdrop blur, so the view
   * switcher is reachable without scrolling back up through a full-country
   * table. The wordmark is set larger and tighter than the strapline, and the
   * strapline is de-emphasised, because the product name is the only thing on
   * the line that is not descriptive.
   *
   * The nav contract is unchanged deliberately: the buttons keep their labels,
   * their `aria-current`, and their order, because the accessibility suite and
   * the gate both select on them.
   */
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-[1.375rem] font-semibold tracking-tight text-slate-900">CivicScope</h1>
            <p className="text-[0.8125rem] leading-snug text-slate-600">
              Every ZIP code in the US, from federal data, in your browser.
            </p>
          </div>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(
                [
      ['explore', 'Explore'],
      ['map', 'Map'],
      ['methodology', 'Methodology'],
                ] as const
              ).map(([id, label]) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setView(id)}
                    aria-current={view === id ? 'page' : undefined}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      view === id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        {view === 'methodology' ? (
          <Methodology />
        ) : view === 'map' ? (
          <>
            {searchPanel}

            {q.sweepStatus === 'needs-key' ? (
              <p className="mt-6 text-sm text-slate-700">
                Add a free Census key above to load every ZIP code, then the map draws them.
              </p>
            ) : q.sweep.length === 0 ? (
              <p className="mt-6 text-sm text-slate-700" role="status" aria-live="polite">
                Loading the country-wide figures the map draws fromâ€¦
              </p>
            ) : (
              <>
                <MapView
                  rows={q.sweep}
                  loading={(q.sweepProgress?.done ?? 0) < (q.sweepProgress?.total ?? 0)}
                  selectedZctas={q.selectedZctas}
                  onSelect={(zctas) => {
                    for (const zcta of zctas.slice(0, 6)) {
                      const row = q.sweep.find((r) => r.zcta === zcta)
                      if (row) void q.selectPlace({ name: row.name, zip: zcta })
                    }
                  }}
                />

                <Comparison drilldowns={q.drilldowns} onDeselect={q.deselect} placeLabel={placeLabel} />

                {q.sweepFromCache && (
                  <p className="mt-2 text-xs text-slate-500">
                    Loaded from this browser&rsquo;s local cache. Figures come from the American Community
                    Survey {VINTAGE_LABEL} and update annually; use Refresh in the cache panel to re-fetch.
                  </p>
                )}
              </>
            )}

            {q.selected.length > 0 && <FundingSection />}
            {q.selected.length > 0 && (
              <div className="mt-8">
                <FairHousingNotice />
              </div>
            )}
          </>
        ) : (
          <>
            {searchPanel}
            {q.sweepStatus === 'needs-key' && !showKeyPrompt && (
              <section className="mt-4 panel panel-padded">
                <h2 className="text-sm font-semibold text-slate-900">What you can do without a key</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Add a ZIP code above to see its detail. Geocoding, census-tract boundaries, school district
                  funding, and health measures all work without a key; the full country-wide screen needs one.
                </p>
                <FundingSection />
              </section>
            )}

            {q.sweepStatus === 'idle' && q.censusKeyPresent && (
              <div className="mt-4">
                <StateFilter
                  options={q.stateChoices}
                  selected={q.stateScope}
                  onToggle={q.toggleState}
                  onClear={() => q.setStateScope([])}
                  onApply={() => void q.applyScope(q.stateScope)}
                  totalChunks={q.totalChunks}
                  scopeChunks={q.scopeChunks}
                  busy={false}
                />
              </div>
            )}
            {q.sweepStatus === 'loading' && (
              <section className="mt-4 panel panel-padded" role="status" aria-busy="true">
                <h2 className="text-sm font-semibold text-slate-900">
                  Loading {q.sweepProgress?.scope ?? 'housing data'}
                </h2>
                {q.sweepProgress ? (
                  <>
                    {/* aria-busy above tells assistive tech the region is
                        still updating; the bar is decorative, the text
                        carries the actual state. */}
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-slate-900 transition-[width] duration-300"
                        style={{
                          width: `${q.sweepProgress.total ? Math.round((q.sweepProgress.done / q.sweepProgress.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="section-note mt-2">
                      {q.sweepProgress.done} of {q.sweepProgress.total} areas Â·{' '}
                      {num.format(q.sweepProgress.rows)} ZIP codes ready
                      {q.sweepProgress.failed > 0 && ` Â· ${q.sweepProgress.failed} failed`}
                    </p>
                    {q.sweepProgress.budget && (
                      <p className="mt-1 text-xs text-slate-500">
                        {q.sweepProgress.budget.remaining} of {q.sweepProgress.budget.limit} requests left
                        today. Areas already loaded are cached, so returning to this page costs nothing.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-700">Working out which areas to loadâ€¦</p>
                )}
                <p className="section-note mt-2">
                  <strong>You do not have to wait.</strong> Look up a ZIP code above and you will get its full
                  figures immediately â€” that request is separate and takes a couple of seconds.
                </p>
                {/*
                  The table is already usable while this runs, so the copy has to
                  say so rather than implying the page is blocked.
                */}
                <p className="mt-1 text-sm text-slate-700">
                  Rows appear below as each area loads; sorting and filtering work on what has arrived.
                </p>
              </section>
            )}

            {q.sweepStatus === 'error' && (
              <p className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-900" role="alert">
                The country-wide load failed: {q.sweepError}. Individual ZIP lookups still work.{' '}
                <button type="button" onClick={() => void q.loadSweep()} className="underline">
                  Try again
                </button>
              </p>
            )}

            {/* The screen appears as soon as the first chunk lands rather than
                after the last one. During a 43-chunk country-wide load this is
                the difference between a usable table after a second and a blank
                page for two minutes. */}
            {q.sweep.length > 0 && (
              <>
                <section aria-labelledby="screen-heading" className="mt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="screen-heading" className="section-title">
                      Screen every ZIP code
                    </h2>
                    <p className="text-xs text-slate-500">
                      {num.format(q.sweep.length)} areas loaded
                      {q.sweepFromCache ? ' from local cache' : ''} Â· {q.quota.used} request
                      {q.quota.used === 1 ? '' : 's'} from this browser
                    </p>
                  </div>

                  <fieldset className="mt-3">
                    <legend className="text-sm font-medium text-slate-800">Which aspect matters most?</legend>
                    <p className="mt-1 text-xs text-slate-600">
                      This selects the screening criterion. It never hides a figure and never changes the data.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PRESETS.map((p) => (
                        <label
                          key={p.id}
                          className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                            preset === p.id
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="preset"
                            value={p.id}
                            checked={preset === p.id}
                            onChange={() => setPreset(p.id)}
                            className="sr-only"
                          />
                          <span className="font-medium">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <SweepTable
                    rows={sweepRows}
                    initialSort={activePreset.sort}
                    onAdd={(zcta) => {
                      // Routed through addZip so the comparison header and the
                      // table row agree on the area's name. Previously each
                      // surface invented its own label from whatever it had to
                      // hand.
                      addZip(zcta)
                    }}
                    selectedZctas={q.selectedZctas}
                    placeLabel={placeLabel}
                  />
                </section>

                <Comparison drilldowns={q.drilldowns} onDeselect={q.deselect} placeLabel={placeLabel} />
              </>
            )}

            {q.sweep.length > 0 && (
              <>
                {/*
                  The figures are cached so a revisit is instant, which means a
                  number on screen may be days old. Saying so is the difference
                  between a cache that feels fast and one that misleads.
                */}
                {q.sweepFromCache && (
                  <p className="mt-2 text-xs text-slate-500">
                    Loaded from this browser&rsquo;s local cache. Figures come from the American Community
                    Survey {VINTAGE_LABEL} and update annually; use Refresh in the cache panel to re-fetch.
                  </p>
                )}
                {q.sweepError && (
                  <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="status">
                    {q.sweepError}
                  </p>
                )}
              </>
            )}

            {/* Detail for areas selected before a key was added. */}
            {q.selected.length > 0 && q.sweepStatus !== 'ready' && (
              <Comparison drilldowns={q.drilldowns} onDeselect={q.deselect} placeLabel={placeLabel} />
            )}

            {/*
              The Fair Housing notice is rendered unconditionally whenever
              neighbourhood data is on screen. It used to sit inside the
              "sweep loaded" branch, which meant it disappeared for exactly the
              visitors who had not yet added a Census key â€” the people least
              informed about how to read the figures. It is a legal disclosure,
              not a decoration, so its presence cannot depend on application
              state.
            */}
            {q.selected.length > 0 && <FundingSection />}

            {q.selected.length > 0 && (
              <div className="mt-8">
                <FairHousingNotice />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-slate-600">
          <p>
            CivicScope is free, open, and carries no advertising. It does not sell, broker, or refer listings
            and does not accept payment for placement in any result.
          </p>
          <p className="mt-2">
            Data is fetched directly from its publishers by your browser. We operate no server that records
            your searches, and we hold no copy of the data.
          </p>
          <p className="mt-2">
            This product uses the Census Bureau Data API but is not endorsed or certified by the Census
            Bureau. Geocoding by OpenStreetMap contributors (ODbL).
          </p>
        </div>
      </footer>
    </div>
  )
}

