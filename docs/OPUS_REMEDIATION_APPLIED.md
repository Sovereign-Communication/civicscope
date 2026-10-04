# Opus Remediation Applied to CivicScope PR Scopes

**Date:** 2026-10-04  
**Status:** Critical fixes applied. Ready for implementation.

---

## Summary of Changes

All four PR scopes have been corrected based on Opus 5.5 detailed review. Major changes:

1. **LoC totals corrected:** 5,450 → 4,200 total (2,950 code + 1,250 tests)
2. **Data source strategy:** Bake ZCTA-to-city Census file (not Photon)
3. **Fair Housing safety:** Remove school/health profile filters (no ZIP-level data exists)
4. **Testing approach:** Vitest for hooks/pure logic, Playwright for components
5. **CI permissions:** Open PR instead of push (write permissions scoped)
6. **Accessibility patterns:** Combobox instead of listbox, native dialog instead of custom modal

---

## Phase 0: City/State Search Foundation

**Corrected LoC: 950 (down from 1,200)**

### Key Corrections Applied

1. **Data Source: Baked ZCTA-to-City File**
   - Source: Census 2020 ZCTA-to-Place relationship file
   - For each ZCTA: Keep place with largest land overlap, extract state
   - Fallback: Rural ZCTAs without city → show county name
   - Location: `public/map/zcta-city-mapping.json.gz` (150-200KB gzipped)
   - Pattern: Follow existing `tools/gen-map-data.mjs` approach
   - Benefits: Covers all 33k ZIPs, no network calls, stays in bundle CSP

2. **SearchAutocomplete Realistic LoC**
   - Claimed: 300 LoC
   - Actual: ~190 LoC
   - Breakdown: Debounce (25) + cache (10) + selection/keyboard (60) + markup (70) + edge cases (10) + imports (15)
   - Uses existing `geocode()` function (not direct Photon calls)
   - Uses existing `cache.ts` (not new localStorage)

3. **Type System Correction**
   - `ResolvedPlace` already exists in `src/core/types.ts` with `zip`, `name`, `county`, `state`
   - No signature changes needed to `selectPlace()`
   - No new type definition required

4. **Accessibility Pattern: Combobox**
   - Use: `role="combobox"`, `aria-expanded`, `aria-activedescendant`
   - Live region for result count announcement
   - NOT `role="listbox"` (that's for read-only lists)

5. **Testing Approach**
   - Vitest (Node environment): Autocomplete selection logic as pure function
   - Playwright E2E: Rendering, keyboard nav, Photon mocking
   - All E2E tests in `src/e2e/` (not top-level `e2e/`)

### Updated Files

| File | Change | LoC |
|------|--------|-----|
| `src/core/zcta-city-mapper.ts` | NEW: Load ZCTA→city file on demand | 60 |
| `scripts/gen-zcta-city-mapping.mjs` | NEW: Generate Census relationship file | 120 |
| `src/ui/SearchAutocomplete.tsx` | NEW: Combobox with debounce + cache | 190 |
| `src/ui/CityZipBrowser.tsx` | NEW: List ZIPs in city (sort by ZIP, not pop) | 110 |
| `src/core/useHousingQuery.ts` | MODIFY: Multi-result disambiguation (+50) | 50 |
| `src/ui/App.tsx` | MODIFY: Wire autocomplete (+30) | 30 |
| `src/ui/Comparison.tsx` | MODIFY: City/state display (+60) | 60 |
| `src/ui/MetricCard.tsx` | MODIFY: City/state in header (+30) | 30 |
| `src/ui/SweepTable.tsx` | MODIFY: City/state column (+70) | 70 |
| Tests | Unit (Vitest) + E2E (Playwright) | 300 |
| **Total** | | **950** |

---

## Phase 1: Onboarding & Core Tools

**Corrected LoC: 1,650 (down from 3,350)**

### Key Corrections Applied

1. **Tour Restructuring**
   - Claimed: 3 files (GuidedTour, TourStep, Tooltip) = 800 LoC
   - Actual: 1 file using native `<dialog>` element = ~210 LoC
   - Reduces complexity, uses standard HTML5 semantics
   - Accessibility: Built-in focus trap, Escape dismissal, dialog roles

2. **Sample Data Script Recount**
   - Claimed: 500 LoC (app) + 200 (script) = 700
   - Actual: 260 total
     - App integration: ~70 (synchronous import, not Promise)
     - Script `.mjs`: ~150
     - Workflow: ~40
   - Fixed ZIP list: 55 ZIPs with 1-line reason per ZIP (not 50 claimed)
   - One batched Census ACS request (not 50 individual calls)
   - Deterministic JSON output (unchanged runs produce no diff)

3. **Sample Data: Corrected ZIP Selection**
   - Opus identified 34 ZIPs listed (10+10+4+10), not 50
   - Corrected: 55 ZIPs total
     - 10 major metros (NYC, Austin, LA, SF, Chicago, Denver, Portland, Seattle, Phoenix, DC)
     - 12 mid-size (Austin, Denver, Portland, Seattle, Nashville, Atlanta, Charlotte, Raleigh, SLC, Boulder, plus 2 more)
     - 8 expensive suburbs (SF, Boston, DC area, Silicon Valley corridors)
     - 15 affordable (rural Deep South, Appalachia, Great Plains)

4. **CI Permissions for Sample Data Refresh**
   - Change: Open PR instead of push directly
   - Permissions: `contents: write` + `pull-requests: write` (scoped to refresh job only)
   - Use: Built-in workflow token + preinstalled `gh` CLI
   - Schedule: January (not September) — ACS 5-year data released in December
   - Caveat: Manual trigger in CI because PR-opened events don't trigger `pull_request` run

5. **Quick-Add: Use Existing `deselect()`**
   - Issue: `selectPlace(null)` not valid
   - Fix: Use existing `deselect(zcta)` function
   - Keyboard shortcuts `[` and `]`: Add conflict check, require discoverable help text

6. **Mobile Table: Reuse Existing Windowing**
   - `SweepTable` already uses custom windowing for 33k rows
   - P1.5: Add card view layout + focus retention logic
   - Don't re-implement windowing (claimed 700 LoC was overestimate)
   - Actual: ~230 LoC (card layout, focus management, sort handler)

7. **Accessibility Corrections**
   - Tooltip pattern: Use disclosure or popover (not `role="tooltip"` with close button)
   - Fixed badge: Ensure doesn't cover focused elements (WCAG 2.2.11)
   - Touch targets: Standardize on 44px (not mix of 44px and 48px)
   - Modal: Native `<dialog>` handles focus trap + Escape
   - Animations: Wrap in `prefers-reduced-motion` check

### Updated Files

| Component | LoC | Notes |
|-----------|-----|-------|
| `src/ui/GuidedTour.tsx` | 210 | Native `<dialog>`, 1 component |
| `src/ui/SharedPopover.tsx` | 90 | Reusable for tour + help |
| Sample data app + script | 260 | Sync import, batched Census call |
| GitHub Actions workflow | 40 | PR-based refresh, January schedule |
| Quick-add (SweepTable) | 160 | Use deselect(), keyboard conflict check |
| Help system (Comparison + icons) | 180 | Disclosure pattern, 44px consistent |
| Mobile cards (SweepTable) | 230 | Reuse windowing, focus retention |
| Tests | 500 | Vitest for hooks, Playwright for components |
| **Total** | **1,650** | |

---

## Phase 2A: Profiles, Export, Methodology, Accessibility

**Corrected LoC: 1,600 (features code ~1,150 + tests ~450)**

### Key Corrections Applied

1. **Profile Builder: Filters Corrected**
   - **Removed:** School grades (A-C), health score
   - **Reason:** No ZIP-level data exists (NCES = district, CDC = tract)
   - **Kept:** Rent, rent burden, home value, population
   - **Income:** Retained only with `FairHousingNotice` disclosure (correlates with protected classes)
   - **Claim:** Removed "Safe by design" language (now: "Transparent by design")
   - **Logic:** Reuse existing `protectedClassProxy` rule from `scoring.ts`

2. **Data Export: Format Corrections**
   - Raw numbers, not formatted strings (user's spreadsheet does formatting)
   - Separate unit columns (e.g., "rent" number + "rent_unit" = "USD")
   - CSV escaping: Prevent formula injection (prefix formulas with apostrophe)
   - Never export Census `-666666666` sentinels (repo integrity tests forbid)
   - Show "N/A" for missing values

3. **Methodology: Scope Clarified**
   - Cover all 30 metrics with definitions, Census table IDs, vintage, data quality %
   - Searchable by metric name + keyword
   - Tabs: All / Housing / Schools / Health / Demographics
   - Links to Census.gov source tables

4. **AAA Accessibility: Scoped Correctly**
   - Claimed: 400 LoC (unrealistic for "zero AAA violations")
   - Actual: ~130 LoC (targeted fixes)
   - Includes: Contrast ratios (7:1), focus outlines, skip links, `prefers-reduced-motion`
   - Testing: Vitest for contrast/focus logic + Playwright manual audit
   - Claim: Dropped "zero AAA violations" (axe-core checks < 20 AAA rules)
   - Replace with: "WCAG 2.2 AA compliance + targeted AAA improvements"

5. **Testing Approach**
   - Vitest: Pure logic (matcher, export formatting, URL state)
   - Playwright: Rendered UI (profile builder, methodology search, export download)
   - Mocked Census/Photon responses (no flaky network tests)
   - All E2E in `src/e2e/`

### Updated Files

| Component | LoC | Notes |
|-----------|-----|-------|
| `src/core/savedSearches.ts` | 160 | localStorage CRUD, simple |
| `src/core/urlState.ts` | 100 | Encode/decode, input validation |
| `src/ui/ProfileBuilder.tsx` | 130 | Rent + burden + value + population filters |
| `src/core/profileMatcher.ts` | 100 | Pure filter function, A-Z sort, enforce `protectedClassProxy` rule |
| `src/core/export.ts` | 160 | Raw numbers, CSV escaping, validate output |
| `src/ui/MethodologyPanel.tsx` | 350 | 30 metrics + definitions + links |
| AAA accessibility work | 130 | Contrast + focus + skip links + manual audit |
| Tests | 450 | Vitest + Playwright |
| **Total** | **1,600** | |

---

## Phase 2B: Similarity Scoring (SUPERSEDED — see below)

**Status at time of writing:** DEFERRED pending blockers. **Later resolved.**

Both blockers are now closed, and the second one is closed by declining it:

- **Legal review: dropped, not satisfied.** This project will not obtain an
  attorney review. The mitigation is that similarity ships **off by default**
  behind a feature flag with reader-chosen weights and no operator defaults.
- **Metrics audit: answered with evidence.** CDC PLACES does publish a ZCTA-level
  release (`qnzd-25i4`, verified live, 1,171,563 rows, keyless). The earlier
  "CDC is tract-level only" belief described this repository's plugin, not CDC's
  catalogue. NCES remains district-level and is deferred rather than approximated.
- **Sorting doesn't eliminate ranking: still true, and still the reason the
  feature is off by default.** Showing the "closest N" is inherently a ranking.
  Alphabetical display does not change that; making the reader opt in does.

`PR_PHASE_2B_SCOPE.md` is authoritative. Nothing in this section should be read as
a current status.

Opus feedback on blockers, retained because the substance still stands even though
the gating decision has changed:
- **Legal review:** disparate-impact testing of results, not just a weights opinion. Still the right test; it is now recorded as residual risk in `GOVERNANCE.md` instead of a release gate, because no attorney will perform it
- **Proxy option (b):** District/tract averages carry the same steering risk, so they are dropped rather than signed off. NCES is deferred
- **Sorting doesn't eliminate ranking:** "top 5-8 closest" is inherent ranking. This is why the feature is off by default

The earlier conclusion — "no changes to Phase 2B scope needed; blockers remain
blocking" — was overtaken by a decision on 2026-10-04 to drop the legal gate and
ship disabled by default.

---

## Revised LoC Totals (All Phases)

| Phase | Code | Tests | Total | Original |
|-------|------|-------|-------|----------|
| **P0** | 650 | 300 | **950** | 1,200 |
| **P1** | 1,150 | 500 | **1,650** | 3,350 |
| **P2A** | 1,150 | 450 | **1,600** | 1,550 (actually 2,000) |
| **All Three** | **2,950** | **1,250** | **4,200** | 5,450–6,100 |

**LoC reduction:** ~25% (mostly in tour, sample data, mobile table, AAA)

---

## Critical Changes Summary

1. ✅ **ZCTA-to-city mapping:** Baked file (not Photon API)
2. ✅ **School/health filters:** Removed from profiles (no data exists)
3. ✅ **Tour:** Single component with native `<dialog>` (not 3 files)
4. ✅ **Sample data:** Sync import, batched Census call, PR-based refresh
5. ✅ **Mobile table:** Reuse existing windowing (not rebuild)
6. ✅ **CI permissions:** Write scope only for refresh job
7. ✅ **Accessibility:** Combobox pattern, disclosure tooltips, native dialog
8. ✅ **Testing:** Vitest for logic, Playwright for components
9. ✅ **Fair Housing:** Remove school/health; keep income with disclosure

---

## Implementation Ready

All four PR scopes updated with Opus corrections. Ready for agent execution:

1. Phase 0 (950 LoC) → Phase 1 (1,650 LoC) → Phase 2A (1,600 LoC)
2. No circular dependencies
3. All assumptions validated against repo code
4. LoC estimates calibrated to existing component sizes
5. Accessibility patterns aligned with repo practices
6. Fair Housing safety improved (removed problematic filters)

