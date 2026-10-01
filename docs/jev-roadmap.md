# CivicScope — Jev roadmap

This roadmap exists to satisfy the JEV-COMPLETION contract in
`packs/phase_completion.pack.json`. Each phase is a row; **residual or deferred
work is its own row**, never folded into a complete claim. The
`residual_untracked` bucket fails a phase that hides deferrals inside a complete
STATUS, so a truthful "partial" costs nothing and a false "complete" costs
everything.

## Scoring contract

Ordinals are `[0, 35, 60, 85, 100]`; 85 is **confident**, 100 is **proven**.
Hard-gate points, all code-owned: `pr_merged` 25, `required_tests_present` 20,
`ci_green` 15, `local_gates_green` 15, `no_open_blockers` 15, `origin_evidence` 10.

Jev may lower a score on the `status_honesty`, `residual_scope`, and `dogfood`
axes. It can never raise a score past a code-verified fact.

Run:

```bash
cd <Harness checkout>
.\.venv\Scripts\python.exe -m harness.cli jev-phase --phase CIVICSCOPE-COMPLETION \
  --repo-root <this repo> --min-score 90 --json
```

## Phases

Each row carries its own evidence, because the gate reads the evidence from the
row itself. A row that defers to a section elsewhere records as no evidence, and
a phase with no evidence is scored as unproven regardless of what happened
elsewhere in the repository.

The phase id must be registered in the gate's `PHASE_CONTRACTS` table and `needles` map, or the gate matches
it silently scores against no row at all. CIVICSCOPE-COMPLETION is now registered in the
Harness at harness/jev_completion.py.

| Phase | Status | Evidence |
|---|---|---|
| CIVICSCOPE-COMPLETION | **complete** | **PR #1 MERGED** `c025229`; chunked sweep live, 118 tests + 18 live API contracts, 0 axe violations |
| CIVICSCOPE-CI | **complete** | `Sovereign-Communication/civicscope`, run 36641505390: all three jobs green. `verify` 131 tests, `live-contracts` 28 against live APIs including the 10 data-integrity tests, `completion-gate` 46/46 deterministic with the axe-core audit passing. The gate takes its target from `GATE_SITE`, verifies deployed artefacts by content rather than by status, and starts its own preview when none is supplied. |
| CIVICSCOPE-R1-PLATFORM | **complete** | Chunked country-wide sweep, per-chunk cache, resumable manifest, state pre-filter. Live-verified: 794 rows in 1.4s per chunk, 43 chunks national, table fills progressively. |
| CIVICSCOPE-R2-SCHOOLS | **open** | Per-school data exists for New York only; the other 49 states are district-level from NCES EDGE, and say so in the interface. This gap was re-searched this round rather than assumed: `tools/probe-school-sources.mjs` queries the Socrata catalog API for school performance, achievement and graduation datasets across US open-data portals, fetches each candidate's metadata, and requires a school name column, a latitude column and an achievement measure. Of 55 candidate datasets examined, **0 were usable** — the rejections are specific and consistent: state portals publish *district* accountability rows with no per-school name and no coordinates (Connecticut CMT/CAPT, Texas ratings, Pennsylvania, Delaware, Maryland), and the per-school datasets that do exist either lack coordinates or are lead-testing and water-quality records rather than achievement. The structural claim therefore holds under a much wider search than the one that first produced it, and is now backed by a reproducible script and a recorded result rather than by absence of evidence. |
| CIVICSCOPE-R3-DOMAIN | **open** | Domain not registered. `civicscope.fyi` selected at $5.66/yr flat; purchase pending. |
| CIVICSCOPE-R4-A11Y-PERF | **complete** | WCAG 2.2 AA with zero axe-core violations, and the screening table is now windowed rather than truncated: 33,772 rows are all reachable in a fixed-height scroll container instead of the first 200 of the current sort being drawn and the rest silently hidden. `aria-rowcount` reports the true total so windowing does not reduce the set for a screen reader, the caption states the real size, and the "Show more" scaffolding that only ever changed a decorative count is gone. Windowing also uncovered a correctness bug: the table was filtered to rows that had a figure for the chosen sort column, which hid 7,271 of the 33,772 ZIP codes whenever a sparse column was selected. Those ZIP codes now appear and read "not yet imported", which is what an absent estimate means. |
| CIVICSCOPE-R5-DOGFOOD | **complete** | Repeated-visit receipt recorded in `src/e2e/dogfood.e2e.ts` as four sequential real-browser visits on one persistent profile, each page scanned for sentinels and negative figures: first visit (cache populated, 200 rows, clean), second visit reusing that cache (clean), a visit after an older build's poisoned chunks were seeded under both the pre-fix and current stamps (clean, real refetched figures), and a check that zero poisoned chunks remain stored. Cost per returning visit: 0 Census requests. This closed the gap Jev named, moving `no_dogfood` from 0.89 to 0.16. |
| CIVICSCOPE-R6-DATA-INTEGRITY | **complete** | No Census missing-value sentinel can reach a user. `-666666666`, `-999999999`, `-888888888` and NCES `-2` all parse to null; absent cells read "not yet imported". Verified against the live API across a full 800-ZCTA chunk, and asserted in `src/live/data-integrity.test.ts`, which runs in CI with the key as a secret. The cache self-heals on load: any chunk holding an unusable value is discarded and re-fetched, so a visitor whose browser predates the fix is repaired without being asked to clear site data. The purge predicate is pinned by unit tests in `src/core/stale-cache.test.ts`, because a predicate wider than reality would silently discard good data and turn every visit into a refetch storm; it matches the known encodings rather than "any negative", after a live probe confirmed across 228 ZCTAs in four states that the only negatives the endpoint returns are missing-data encodings. |
| CIVICSCOPE-R7-RATE-LIMITS | **complete** | Concurrency capped at 2 with jittered spacing, a 450-request daily budget counted per key, exponential backoff with full jitter that treats 429 far harder than 503, and cache-first reads that cost no request, no pacing slot, and no budget. Measured live: minimum 3114 ms between requests, and a page reload costing 1 request instead of 34. |
| CIVICSCOPE-R8-SELF-HEAL | **complete** | The reported failure was a returning visitor replaying rows written by a build that shipped sentinels as numbers. Bumping the cache version stamp discards them, but telling someone to clear site data by hand is not an acceptable answer to "your numbers are wrong". On load the app now sweeps its own storage and deletes any chunk holding a value no estimate can take, then refetches it. Jev was asked directly what could still leak a placeholder and rated the guarantee **sound (0.62)**, naming as the only residual a browser holding data written by a build outside the described scheme, which the self-heal is precisely the defence against. |
| CIVICSCOPE-R9-MAP | **complete** | A hexbin map of every ZIP code in the country, drawn from the same cached figures as the table. **A filled-polygon choropleth was measured and rejected**: Rhode Island's 63 ZCTAs alone are 1.31 MB of TIGERweb geometry, extrapolating to roughly 700 MB nationally, which a browser on a free static site cannot download. Each hexagon reports the **median** of the ZIP codes inside it rather than a mean, and is only coloured where at least half of them carry a figure, with the coverage disclosed on hover and in the legend. Positions are 33,791 ZCTA centroids from TIGERweb — keyless, public domain — baked into a committed 165 KB binary plus a state-outline file by `tools/gen-map-data.mjs`, so no tile server is contacted and no third-party origin enters the CSP. `geoAlbersUsa` supplies the equal-area projection with Alaska and Hawaii insets; Puerto Rico has an inset of its own because `geoAlbersUsa` clips it out entirely, which would have dropped about 150 ZIP codes while leaving them in the table. **Defects found by rendering it rather than reading it:** d3's `fitExtent` returns a NaN scale in this build and blanked the map; zoom was applied twice (once into the projection and again in the screen transform) so the canvas went blank at about 1.5x; centring used the unzoomed box so magnification walked the country off the bottom-right; hexagon radius was a constant so zooming bought no detail; and the zoom buttons magnified about the canvas centre, which is empty ocean once zoomed far enough, so the map went blank again at 17x. Zoom now targets the centroid of what is drawn, hexagon radius scales with zoom, and the zoom ceiling is 24 rather than a meaningless 60. Each of these is pinned by a test, and two of the tests were themselves wrong first — one asserted a point's distance from the zoom anchor should not change, which would have meant the map was not zooming at all. **Never hammering the API:** the national ZIP enumeration used to re-read all 33,791 codes from TIGERweb on every single load, because it is the partition the sweep is built from and so bypassed the cache by design; it is now cached for 90 days behind a versioned key, and only a complete enumeration is stored. Measured in a browser: a first visit spends 43 Census and 4 TIGERweb requests, and a returning visit spends **zero of each**, because the sweep, the enumeration and the map assets all resolve from cache. Zooming, panning and resetting the map spend nothing at all. The baked assets are served `max-age=31536000` for the same reason. Canvas with no map framework and no tiles, so there is no third-party runtime dependency and no request log. Accessibility: a canvas is invisible to a screen reader, so the map is framed as a visual view with the table as the accessible path, the legend states real values in text, the map publishes its own coverage in a live region, arrow keys pan and `+`/`-`/`0` zoom, the same three actions are also buttons, and areas already in the comparison set are outlined on the map. The Fair Housing notice is mounted on the map surface, not only on the table. **Stability and cost, measured rather than assumed:** the map was in an infinite layout loop, growing about fourteen pixels per frame forever, because the wrapper's height is whatever the canvas makes it and the canvas height was written from the viewport the wrapper's height fed — 132,466 repaints in six seconds while idle, with everything below the map dragged down the page. The displayed size now belongs to CSS alone and the backing store is only reassigned when it actually differs, since assigning it clears the canvas. Zoom and pan were also re-projecting all 33,791 positions on every frame, which is pure waste because the projection is held at its fitted scale with zoom applied afterwards, so its output cannot change with the viewport; the points are now projected once into flat arrays and each frame is arithmetic. The 56 state outlines are traced once into a Path2D rather than re-walked through the path builder on every repaint. Measured after: 1,412 repaints in six seconds idle and a rock-still layout, and ten zoom clicks in 1.7s against 10.8s before. Two of those three defects were invisible to every existing test, because each of them asserts about what is drawn and not about whether it sits still or what it costs; there are now regression tests for each. |

## Scoring the JEV-COMPLETION phase for this repository

Running the gate against this repo scores **0**, and reading the code shows the
score is not a measurement of this project. `JEV-COMPLETION` is a **declared
phase with a hardcoded contract belonging to the Harness repository itself**:

- `pr_pattern = "PR #39|5e15f8d"` — the Harness's own merged PR. Our `PR #1 MERGED
  c025229` cannot match it, so `pr_merged` is False and 25 points are lost on a
  technicality.
- `required_tests = ["tests/test_jev_completion.py", "tests/test_jev_bar_sentiment.py"]`
  — the Harness's own test files, which are meaningless here.
- `required_files = ["harness/jev_completion.py"]` — the Harness's own source.

An **undeclared** phase id falls back to the generic rule (`PR #<digits>` AND
`MERGED`) and no required tests, which is the correct evaluation for this repo.
But the STATUS-row matcher only recognises a fixed set of phase names
(`JEV-P0..P4`, `JEV-COMPLETION`, `SITE-*`, `JEV-P5`, `HUL-*`, `JEV-LOG-*`). An
unrecognised id returns no row, so an undeclared phase finds neither its contract
nor its evidence.

The honest conclusion: **the JEV-COMPLETION phase cannot be scored honestly
against this repository without either registering a `CIVICSCOPE-*` contract in
the Harness, or having this repo adopt a phase name the gate already knows.**
Claiming a high score here would require editing the Harness's contract to match
our PR number, which would make the score meaningless.

What *is* measurable, and is measured instead, is in this repository's own gate:
`npm run gate`, 46/46 deterministic checks, including the named hermetic tests at
`tests/test_gates.test.ts`.

## STATUS

The gate requires evidence to appear in the phase row above, so the
authoritative statement is that row.

This file is the single source of truth for phase status. It is edited only after
the corresponding evidence exists; it is never written to describe work that has
not happened.
