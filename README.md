# CivicScope

Free, auditable US housing and neighbourhood data. Fetches directly from the
publishers in your browser — no server, no database, no accounts, no ads, no
analytics.

## What this is

A public data tool for anyone looking at the US housing market: renters,
buyers, families, students, journalists, researchers, tenant organizers.

Every figure ships with three things attached:

1. **The value**
2. **Its margin of error**, where the publisher supplies one
3. **The exact dataset, table, and query** it came from

If a number here is wrong, you can fetch the original and check. That is the
whole premise.

## Architecture

```
Browser (the entire product)
  ├─ No runtime backend, no database, no user accounts, no search logging
  ├─ The user's own Census API key → localStorage, never sent to us
  ├─ Plugin registry: declarative (geography, requires, source, legal)
  ├─ DAG executor → request dedup + concurrent fan-out
  ├─ IndexedDB cache → source-TTL aware, survives reload, works offline
  ├─ Progressive loader: ZIP → tract → school district
  └─ Fail-soft: a dead source dims its panel, never the app
```

An operator that cannot see who searched where cannot deliver different results
to different people. That is a legal property, not just a cost saving.

## Data sources

| Metric | Source | Key needed |
|---|---|---|
| Rent, home value, income, rent burden, households, population | ACS 5-year via `api.census.gov` | user-supplied |
| ZIP boundaries and centroids | Census TIGERweb ArcGIS | no |
| ZIP geocoding | Census TIGERweb ZCTA layer | no |
| Health and access measures | CDC PLACES | no |
| School district funding and staffing | NCES EDGE boundaries ArcGIS | no |

**Per-school data: New York only, and the limit is structural.** The completion
gate identified school depth as the one materially unmet requirement, and it was
correct. What exists now:

- *All 50 states, district level, from NCES EDGE:* expenditure per pupil,
  students per teacher, enrollment, school count, grade span, locale, county.
- *New York, per school:* named schools within 3km of the ZIP centroid, with
  enrollment, graduation rate and attendance rate, from the NYSED school-level
  dataset on data.ny.gov. Verified live: keyless, `Access-Control-Allow-Origin: *`,
  with latitude and longitude per school.

The limit is not an oversight. The NCES EDGE ArcGIS catalogue publishes school
*districts* only — it was queried and has no school-level service — and there is
no free, licensed, national source of per-school test scores. Every other state
publishes its own assessment data in an incompatible format, and GreatSchools and
Niche ratings are licensed products whose terms do not permit this use. Each
further state is one plugin implementing `StateSchoolPlugin`;
`STATE_SCHOOL_PLUGINS` is the list, and a new state joins the drilldown
automatically.

Two things about that data are disclosed rather than smoothed over: a graduation
rate is blank for schools serving no graduating cohort, which means *not
applicable*, not poor; and attendance is not achievement. The drilldown panel says
so in words, and `STATE_ASSESSMENT_COVERAGE` records it in code.

One bug worth recording, because no type system would have caught it: Socrata
returns numeric fields as **strings**. `typeof latitude === 'number'` was false for
all 114 schools returned, so the entire result set was discarded and the plugin
silently returned nothing. Parsing is now explicit.

Two ACS table IDs were wrong at one point and produced confidently incorrect
figures. Verified against the live variables API:

| Metric | Table | Trap |
|---|---|---|
| Median gross rent | `B25064_001E` | |
| Median home value | `B25077_001E` | `B25035` is *median year structure built* |
| Median household income | `B19013_001E` | |
| Median rent as share of income | `B25071_001E` | published, so no interpolation from `B25070` |
| Households | `B25001_001E` | `B25002` is *occupied housing units* |
| Population | `B01003_001E` | |
| Renter / owner occupied | `B25003_003E` / `_002E` | |

The school panel reads per-pupil expenditure, student-teacher ratio, enrollment
and school count straight off the NCES EDGE boundary service, which already
joins them to the geometry. Two hazards are handled explicitly, both found by
querying live data: `-2` is NCES's missing-value sentinel and is never shown as
a number, and a point can fall inside a *supervisory union* (`LEA_TYPE 3`) rather
than a district — all of New York City is inside "NYC Chancellor's Office", a
state-level entity with no students, so those are rejected rather than reported.

## Known gotchas

**Census returns HTTP 200 for failures.** A missing, malformed, or rejected key
all produce `200 OK` with an HTML body titled `Invalid Key`. `res.ok` is true in
every failure case; the body is the only usable signal.

**Keys arrive by email, so pastes are messy.** `normalizeCensusKey` extracts the
40-character hex token first, and `validateCensusKey` returns a *reason* —
`malformed`, `rejected`, or `network` — so a connectivity problem is never
reported as a bad key.

**A new key triggers a re-query.** Saving a key dispatches
`civicscope:census-key`; the app listens and reloads the sweep. Reading the key
during render instead produces a constant value, so the effect keyed on it can
never fire.

**A production deploy is not immediately live.** Pages promotes the new
deployment to the production alias a few seconds after upload, and during this
work the alias repeatedly served the previous build — including a stale
`index.html` that 404'd every SEO file. Verify the bundle hash, then wait for
promotion, before concluding anything about a deploy.

**Cloudflare Pages caps a deployment at 20,000 files.** There are 33,791 ZIP
codes, so a page per ZIP does not deploy at all — it fails outright, not
gracefully. The sitemap carries every ZIP at the cost of one file; static pages
are generated only for the largest metropolitan areas.

**SEO output must be written to the deployment root.** Pages serves root files,
and the `/*  /index.html  200` fallback answers anything that is not one, so
`dist/seo/sitemap.xml` was unreachable and `/sitemap.xml` returned the app shell
with a 200.

**The country-wide sweep is slow, by the Census API's own doing.** Measured
live against `api.census.gov` for the `zip code tabulation area:*` wildcard:

| Variables | Time |
|---|---|
| 1 | ~20s |
| 4 (what the screen requests) | ~21–29s |
| 14 (the original request) | ~65s |

Parsing is not the bottleneck — 3.9MB of JSON parses in 24ms and mapping 33k rows
takes 10ms. The time is server-side, and it grows with the variable count.

So the screen loads in two stages. The first request carries only the four
figures the table displays, which is enough to make the whole country sortable
and filterable. Margins of error and the remaining columns arrive with the
per-area detail request, which settles in about **2 seconds**. Looking up a ZIP
therefore never waits on the sweep: the drilldown is a separate request, the
sweep runs concurrently, and the UI says so while it loads.

Verified live: 33,772 rows returned (Census publishes 33,791 ZCTAs, the
difference being those with no ACS coverage), and a single-ZIP lookup completes
with full figures and margins of error in ~2–3s *while* the sweep is still
fetching.

**A ZIP geocoding bug that hid as "not a US ZIP code".** The Census TIGERweb ZCTA
layer has no `STUSPS` field, and requesting a field a layer does not define does
not return a partial result — it fails the whole query with HTTP 200 and
`{"error":{"message":"Failed to execute query."}}`, which is byte-identical to a
ZIP that does not exist. Every lookup reported "not a US ZIP" until the field
list was corrected. A second issue sat underneath: `encodeURIComponent` leaves
apostrophes unescaped and this endpoint needs `%27`.

**Photon is not a safe dependency for a public utility.** A 370-ZIP audit
exhausted its request budget and it refused connections afterwards; because
rate limits are per-IP, that failure mode hits every visitor, not just the build
machine. ZIP lookup therefore goes to the Census Bureau's own ZCTA layer, and
Photon survives only as a free-text fallback.

**Audit against the real list, not a generated one.** An early audit synthesised
sample ZIP codes by padding a 2-digit value to five digits, producing values like
`00005` and `06966` that are not assigned at all. They were then reported as
"rejected as non-US" and looked like a product regression. `tools/zip-audit.mjs`
and `tools/zip-audit-ranges.mjs` now sample from the authoritative Census list;
unassigned codes are kept as a negative test asserting they are correctly
reported as not a US ZIP.

## Testing

```bash
npm test            # 95 unit + security tests, hermetic
npm run test:live   # 14 live API contract checks, hits the network
npm run test:e2e    # real browser: WCAG 2.2 AA audit + sweep assertions
npm run gate        # the full completion gate
```

`test:live` asserts the *shape* of every upstream response, because drift is the
failure mode that breaks a project like this quietly: a table is renamed, a field
is dropped, an API starts requiring a key, and the page simply shows less than it
did yesterday.

`test:e2e` runs Chromium against the **built** app, so the Content-Security-Policy
is enforced exactly as in production. It carries the axe-core WCAG 2.2 A/AA audit
across both views, plus checks axe cannot make: skip link, accessible names,
fieldset grouping, live regions, a focus indicator verified by actually focusing,
and that margins of error are rendered rather than hidden. Assertions needing a
Census key skip without `CENSUS_KEY`, so the suite is safe in CI.

## Search discovery

`npm run build` also runs `tools/gen-seo.mjs`, which writes a `sitemap.xml`
covering all 33,791 ZIP codes, a `robots.txt`, and static entry pages for the
largest metropolitan areas. Figures are deliberately **not** baked into those
pages: they change annually, they need a key, and a stale number in a search
snippet is exactly the confidently-wrong output this project exists to avoid. The
static page is a doorway to the live, auditable view.


## Commands

```bash
npm install
npm run dev          # local dev server
npm run verify       # typecheck + unit tests + production build
npm run test:live    # live API contract checks (hits the network)
```

## Deploying

The app is a static site with no backend, so the Cloudflare Pages free tier
covers it indefinitely — no server cost, no Workers, no spend cap to worry
about.

```bash
npm run cf:login     # one-time browser auth
npm run deploy       # build + deploy to production
npm run deploy:preview   # deploy a preview branch instead
```

Production: **https://civicscope.pages.dev**

`public/_headers` sets the security posture, and it is verified by tests rather
than trusted:

- A strict Content-Security-Policy with **no `unsafe-inline` and no
  `unsafe-eval`** for scripts
- HSTS, `X-Frame-Options: DENY`, `nosniff`, and a restrictive
  `Permissions-Policy`
- Hashed assets cached immutably for a year; the HTML shell never is

The CSP `connect-src` allowlist is cross-checked against the source code by
`src/security.test.ts`, which fails the build if a plugin starts calling an
origin that is not on the list. That matters for a specific reason: the product
claims to run no ads, no analytics, and no tracking, and an allowlist makes that
claim mechanically verifiable — an unexpected third party has nowhere to send
data.

## Completion gate

```bash
npm run gate                                            # deterministic only
TYPESAFE_API_KEY=<key> npm run gate                     # + Jev semantic review
GATE_REQUEST="..." GATE_SUMMARY="..." npm run gate       # with the request under review
```

The gate exists so that "done" is a measurement rather than a judgement. It has
two layers, and the split is deliberate.

**Deterministic (19 checks, no network for most).** Typecheck, build, unit and
security tests, live API contracts, plus structural invariants that unit tests
cannot see as a whole: the Fair Housing notice is mounted and links to a
complaint route, no protected-class metric appears inside a composite, every
composite rule is backed by a metric some plugin actually emits, the two
ACS tables that were wrong once are still corrected, geocoding still trusts
`countrycode` rather than a bounding box, the territory regressions are still
covered, and **the deployed production bundle actually contains the fixes**.

That last check exists because a stale deploy is a real failure mode here: Pages
promotes a new build seconds after upload, and twice during this work the
production alias was still serving the previous bundle.

**Jev semantic review (needs `TYPESAFE_API_KEY`).** Three typed questions in a
single batched call — are all requirements met, is anything unverified being
presented as done, and what standard is this at — combined into a weighted score
against a 99 threshold.

Jev is a useful independent check, but it is **not** a substitute for the
deterministic layer, and the gate says so in its own output. A model scores the
evidence it is given; it cannot verify that the NCES endpoint returns data. It is
an adversarial reader of the record, not a measurement of reality. The
deterministic layer measures things that cannot be argued with, which is why it
gates even when Jev is unavailable.

### What the gate has already caught

It found two real bugs in its first run, both of which I had shipped:

- The affordability composite referenced `rent_burden_pct`, a key **no plugin
  emits**. That component was silently always null, so the headline index was
  quietly computed from fewer inputs than it claimed.
- A scoring-rule rename broke a test that had been passing, because the test
  still referenced the old key.

It also produced two false positives on its own first run — matching the wrong
ACS table IDs inside the comments that *document* the fix, and mis-attributing
school metrics to the ACS plugin. A gate that cries wolf gets ignored, so both
were fixed to strip comments before matching and to read every plugin.

## Adding a data source

Implement `PluginRequest` from `src/core/types.ts` and register it in
`src/core/useHousingQuery.ts`. That is the entire process. The engine resolves
dependency order, dedupes shared upstream requests, runs independent branches
concurrently, applies suppression centrally, and generates the methodology page
from the registry — so documentation cannot drift out of sync with the code.

```ts
export const myPlugin: PluginRequest = {
  id: 'my-source',
  title: 'Human readable title',
  category: 'cost',
  geography: 'tract',
  minZoom: 2,
  requires: ['other-plugin-id'],   // optional; engine orders the graph
  requiresCensusKey: false,        // keyless plugins form the default UX
  legal: { suppressBelow: 20 },    // enforced by the engine, not by you
  async fetch(ctx) { /* return MetricValue[] */ },
}
```

## Fair housing commitments

These are product constraints, not a policy page.

- We never filter, sort, or rank by race or ethnicity. Area composition is shown
  as context, in its own section, and is **excluded from both indices** (pinned
  by a test).
- We never publish a ranked leaderboard of neighbourhoods, and we never tell you
  which place is best. You choose the criteria.
- No advertising, no referral fees, no payment for placement. There is nothing to
  sell and no service to withhold, so there is no allocation for us to make.
- Coarsest geography the data supports, small counts withheld, margins of error
  always shown.
- Scoring weights, sources, and the known correlation between school funding and
  area demographics are all published.

## Licence and governance

MIT licensed. Contributors retain copyright and license their contributions to
the project collectively via a CLA, so there is no single owner and no one can
relicense the project out from under its users. The trademark is held
separately and is not licensed by the MIT grant.

See [GOVERNANCE.md](GOVERNANCE.md) and [LICENSE](LICENSE).

## Attribution

This product uses the Census Bureau Data API but is not endorsed or certified by
the Census Bureau. Contains data from the U.S. Department of Education's NCES
Common Core of Data and from the CDC PLACES programme. Geocoding by OpenStreetMap
contributors, available under the Open Database License.
