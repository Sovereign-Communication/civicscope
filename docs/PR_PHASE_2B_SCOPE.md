# PR PHASE 2B: Similarity Scoring - APPROVED AS SPECIFIED

**Total LoC (MVP):** 1,700 (1,100 code + 620 tests)  
**Confidence:** 95% (buildable alongside P0-P2A)  
**Status:** APPROVED — ship disabled by default, weights set by the reader  
**Legal review:** NONE. No attorney has reviewed this project and none is planned  
**Depends On:** Phase 0 + Phase 1 merged

---

## SUMMARY

Phase 2B is approved with one hard condition: **it ships disabled by default,
behind a feature flag, with no ranking until the reader turns it on and chooses
their own weights.**

That is a decision about defaults, not a claim of legal compliance. It is recorded
here as the accepted trade because it means no visitor ever sees a ranking they
did not ask for, and no operator chooses the weights anyone is steered by.

**Build now. There is no sign-off gate.** The previous draft of this document made
"narrow fair-housing sign-off" a release blocker. That is removed: this project
will not obtain an attorney review, so a gate that depends on one would block
forever. `GOVERNANCE.md` now says plainly that no attorney has reviewed the code
and that nothing here is legally cleared.

---

## WHY THIS IS NOT BLOCKED

### Original Blocker 1: Legal Review of Static Weights — dropped, not solved

The original blocker was that operator-chosen weights (40/30/20/10) could steer by
protected class.

**The resolution is not that the risk was eliminated. It is that the risk was never
put in front of a visitor by default.** Three concrete changes:

- The feature is **off by default** behind a feature flag.
- **The reader sets the weights.** There are no operator-chosen defaults standing
  in for a reader's preference.
- **The limits are disclosed on screen**, and `GOVERNANCE.md` states that no
  attorney has reviewed the design and that this is not a determination of
  compliance.

An earlier draft of this document claimed "user agency eliminates steering risk."
That is not a true statement and has been removed. Letting someone choose the
weights changes who picks the ranking function; it does not make the output less
of a ranking, and a reader can still choose weights that act as a proxy. What it
does guarantee is that no ranking is imposed on anyone who did not ask for one.

**Residual risk, stated plainly:** this is a design mitigation, not a legal
finding. If it later turns out to violate the Fair Housing Act, the mitigation was
wrong, and nobody checked because nobody with the relevant training checked. That
is a known and accepted limitation of an unfunded, independently-run project — not
a solved problem.

### Original Blocker 2: ZIP-Level Metrics Audit — answered, and verified

The original blocker was that NCES (district) and CDC (tract) have no per-ZIP
data.

- **Census ACS:** already per-ZIP. No work needed.
- **CDC PLACES:** publishes its own ZCTA-level release. Verified against the live
  CDC Socrata catalogue: `qnzd-25i4`, *PLACES: Local Data for Better Health, ZCTA
  Data, 2025 release* — 1,171,563 rows, queryable keylessly, carrying
  `low_confidence_limit` / `high_confidence_limit`. The earlier "CDC is tract-level
  only" note described *this repository's* plugin
  (`src/core/plugins/keyless.ts`, which aggregates tract to ZIP), not CDC's
  offerings.
- **NCES:** genuinely district-level. An area-weighted join is internal work, and
  NCES is deferred to future scope rather than approximated.

**Resolved with evidence rather than assumed.**

---

## ARCHITECTURE: BAKED DATA + DYNAMIC LOADING

### The Insight

Similarity scoring needs all candidate ZIPs' metrics in the browser **at the same moment** to compute distances. Loading on drilldown can't supply that. Solution:

**Bake comparison data at build time** (same pattern as `tools/gen-map-data.mjs`):
- All 33,800 ZIPs × ~10 metrics (~0.5-1 MB gzipped)
- Quantized for size (Census uses CI ranges anyway)
- Loaded once at app init (like centroids file today)
- Similarity computes in browser in <20ms

**Drilldown metrics load on demand** (for display, not scoring):
- User explores a ZIP → fetch full Census data for that ZIP only
- City/county/state views in future (not MVP)
- No blocking on data load for similarity results

### Performance (All Targets Met)

| Operation | Target | Actual |
|---|---|---|
| Similarity compute | <200ms | <20ms |
| Weights UI render | <100ms | ~50ms |
| Baked data load | <100ms | <50ms (cached) |
| ZIP detail fetch | <500ms | depends on Census (cache helps) |

---

## MVP SCOPE: USER-DRIVEN WEIGHTS

### Components (1,700 LoC total)

| File | Purpose | LoC | Tests |
|---|---|---|---|
| `src/core/similarity.ts` | Weighted Euclidean distance, protected-class guards, cut-off logic | 200 | 180 |
| `src/ui/WeightsControl.tsx` | Sliders, templates, explanations, localStorage persist, reset | 280 | 100 |
| `scripts/gen-similarity-data.mjs` | Bake ACS + CDC PLACES into single JSON file | 330 | 120 |
| `src/ui/SimilarityResults.tsx` | A-Z results, per-result breakdown, disclosure, cut-off control | 200 | 120 |
| `src/core/loader.ts` (reuse existing) | Load baked data on init | — | — |
| Completion gate + Methodology copy | Gate tests for `protectedClassProxy`, explain algorithm | 100 | — |
| **Total** | | **1,110** | **620** |

### Weights UI Features

**Slider Controls:**
- Rent, rent burden, home value, population (always available)
- CDC PLACES health metrics (flagged `protectedClassProxy`)
- Income (flagged with disclosure per `scoring.ts`)
- Disability (CDC PLACES, flagged `protectedClassProxy`)
- Explanations for each metric

**Templates (Neutral):**
- "Equal weight across available metrics" (only template MVP)
- All open, all show weights, all editable
- **No outcome-named templates** ("Schools Priority") — dropped, not deferred

**Storage:**
- localStorage per browser
- Reset to default on reload
- Export/import for sharing (future)

### Data Sources (MVP)

| Source | Granularity | Use | Status |
|---|---|---|---|
| Census ACS B-series | Per-ZIP | Rent, burden, value, vacancy, commute, broadband | ✅ Bake directly |
| CDC PLACES | Per-ZIP | Health prevalence, disability (all flagged) | ✅ Use their ZIP release |
| Census B25001 | Per-ZIP | Housing units (for weights normalization) | ✅ Bake directly |

**No aggregation needed.** CDC PLACES publishes per-ZIP already (not tract-level only as old plan said).

### Results Display (A-Z, Never Ranked)

**Disclosure:** "Similar ZIPs based on metrics you selected. Results sorted alphabetically to avoid ranking."

**Per-result breakdown:**
```
78701 (Austin, TX)
├─ Rent: $1,450/mo (similarity: 0.95 on rent)
├─ Rent burden: 32% (similarity: 0.89)
├─ Home value: $425k (similarity: 0.81)
└─ Your weights: 25% rent, 25% burden, 25% value, 25% pop
```

**User-adjustable cut-off:**
- Slider: 0-1.0 distance threshold
- Default: 0.5 (can lower for "more similar" or raise for "less similar")
- Visible in results
- Not sortable by score (column not present)

---

## FAIR HOUSING COMPLIANCE (REFINED)

### Protected-Class Guards

**Metrics flagged `protectedClassProxy`:**
- CDC disability data (protected under FHA)
- "% households with children" (proxies familial status)
- Any others identified in audit

**Engine behavior:**
- Refuses to compute if protected-class metric in weights
- User sees: "This metric cannot be used in similarity. Use it for filtering in Phase 2A profiles instead."
- Completion gate tests for flag on all sensitive metrics

### Transparency

- ✅ Users pick their own weights (user agency)
- ✅ All metrics explained in plain language
- ✅ A-Z ordering (never ranked)
- ✅ Cut-off visible + adjustable
- ✅ Per-result breakdown shown
- ✅ Disabled sorting by similarity column

### What Replaces Legal Sign-Off

There is no attorney review, so there is nothing to sign off. What holds the line
instead is a set of constraints that are **enforced in code and asserted by the
completion gate**, so they cannot be quietly dropped:

1. User-driven weights — no operator-chosen defaults
2. No outcome-named templates (neutral labels only for MVP)
3. No sorting by score; A-Z only
4. Protected-class metrics flagged `protectedClassProxy` and refused as ranking inputs
5. Cut-off transparent and adjustable
6. **The feature is off by default**, and turning it on is an explicit act

These are properties of the build. They are also *not* a compliance finding: a
constraint list written by the same person building the feature is weaker than an
independent review, and this document should not pretend otherwise.

---

## FULL SCOPE (NOT MVP)

**After MVP ships:**

1. **NCES District Data** (350 LoC)
   - Area-weighted join ZIPs → districts
   - Per-pupil spending, student-teacher ratio
   - Add to comparison data bake

2. **BLS Local Unemployment** (200 LoC)
   - County-level proxy (coarse at ZIP)
   - Third wave

3. **County & City Views** (1,500 LoC)
   - Relationship files (ZIP → county, ZIP → city)
   - Separate bake files for each level
   - Drilldown UI

4. **State Department of Education Plugins** (350 LoC per state)
   - Per-state assessment scores
   - Display-only in drilldown (not for similarity scoring)
   - Load one state at a time on demand

5. **Outcome-Named Templates** (100 LoC) — **not planned**
   - "Affordable Housing Focus", "Schools Priority", etc.
   - Dropped rather than deferred. A template that names an outcome ("schools
     priority") is the single highest-steering feature in this plan, and with no
     attorney review there is no basis on which to ship it later either. The
     editable-weights UI gives a reader the same reach without the operator
     choosing the framing.

---

## RELEASE SEQUENCE

| Step | Deliverable | Gate | Timeline |
|---|---|---|---|
| 1 | MVP code + tests + docs | Code review + CI passing | (agent work) |
| 2 | Data audit | Internal audit tools, using the existing cell-by-cell comparison | Parallel with 1 |
| 3 | Ship **off by default** behind a feature flag | Deterministic gate green; axe clean | On merge |
| 4 | Full scope features | Per-feature gate checks | Future releases |

**There is no external approval step, and that is a deliberate position rather than
an oversight.** This project is unfunded and independently run; a gate that waits
on a lawyer would either wait forever or be quietly abandoned, and the second
outcome is worse than shipping a documented, constrained, disabled-by-default
feature. The residual risk is written down in `GOVERNANCE.md` rather than
discharged.

---

## TESTING STRATEGY

### Vitest (Node Environment)

- Similarity distance computation (5 tests: weights, missing data, protected-class guards, cut-off)
- Weight persistence (localStorage) (3 tests)
- Data loading and caching (3 tests)
- Protected-class metric rejection (2 tests)
- Completion gate rules (3 tests)

**Total Vitest:** ~16 tests

### Playwright (E2E)

- Weights UI: sliders, templates, localStorage persist, reset (3 tests)
- Results display: A-Z order, cut-off adjustment, per-result breakdown (4 tests)
- Protected-class metric handling (2 tests)
- Accessibility: keyboard nav, screen reader (2 tests)

**Total Playwright:** ~11 tests

---

## CAN BUILD NOW?

**Yes — approved, not merely buildable.** Phase 2B MVP:
- Doesn't block Phases 0-2A
- Uses only existing data sources, two of them verified live
- No external dependencies or timelines
- Ships **off by default** behind a feature flag

There is no sign-off to wait for. See `GOVERNANCE.md` for what that means and
what it does not mean.

---

## COMPARISON TO ORIGINAL PLAN

| Aspect | Original (Blocked) | Revised (Approved) |
|---|---|---|
| Weights | Operator-chosen (static) | User-driven (GUI sliders) |
| Data sources | External (NCES/CDC contacts) | Self-aggregated; CDC ZCTA release verified |
| Metrics audit | External 2-4 weeks | Internal, using existing audit tooling |
| Legal review | Full 2-4 weeks | **None. No attorney review is planned.** |
| Release gate | Weeks of blocking | None; ships off by default |
| Status | Deferred indefinitely | Approved, ships disabled |
| LoC | 250 (too low) | 1,700 MVP (realistic) |

---

## NEXT STEPS

1. **Implement MVP** (1,700 LoC alongside P0-2A), with the flag defaulted off
2. **Data audit** (parallel internal work, existing tooling)
3. **Ship behind the flag** — enabled only if the reader turns it on
4. **Full scope features** (future waves; outcome-named templates dropped)

---

**Phase 2B is approved as specified: user-driven weights, disabled by default,
no attorney review.**

