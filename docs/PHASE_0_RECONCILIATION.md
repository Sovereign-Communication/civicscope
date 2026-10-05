# Phase 0 reconciliation: one contract, before any code

**Status:** blocking Phase 0. No application code has been written.
**Supersedes:** the Phase 0 sections of `IMPLEMENTATION_GUIDE.md`.
**Authoritative alongside:** `EXECUTION_READY.md`, `OPUS_REMEDIATION_APPLIED.md`,
`PR_PHASE_0_SCOPE.md`.

---

## Why this document exists

Phase 0 arrived as three documents that do not agree, and the disagreements are
not editorial. They name different data sources, different files, different type
shapes, and a different number of lines of code. An agent that followed any one
of them would produce a different application.

| Question | `IMPLEMENTATION_GUIDE.md` | `EXECUTION_READY.md` + `OPUS_REMEDIATION_APPLIED.md` | `PR_PHASE_0_SCOPE.md` |
|---|---|---|---|
| Where city names come from | Photon, live | baked Census file | Photon, live |
| Phase 0 size | 1,200 LoC | 950 LoC | 1,200 LoC |
| `SearchInput.tsx` | "modify existing" | (silent) | "modify existing" |
| `ResolvedPlace` | add `{zcta, city, state}` | already exists, no change | add `{zcta, city, state}` |
| Generator directory | — | `scripts/` | — |
| Autocomplete tests | `src/ui/*.test.tsx` | Vitest pure fn + `src/e2e/` | `src/ui/*.test.tsx` |
| a11y command | `npm run test:a11y` | — | `npm run test:a11y` |

`OPUS_REMEDIATION_APPLIED.md` is dated later than `IMPLEMENTATION_GUIDE.md` and
describes itself as the corrected version of it, so on paper the newer pair
wins. That is not sufficient reason to proceed on its own, because the newer
pair also contains claims that do not survive contact with the repository. Those
are recorded below, each one checked rather than read.

Everything in this document was verified against the working tree at `49d9eab`.
Where a check cost a network request or a build, that is stated.

---

## Part 1 — Claims in the plan that are false about this repository

These are the findings that block implementation. Each was verified, not inferred.

### 1.1 `src/ui/SearchInput.tsx` does not exist

Both `IMPLEMENTATION_GUIDE.md` and `PR_PHASE_0_SCOPE.md` instruct the agent to
modify `src/ui/SearchInput.tsx` and describe its current contents. There is no
such file. The search form is inline in `src/ui/App.tsx:112-171`, duplicated by
reference into both the Explore and Map views (`App.tsx:237`, `App.tsx:281`).

This matters beyond a filename. The plan's own note that the panel is "shared by
Explore and Map rather than duplicated" describes a deliberate invariant, and any
implementation that creates a new `SearchInput.tsx` without reading `App.tsx`
first will either fork that panel or move it without understanding why it is a
single `const`.

**Correction:** the file to modify is `src/ui/App.tsx`. Whether the search panel
should be extracted into its own component is a separate, small decision this
document does not make.

### 1.2 The planned unit tests would never run, and would fail if they did

This is the most serious finding, because it produces a green build that has
verified nothing — the exact failure mode this repository's own documentation
repeatedly warns against.

- `vite.config.ts:14` sets `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']`.
  The glob is `.ts`, not `.tsx`. A file named `src/ui/SearchAutocomplete.test.tsx`
  **is not collected**. It is not run, not failed, not reported — silently absent.
- `vite.config.ts:13` sets `environment: 'node'`. There is no DOM.
- `jsdom`, `happy-dom`, `@testing-library/react` and `@testing-library/user-event`
  are all absent from `node_modules` and from `package.json`.

So the 16 planned "Vitest" tests cannot execute as written, cannot assert anything
about rendering, and would require a new dependency — which
`PR_PHASE_0_SCOPE.md` explicitly rules out ("**No new dependencies required**").

The same defect applies to the guide's `e2e/search-city-state.e2e.ts`:
`vitest.e2e.config.ts:7` includes only `src/e2e/**/*.e2e.ts`, so a top-level
`e2e/` directory is never collected either. `OPUS_REMEDIATION_APPLIED.md`
corrected this one for the E2E files and missed it for the unit files.

**Correction:** all Phase 0 logic tests are `.ts` under `src/` and test pure
functions. All rendering, keyboard and ARIA assertions are Playwright under
`src/e2e/`, driving a real served build. No new dependency. If someone later wants
component unit tests, that is a separate proposal that has to bring its own
justification for adding jsdom.

### 1.3 `npm run test:a11y` does not exist

Named in the verification steps of both older documents. `package.json` has
`test:e2e`. Accessibility is audited by `src/e2e/a11y.e2e.ts` under
`npm run gate`, which also needs a served build
(`E2E_BASE_URL`, default `http://localhost:4173`) because the audit is run against
the production bundle so the Content-Security-Policy is actually enforced.

**Correction:** `npm run gate`, with a served build. Note that `npm run verify`
does not include the E2E suite, so a green `verify` says nothing about
accessibility.

### 1.4 The bundle-size baseline is wrong by a factor of five

`EXECUTION_READY.md` states a current size of "~500KB gzipped" and budgets Phase 0
at +8KB, described as acceptable against a "<= 10% increase" target.

Measured with `npm run build:app`:

```
dist/assets/index-BbCEQD3K.js    271.53 kB │ gzip: 89.83 kB
dist/assets/index-w9xUeQ-7.css    22.56 kB │ gzip:  5.13 kB
```

The application is **95 kB gzipped**, not 500 kB. The same +8KB budget is
therefore about 8% of the real payload rather than 1.6%, and the "7% total
increase across all four phases" claim is roughly 35% against a base of 95 kB.
That is not automatically a reason to reject the plan, but it must be a
deliberate acceptance rather than an accident.

**Correction:** Phase 0 is measured against a 95 kB baseline, and the budget is
restated in section 3.

### 1.5 `scripts/` does not exist

`OPUS_REMEDIATION_APPLIED.md` places the generator at
`scripts/gen-zcta-city-mapping.mjs`. The repository has no `scripts/` directory.
Every existing generator lives in `tools/` and is wired to an npm script
(`gen:map` → `tools/gen-map-data.mjs`).

**Correction:** `tools/gen-zcta-city-mapping.mjs`, wired as `npm run gen:zcta-city`.

### 1.6 `ResolvedPlace` has no `zcta` and no `city`

`IMPLEMENTATION_GUIDE.md` and `PR_PHASE_0_SCOPE.md` both instruct the agent to add
`ResolvedPlace { zcta, city, state, lat, lon, precise }`. The actual interface
(`src/core/types.ts:128-140`) is:

```ts
export interface ResolvedPlace {
  name: string
  zip?: string
  county?: string
  countyFips?: string
  state?: string
  stateFips?: string
  lat?: number
  lon?: number
  precise?: boolean
}
```

There is no `zcta` field and no `city` field; the city is `name` and the ZIP is
`zip`. `OPUS_REMEDIATION_APPLIED.md` correctly states that no type change is
needed. Following the older documents would have produced code that does not
compile.

### 1.7 A city suggestion with no ZIP cannot be selected — which decides the design

`selectPlace` returns immediately if the place has no `zip`
(`src/core/useHousingQuery.ts:161-164`). A city centroid — the thing Photon
returns for "Austin" — carries a name and coordinates but frequently no ZIP, so
under the Photon-primary design a user could click a suggestion and get a silent
no-op.

The baked ZCTA→place mapping inverts this: it is keyed by ZIP, so every city it
returns already carries the ZIPs inside it. The mapping is not merely a cheaper
alternative to Photon here, it is the only one of the two that produces
selectable results.

This is the strongest technical argument for the baked-file decision, and it was
not made anywhere in the planning documents.

### 1.8 Photon in the search path contradicts a measured production failure and the project's privacy claim

`src/core/geocode.ts:1-25` records that a 370-ZIP audit exhausted Photon's request
budget, that it then refused connections, and that because the limits are per-IP
this applies to every visitor of the deployed site — concluding that "a free
public geocoder is not a safe dependency for a public utility."

Autocomplete is a higher request rate than the current once-per-submit fallback,
by a large multiple: it is one request per debounced keystroke, not one per
confirmed search.

Separately, `docs/governance.md:49` states that nobody can "see who searched for
what, or where they live". Sending each query to `photon.komoot.io` hands a
third party a log of exactly that. The current design keeps Photon as a fallback
for queries the Census service cannot answer; making it the autocomplete's
primary path would make it the common case.

**Decision taken: the baked mapping is the only source for city search. Photon
is not added to the new code path and is left exactly where it already is.**

### 1.9 `npm run typecheck` writes 56 `.js` files into the source tree

Not a planning error — a repository defect found while establishing the baseline,
recorded here because it will affect every agent that follows.

`package.json` defines `"typecheck": "tsc -b --noEmit false --emitDeclarationOnly false"`.
The explicit `--noEmit false` overrides the project setting, so the command emits
compiled JavaScript next to every source file. `.gitignore` does not cover it,
because there is nothing to ignore — the project is `.ts`-only.

Running the documented typecheck command left 56 untracked `.js` files in `src/`
and one at the root. They have been deleted. The command still reports errors
correctly, so the fix is not to stop running it; it is either to drop the flag or
to ignore the output. Left as-is, every agent that runs `npm run typecheck` before
committing has to notice 56 files that are not its work.

`npm run verify` runs `tsc -b` without that flag and does not have this problem.


---

## Part 2 — Data source, verified

The remediation commits to "Census 2020 relationship files" without naming them.
Both files were fetched and parsed to confirm they exist, are public domain, need
no key, and cover the whole country.

### 2.1 ZCTA → place

```
https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt
```

| Property | Measured |
|---|---|
| Size | 9,811,563 bytes |
| Header | pipe-delimited, one header row |
| Data rows | 82,880 |
| Distinct ZCTAs with a populated place name | **28,808 of 33,791 (85.3%)** |
| Rows with an empty ZCTA side | 895 (places overlapping no ZCTA) |

Relevant columns: `GEOID_ZCTA5_20`, `NAMELSAD_PLACE_20` (e.g. `Austin city`),
`GEOID_PLACE_20` (7 digits: 2-digit state FIPS + 5-digit place FIPS),
`AREALAND_PART` (the overlap area, which is how "largest overlap" is decided).

**4,983 ZIP codes — 14.7% of the country — have no incorporated city inside them.**
This is the number that makes the county fallback a requirement rather than a
nicety, and it is higher than the planning documents assumed.

### 2.2 ZCTA → county

```
https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
```

| Property | Measured |
|---|---|
| Size | 6,821,287 bytes |
| Data rows | 47,863 |
| Distinct ZCTAs | **33,791 — complete coverage** |

Same shape as the place file: `GEOID_ZCTA5_20`, `NAMELSAD_COUNTY_20`,
`GEOID_COUNTY_20` (5 digits: state FIPS + county FIPS), `AREALAND_PART`.

**Decision taken: the county relationship file is used.** It is the only complete
answer for the 4,983 rural ZIP codes, and it is already public domain and keyless.

### 2.3 What is not being used, and why

- No Photon. Section 1.8.
- No ACS API call for city names. The Census API requires a key, the app's
  keyless-by-default property is load-bearing (`App.tsx:157-163`), and the
  relationship files need no key at all.
- No TIGERweb spatial join. A 33,791-polygon point-in-polygon pass is minutes of
  build time for a result the Census Bureau has already computed and published.

---

## Part 3 — The reconciled Phase 0 scope

This is the contract. Where it differs from an older document, it wins.

### 3.1 Pipeline

```
tools/gen-zcta-city-mapping.mjs        (build time, npm run gen:zcta-city)
  ├─ fetch tab20_zcta520_place20_natl.txt    9.8 MB, keyless, public domain
  ├─ fetch tab20_zcta520_county20_natl.txt   keyless, public domain
  ├─ per ZCTA: place with max AREALAND_PART, else county with max AREALAND_PART
  ├─ state abbreviation from TIGERweb us-states.json (already committed)
  └─ write public/map/zcta-places.json.gz + fold counts into public/map/manifest.json
        ↓
src/core/zcta-place-index.ts          lazy load, search, reverse lookup
  ↓
src/ui/SearchAutocomplete.tsx         combobox, no network
src/ui/CityZipBrowser.tsx             ZIPs inside a chosen city
```

### 3.2 Payload: measured, and it is the real cost of this phase

Encoding the 28,808 city rows as a naive `{zip: [name, state]}` JSON object and
measuring it:

| Encoding | Bytes |
|---|---|
| Naive JSON | 926,085 |
| Naive JSON, gzip -9 | 206,435 |
| Naive JSON, brotli | 160,756 |
| Dictionary-packed (city name table + index), gzip -9 | 153,021 |

**The search index is 206 kB gzipped against a 95 kB application.** It is more
than twice the size of everything the browser currently downloads to run this
tool. The planning documents budgeted +8KB for a feature whose data file is
twenty-six times that.

That number drives three decisions:

1. **It is never in the main bundle.** Dictionary-packed and gzipped: 153 kB,
   fetched on demand, only when someone types something that is not a ZIP. A
   visitor who only ever enters ZIP codes never downloads it.
2. **It is served from `/map/`, which is already immutable for a year**
   (`public/_headers`, `/map/*`). A second visit costs zero bytes. This is
   exactly the reasoning already applied to the 420 KB of map geometry, and it
   is free here because of where the file is put.
3. **The 10%-of-bundle rule is restated honestly.** 153 kB on 95 kB is a 161%
   increase for the visitors who use city search and 0% for everyone else. That
   is a trade the maintainer should accept explicitly, not one that should slip
   through as "+8KB, within target".

#### What it actually shipped as

The estimate above was wrong in a useful way, and the committed artefact is what
matters. Measured after the build:

| | Estimated here | Shipped |
|---|---|---|
| Raw | 451,735 | 713,412 |
| gzip -9 | 137,286 | **186,888** |
| brotli q5 | 137,489 | 179,932 |

Two differences, both deliberate:

- **Names are stored verbatim** (`NAMELSAD_PLACE_20`), giving 19,770 distinct
  names rather than 14,789 shortened ones. Pre-shortening would have saved about
  50 kB gzipped by writing the generator's opinion into the data. A mapping that
  is subtly wrong is worse than one that is merely large, and the verbatim string
  is auditable against the Census source file by comparison. The display
  shortening is a tested function in `src/core/zcta-place-index.ts` instead.
- **The ZIP list is delta-encoded**, which was the one large win available: 78 kB
  gzipped down to 11 kB. The maximum observed gap is 1,096, comfortably inside
  four digits, and the generator asserts that bound rather than assuming it.

Run-length encoding the records was measured and **rejected**: only 4,503 runs
exist across 33,791 records, because ZIP sequences interleave across county
boundaries, so RLE came out no smaller than the raw records.

**The load is eager, not on-first-keystroke.** Point 1 above said a visitor who
only ever enters ZIP codes would never download the file. That is no longer true,
because the screening table shows the city beside every row and there is no way
to render 33,791 city labels without the index. It is fetched once on mount and
cached for a year, and 187 kB is comparable to the 420 KB of geometry the map
already loads on demand. Recording the change rather than quietly shipping
something smaller than claimed.

### 3.3 Serving the mapping: resolved

**Decision: plain `zcta-places.json` under `/map/`, dictionary-packed, compressed
by the CDN. No client-side decompression.**

This closes the last open item. The reasoning, measured rather than assumed:

| Payload | raw | gzip -9 | brotli q4 (typical CDN) |
|---|---|---|---|
| naive JSON | 963,859 | 216,369 | 215,669 |
| dictionary-packed | 451,735 | **137,286** | 142,226 |

Two things follow. **Packing saves ~74 KB; the codec saves ~5 KB.** Encode the
dictionary and the compression question stops mattering. And **self-gzipping the
packed payload is smaller than letting the CDN Brotli it** (137,286 vs 142,226),
because packing already spent the bytes Brotli would have spent on repeated city
names — so "let the CDN do it better" does not hold here.

The reason this was open at all is a browser-support fact, and it is the reason
option (b) lost:

- `DecompressionStream` has been available across browsers only **since May 2023**
  (Safari 16.4 / iOS 16.4).
- `PR_PHASE_0_SCOPE.md:200` states the support target is **iOS Safari 14+**.

A `.json.gz` file read through `DecompressionStream` therefore breaks city search
on iOS 14, 15 and 16.0–16.3 outright. Plain `.json` read with `fetch().json()`
works on every browser the project claims to support and has no failure mode to
get wrong.

**The residual cost, stated plainly:** wire size becomes a property of Cloudflare's
configuration rather than of this repository. If compression is ever disabled, or
the site moves to a host that does not compress, 452 KB goes over the wire instead
of 137 KB. That is acceptable at this size and is mitigated by a gate check that
fetches the deployed URL, asserts the response arrived compressed, and decodes it
back to 33,791 entries — the gate already verifies deployed artefacts by content
rather than by status, so this is the existing pattern rather than a new one.

**Fallback if determinism is later demanded:** serve plain `.json` with
`Content-Encoding: gzip` set in `_headers`. The browser decompresses it
transparently as ordinary content negotiation — universally supported, no
`DecompressionStream` — so this is strictly better than both original options,
*provided* Cloudflare honours the header without re-compressing. That has to be
verified against the deployed site rather than assumed, which is why it is a
fallback and not the choice.

### 3.4 Files

New:

| File | Purpose |
|---|---|
| `tools/gen-zcta-city-mapping.mjs` | Build-time generator, mirrors `gen-map-data.mjs` |
| `src/core/zcta-place-index.ts` | Lazy load, prefix/substring search, reverse lookup |
| `src/core/zcta-place-index.test.ts` | Pure-logic tests (`.ts`, node env) |
| `src/ui/SearchAutocomplete.tsx` | Combobox |
| `src/ui/CityZipBrowser.tsx` | ZIPs within a city |
| `src/e2e/city-search.e2e.ts` | Playwright: rendering, keyboard, ARIA |

Modified:

| File | Change |
|---|---|
| `src/ui/App.tsx` | Wire autocomplete into the existing inline panel; update placeholder and hint |
| `src/ui/Comparison.tsx` | Show city/state; mount `CityZipBrowser` |
| `src/ui/SweepTable.tsx` | City/state in the ZIP cell |
| `src/core/useHousingQuery.ts` | Multi-result disambiguation |
| `package.json` | `gen:zcta-city` script |
| `public/_headers` | Only if route (b) is chosen |

**Not modified:** `src/core/geocode.ts`, `public/_headers` `connect-src`
(no new origin is contacted), `src/core/types.ts` (`ResolvedPlace` is already
sufficient).

### 3.5 Tests

| Kind | Count | Location | Runs in |
|---|---|---|---|
| Pure logic | ~14 | `src/core/zcta-place-index.test.ts` | `npm test` |
| Browser, rendering + keyboard + ARIA | ~8 | `src/e2e/city-search.e2e.ts` | `npm run gate` (needs served build) |

Two structural rules, both consequences of section 1.2:

- Every test file is `.ts`. A `.tsx` test would not be collected.
- The E2E file asserts ARIA state by reading the DOM, never by reading the JSX.

### 3.6 Correctness bar for the mapping itself

A mapping that is subtly wrong is worse than no mapping, because it looks right.
So the generator asserts, and the tests re-assert against the committed file.

Verified against the two source files on 2026-10-04:

| ZIP | Resolves to | County fallback |
|---|---|---|
| 78701 | Austin city, TX | Travis County |
| 10001 | New York city, NY | New York County |
| 99501 | Anchorage **municipality**, AK | Anchorage Municipality |
| 96813 | Urban Honolulu **CDP**, HI | Honolulu County |
| 00901 | San Juan **zona urbana**, PR | San Juan Municipio |
| 20771 | *(no city)* | Prince George's County |
| 00600 | *(not a ZCTA — absent, as it must be)* | — |
| 59601 | Helena city, MT | Lewis and Clark County |

Completeness, measured across all 33,791:

- union of the two files is exactly **33,791 ZCTAs**, matching
  `public/map/manifest.json`'s `zctaCentroids`
- **4,983** have a county but no city
- **0** have neither

**A finding the planning documents missed: the place name carries its legal
type.** The values are not all cities. `Anchorage municipality` (Alaska's
equivalent of a city), `Urban Honolulu CDP` (a statistical entity, not an
incorporated place), `San Juan zona urbana` (Puerto Rico's equivalent) are what
the Census actually publishes. Rendered verbatim in a search box these read as
mistakes, and the document set never mentions them.

The display layer therefore has to strip the trailing legal-type token, and the
tests have to pin the stripping per type rather than assume a uniform `City`
suffix — the naive `.replace(/ city$/, '')` that the plan implies would leave
every CDP, municipality and zona urbana in the country unfixed.

---

## Part 4 — Corrections owed to the stale documents

Not yet applied. Listed so that the next agent does not have to rediscover them.

1. `IMPLEMENTATION_GUIDE.md` — Phase 0 section (1,200 LoC, Photon-primary,
   `SearchInput.tsx`, `{zcta, city, state}`, `npm run test:a11y`, `.test.tsx`,
   top-level `e2e/`). Either delete or replace with a pointer to this document.
   Leaving it is how the next agent builds the wrong thing.
2. `PR_PHASE_0_SCOPE.md` — the verification checklist still says
   `role="listbox"` while the remediation correctly moved to combobox; both appear
   in the same document.
3. `EXECUTION_READY.md` — the 500 kB baseline and every percentage derived from
   it; `scripts/` path.
4. `OPUS_REMEDIATION_APPLIED.md` — `.test.tsx` for unit tests; `scripts/` path.
5. Issue #4 ("Generate ZCTA-to-city mapping") is listed as a dependency of Phase 0
   in the PR body while `EXECUTION_READY.md` lists generating the file as step 2
   *of* Phase 0. One of the two is wrong; on the evidence here, the file
   generation is Phase 0 work and #4 should be closed by this phase, not block it.
6. `docs/jev-roadmap.md` has no row for any of this work. That file states it is
   "the single source of truth for phase status" and is "edited only after the
   corresponding evidence exists". No row should be added until the code exists —
   but the absence should be deliberate rather than an oversight.

---

## Part 5 — Status

**Signed off and implemented.** See Part 6 for the outcome and for what the build
disproved. Not blocked on data: both source files were verified, public domain,
keyless, and cover all 33,791 ZIP codes.

Recorded decisions:

| # | Decision | State |
|---|---|---|
| 1 | Baked mapping only; Photon not added to the search path | taken |
| 2 | Use the ZCTA→county file for the 4,983 ZIPs with no city | taken |
| 3 | `IMPLEMENTATION_GUIDE.md` is the contract; reconcile before coding | taken — this document is the reconciliation |
| 4 | `.json.gz` + `DecompressionStream` vs plain JSON + CDN compression | **resolved** — plain JSON, section 3.3 |
| 5 | PRs re-checked 2026-10-04 19:51 against `org/pr-6..9` after the maintainer asked for a second pass | Phase 0 unchanged; Phase 2B discrepancies found and reported, see below |

### Re-check of the planning PRs

PR #6 received a further commit after this document was first written:
`8456d6c docs: Revise Phase 2B scope - user-driven weights + self-aggregated data`.
It touches `docs/PR_PHASE_2B_SCOPE.md` and nothing else, so every Phase 0 document
is byte-identical to the text reconciled here. Section 3.3's resolution is aligned
with the newest plan.

PR #9 changed more substantially — from "Similarity Scoring (250 LoC) [BLOCKED]"
to "User-Driven Weights (1,700 LoC MVP)", now described as "NOW UNBLOCKED". That
does not affect Phase 0, but four things in it should be settled before Phase 2B
is built rather than after:

1. **Its data premise is correct, and this was worth checking.** The revised scope
   claims "CDC PLACES publishes per-ZIP already (not tract-level only as old plan
   said)". Verified against the live CDC catalogue: `qnzd-25i4`, *PLACES: Local
   Data for Better Health, ZCTA Data, 2025 release*, 1,171,563 rows, queryable
   keylessly, carrying `low_confidence_limit`/`high_confidence_limit`. The earlier
   "CDC = tract" claim described this repository's plugin
   (`src/core/plugins/keyless.ts:85` declares `geography: 'tract'` and aggregates
   tract to ZIP), not CDC's offerings. Blocker 2's *data* question is genuinely
   answered.

2. **But the document contradicts itself on whether those metrics may be used.**
   It bakes CDC PLACES health and disability measures while also marking them all
   `protectedClassProxy` — and `protectedClassProxy` means, per
   `src/core/types.ts:170-176`, "displayed but NEVER offered as a sort or filter
   control". If they are all flagged, they cannot be ranking inputs and the ZCTA
   bake is display-only. `EXECUTION_READY.md` had already decided to *remove*
   school and health from profiles. This needs an explicit answer before code,
   because it determines whether Phase 2B has any health component at all.

3. **"User agency eliminates steering risk" is the load-bearing legal claim and it
   should not be taken on trust.** It converts a two-to-four-week review into a
   "narrow sign-off, days not weeks" purely by moving weight selection to the
   user. A user choosing the weights changes who picks the ranking function, not
   whether the output ranks — and the earlier Opus pass already recorded that
   alphabetical ordering does not remove ranking, because the distance cut-off
   still determines *which* ZIPs appear. Issue #2 was retitled to "RELEASE GATE"
   at 19:40 today and is still **OPEN**, so the tracker and the document disagree
   about whether this phase is blocked.

   A defensible middle path exists and is already half-built: build behind a
   feature flag, default off, release only on written sign-off. That is what
   PR #9's own release sequence proposes, and it makes the question one of
   sequencing rather than of whether the work may start.

4. **The payload pattern regresses.** "App init: Load once (like centroids today)"
   with 0.5–1 MB gzipped is wrong on both counts. `loadMapAssets`
   (`src/core/map/projection.ts:305`) is called from `MapView` when the map is
   opened, not on init, and the centroids are 169 KB raw. A 0.5–1 MB init-time
   download is five to ten times the entire application bundle — the same trade
   measured and rejected in section 3.2. Phase 2B's data should follow the same
   rule: lazy, on demand, served from `/map/` under the existing immutable header.


## Part 6 - Outcome

**Phase 0 is implemented.** PR #11 carries the code. This document was written
before it and amended afterwards rather than replaced, so the estimates it made
can be compared against what was built.

| | Before | After |
|---|---|---|
| Unit tests | 211 passed / 14 skipped | **259 passed / 14 skipped** |
| Browser tests | 24 passed | **32 passed** (8 new for city search) |
| Completion gate | 66/66 deterministic | **70/70** |
| Search index | 137 kB estimated | **186.9 kB gzip** |
| Photon in the search path | proposed as fallback | **none** |

### Defects found by checking the data instead of the code

Three, and each would have shipped a wrong answer while looking correct:

1. **`AREALAND_PART` is column 16, not 17.** Column 17 is `AREAWATER_PART`.
   Reading the wrong one reported 26,428 rows with zero land overlap and implied
   4,084 ZIP codes whose city was ambiguous. Against the correct column: 188 rows,
   and **zero** ambiguous ZIP codes.
2. **Legal-type stripping is case-sensitive or it is wrong.** The Census publishes
   `Salt Lake City city`. A case-insensitive strip produces `Salt Lake`.
3. **There are places named after counties.** `Carroll County`, `Hampden County`
   and `Worcester County` are census-designated places. The suffix list is
   therefore keyed on each record's own MTFCC legal class, not guessed from the
   words that happen to end names.

### Two claims in this document that the implementation changed

- **"Fetched on demand, only when someone types something that is not a ZIP"**
  (section 3.2, point 1) is no longer true. The screening table shows a city on
  every row, so the index is fetched once on mount. 187 kB sits alongside the
  420 KB of map geometry the app already loads on demand.
- The City ZIP browser shipped as specified: ZIPs listed in ZIP order, never
  ordered by any figure.

### What was deliberately not done

Phase 0 adds no ranking, no recommendation, and no ordering by any published
figure. `Austin, TX` and `Austin, AR` are both offered for "austin" with neither
placed above the other, because ordering places by population is the one thing
this app does not do. 4,983 ZIP codes with no incorporated city are labelled as
their county rather than given a city name.

Baseline at time of writing, for comparison after the change:
`npm run typecheck` clean, `npm test` 211 passed / 14 skipped,
production bundle 95 kB gzipped.
