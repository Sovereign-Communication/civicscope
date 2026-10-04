# CivicScope 72→95 UX Implementation Guide

> **PARTIALLY SUPERSEDED.**
>
> - **Phase 0 is wrong.** This document says to modify `src/ui/SearchInput.tsx`
>   (no such file), add a `ResolvedPlace` shape of `{zcta, city, state}` (neither
>   `zcta` nor `city` exists), write unit tests in `src/ui/*.test.tsx`
>   (`vite.config.ts` collects `*.test.ts` only, so they would never run), place
>   browser tests in a top-level `e2e/` (only `src/e2e/**/*.e2e.ts` is collected),
>   and run `npm run test:a11y` (no such script). It also budgets +8KB against a
>   bundle that measures 95 kB gzipped, not the ~500 kB claimed.
>   **`PHASE_0_RECONCILIATION.md` replaces the Phase 0 section entirely.**
> - **Phase 2B is answered.** See its DECIDED section below.
> - Phases 1 and 2A were not re-checked against the tree.

**Total Implementation:** 5,450 LoC (P0: 1,200 + P1: 3,350 + P2A: 1,550)  
**Phases:** 4 sequential PRs  
**Execution Order:** P0 → P1 → P2A assessment → P2B (if needed)  
**Branch:** `ccr-a1306203-osmm3o`

---

## QUICK REFERENCE

| Phase | LoC | Status | Next |
|-------|-----|--------|------|
| **P0** | 1,200 | ✅ READY | Start immediately; after merge, start P1 |
| **P1** | 3,350 | ✅ READY | After P0 merge; after merge, assess Phase 1 UX |
| **P2A** | 1,550 | ⏳ CONDITIONAL | After P0+P1, assess if 95/100 reached; if not, start P2A |
| **P2B** | 1700 | APPROVED, flag off by default | No legal gate; reader sets weights |

---

## PHASE 0: EXECUTION SEQUENCE

**Start:** Immediately (no dependencies)  
**Duration:** 1,200 LoC  
**Deliverable:** PR #1 (City/State search)

### Pre-Implementation Checklist

- [ ] Read `PR_PHASE_0_SCOPE.md` (complete scope)
- [ ] Verify `src/core/geocode.ts` exists (contains TIGERweb + Photon support)
- [ ] Run existing E2E tests to baseline performance
- [ ] Set up local testing environment (npm run dev)

### Files to Create

**Order of creation (dependency order):**

1. `src/ui/SearchAutocomplete.tsx` (300 LoC)
   - Implement Photon API integration (already imported in geocode.ts)
   - Debounce: 400ms minimum (use existing debounce pattern from codebase)
   - localStorage cache: Key format `civicscope.autocomplete.{hash(query)}`
   - Keyboard navigation: Arrow keys, Enter, Escape
   - Touch target: 44px minimum
   - Tests: 8 unit tests (in src/ui/SearchAutocomplete.test.tsx)
   - Verify: Photon response format, US filtering, postcode prioritization

2. `src/ui/CityZipBrowser.tsx` (400 LoC)
   - Collapsible section (integrate with existing Comparison structure)
   - Lazy-load ZIPs on expand (don't fetch all upfront)
   - Top 10 ZIPs by population
   - Checkboxes for add/remove (call existing selectPlace())
   - Tests: 6 unit tests

### Files to Modify

**Order (dependencies considered):**

1. `src/core/geocode.ts` (verify only, no changes expected)
   - Spot-check Photon response format
   - Verify city/state extraction
   - Document assumptions in comments

2. `src/core/useHousingQuery.ts` (+100 LoC)
   - Add type: `ResolvedPlace { zcta, city, state, lat, lon, precise }`
   - Update `selectPlace()` signature: accepts city + state
   - Add multi-result modal logic
   - Tests: 4 tests (in existing useHousingQuery.test.ts)

3. `src/ui/App.tsx` (+30 LoC)
   - Import SearchAutocomplete
   - Render below search input
   - Wire suggestion clicks to selectPlace()
   - No state changes (use existing housing query state)

4. `src/ui/Comparison.tsx` (+100 LoC)
   - Add city/state display in header (format: "ZIP | City, State")
   - Import + render CityZipBrowser (collapsible)
   - Tests: 3 tests

5. `src/ui/MetricCard.tsx` (+30 LoC)
   - Update header: "ZIP | City, State"
   - State display next to ZIP

6. `src/ui/SweepTable.tsx` (+50 LoC)
   - Rename column: "ZCTA" → "ZIP & Location"
   - Format: "ZIP\nCity, State" (multi-line)
   - Apply to desktop + mobile layouts

### Verification Steps (In Order)

**After file creation/modification:**

1. **Syntax check:** `npm run typecheck`
   - Should pass with zero errors
   - If TS errors: Fix before proceeding

2. **Unit tests:** `npm run test -- src/ui/SearchAutocomplete.test.tsx`
   - Run tests for SearchAutocomplete (8 tests)
   - Verify debounce behavior
   - Verify localStorage cache hits
   - All must pass

3. **Unit tests:** Other modified files
   - `npm run test -- src/core/useHousingQuery.test.ts`
   - `npm run test -- src/ui/Comparison.test.tsx`
   - All must pass

4. **E2E tests (manual flow):** `npm run dev`
   - Open browser at localhost:5173 (or configured port)
   - Type "Austin" in search → autocomplete dropdown appears
   - Verify suggestions: Austin TX, Austin MN, etc.
   - Click "Austin, TX (78701)" → area loads
   - Verify results display "Austin, TX" alongside ZIP
   - Click "Browse Austin ZIPs" → list appears
   - Click checkbox on Austin ZIP → adds to comparison
   - Verify comparison shows "Austin, TX" for all areas

5. **Accessibility audit (automated):** 
   - `npm run test:a11y` (if exists, or run axe-core manually)
   - Zero accessibility violations expected
   - Verify touch targets >= 44px

6. **Performance baseline:**
   - Open DevTools → Network tab
   - Type "Austin" → verify first suggestion < 500ms
   - Verify Photon API called once (debounce works)
   - Load sweep table → verify city/state column renders without lag

7. **Bundle size check:**
   - `npm run build` → check gzip size delta
   - Expected: +5-8KB
   - If > 12KB: Investigate and optimize

8. **Commit message:**
   ```
   feat: Add city/state search interoperability (Phase 0)

   - Smart search input with city/state placeholder
   - Autocomplete dropdown (Photon-powered)
   - Reverse city/state display in results
   - Browse city ZIPs (select multiple neighborhoods)
   - Search result clarity ("Did you mean?")
   - Results table enhancement (city/state column)

   Phase 0 foundation enables city-based discovery.
   All 1,200 LoC + 25+ tests passing.
   Bundle size +7KB gzipped.
   ```

### Approval Criteria

**Before opening PR:**
- [ ] All 25+ tests passing
- [ ] axe-core accessibility audit: Zero violations
- [ ] E2E manual flow works (autocomplete → load → display)
- [ ] Bundle size <= 12KB increase
- [ ] TypeScript: Zero errors

**PR Review (Opus):**
- [ ] Scope complete (all 6 features included)?
- [ ] Architecture consistent with existing patterns?
- [ ] Missing edge cases or tests?

**After approval, merge to ccr-a1306203-osmm3o**

---

## PHASE 1: EXECUTION SEQUENCE

**Start:** After Phase 0 merged  
**Duration:** 3,350 LoC  
**Deliverable:** PR #2 (Onboarding + tools)

### Pre-Implementation Checklist

- [ ] Phase 0 merged to ccr-a1306203-osmm3o
- [ ] Run P0 E2E tests to verify baseline
- [ ] Read `PR_PHASE_1_SCOPE.md` (complete scope)
- [ ] Verify `src/ui/Tooltip.tsx` doesn't exist (or plan to reuse if exists)

### Files to Create

**Order (dependency order):**

1. **Tour components** (800 LoC total)
   - `src/ui/GuidedTour.tsx` (250 LoC)
     - Parent component, tour state management
     - 3 steps: Welcome → Comparison → Census key
     - localStorage flag: `civicscope.toured = true`
     - Dismissible, keyboard accessible
     - Tests: 5 tests
   
   - `src/ui/TourStep.tsx` (200 LoC)
     - Individual step rendering
     - Animated fade-in/out (300ms)
     - Highlight logic (spotlight on target element)
     - Next/Back/Skip buttons
     - Tests: 3 tests
   
   - `src/ui/Tooltip.tsx` (100 LoC) [IF NOT EXISTING]
     - Reusable tooltip (used by tour + help icons in P1.4)
     - Position logic (top/bottom, avoid viewport edges)
     - Close button, dismissible
     - Tests: 2 tests
   
   - Modify `src/ui/App.tsx` (+150 LoC)
     - Import GuidedTour
     - Render conditionally (first visit only)
     - Wire up tour completion callback

2. **Sample data** (700 LoC total)
   - `src/data/sampleZips.json` (GENERATED)
     - 50 representative ZIPs (json format, pre-computed)
     - Format: `[{ zcta, city, state, metrics: { rent, rentBurden, ... } }, ...]`
     - Do not hand-edit; generated by script
   
   - `scripts/generate-sample-data.ts` (200 LoC)
     - Node script (TypeScript)
     - Fetches ACS 5-year data from Census API
     - Validates absence sentinels (-666666666, etc.)
     - Serializes to JSON
     - Handles CLI args: `--census-key=...`
     - Tests: 3 integration tests (verify output format)
   
   - `.github/workflows/sample-data-refresh.yml` (50 LoC)
     - GitHub Actions workflow
     - Trigger: Manual (workflow_dispatch) or scheduled mid-September
     - Runs script, commits if changes, pushes
     - Requires CENSUS_KEY secret (existing)
   
   - Modify `src/core/useHousingQuery.ts` (+100 LoC)
     - Add `loadSampleData()` function
     - Returns sample ZIPs from bundled data
   
   - Modify `src/ui/App.tsx` (+100 LoC, in addition to tour changes)
     - On load, if no Census key: Show sample ZIPs in comparison
     - Banner: "Explore sample neighborhoods"
     - "Add Census key to unlock all 33k ZIPs"

3. **Quick-add comparison** (600 LoC)
   - Modify `src/ui/SweepTable.tsx` (+300 LoC)
     - Add checkbox column (first column, before ZCTA)
     - Click → selectPlace(zcta)
     - Max 6 areas (disable after 6th)
     - Keyboard: `[` add, `]` remove
     - Tests: 5 tests
   
   - Modify `src/ui/App.tsx` (+50 LoC, additional)
     - Add floating badge: "Comparing [N/6]"
     - Clear all button

4. **Guided comparison help** (450 LoC)
   - `src/ui/ComparisonHelp.tsx` (250 LoC)
     - Collapsible "Understanding these figures"
     - 3 subsections: MOE, derived metrics, absence
     - Auto-expand first visit (localStorage)
     - Tests: 4 tests
   
   - `src/ui/HelpIcon.tsx` (100 LoC)
     - "?" icon wrapped in 44px button (CRITICAL)
     - Click → tooltip
     - Keyboard: Tab/Enter/Escape
     - Tests: 3 tests
   
   - Modify `src/ui/MetricCard.tsx` (+100 LoC)
     - Place HelpIcon on badges (margin, computed, absence)
     - Tests: 2 tests
   
   - Modify `src/ui/Comparison.tsx` (+50 LoC, additional)
     - Render ComparisonHelp above first comparison

5. **Mobile table redesign** (700 LoC)
   - Modify `src/ui/SweepTable.tsx` (+400 LoC, additional)
     - Detect breakpoint: < 640px
     - Render card view (single column)
     - Card layout: ZIP | City | Rent | Burden | [Remove]
     - Sortable by clicking headers
     - Windowed rendering (33k items)
     - Tests: 5 tests
   
   - Modify `src/ui/App.tsx` (+50 LoC, additional)
     - Detect mobile, pass isMobile prop

### Verification Steps (In Order)

**After all P1 files created:**

1. **TypeScript check:** `npm run typecheck`
   - Zero errors

2. **Unit tests:** Run all P1 test files
   - `npm run test -- src/ui/GuidedTour`
   - `npm run test -- src/ui/ComparisonHelp`
   - `npm run test -- src/ui/HelpIcon`
   - `npm run test -- src/core/useHousingQuery` (updated)
   - `npm run test -- src/ui/SweepTable` (updated)
   - All 30+ tests passing

3. **Build + bundle check:**
   - `npm run build`
   - Bundle size increase <= 15KB gzipped
   - `dist/` folder generated successfully

4. **E2E manual flow (desktop):**
   - `npm run dev`
   - First visit: Tour renders (3 steps)
   - Complete tour → localStorage flag set
   - Refresh page → tour doesn't render (flag detected)
   - Sample ZIPs appear in comparison (no Census key)
   - Click checkbox on sweep table → area adds
   - Floating badge shows "Comparing [N/6]"
   - Help section visible (auto-expanded)
   - Click "?" icon → tooltip appears
   - Help section collapsible (toggle)

5. **E2E manual flow (mobile, < 640px):**
   - `npm run dev`
   - Resize browser to 375px width
   - Card view renders (not table)
   - Each card: ZIP | City | Metrics | [Remove]
   - Click sort header → cards resort
   - Touch target >= 48px (measure with DevTools)
   - Scroll 33k cards smoothly (60fps, no lag)

6. **Accessibility audit:**
   - `npm run test:a11y` (or axe-core manual)
   - Focus indicator on all buttons (visible outline)
   - aria-label on icons
   - 44px button wraps "?" icons (measure with DevTools)
   - aria-live on floating badge
   - Zero AA violations (should improve or maintain from P0)

7. **Performance:**
   - Tour: Renders < 100ms (lazy-load)
   - Sample data: Loads < 500ms (bundled)
   - Mobile card sort: < 500ms for 33k items
   - Scroll: 60fps, smooth (use DevTools perf profiler)

8. **Commit message:**
   ```
   feat: Add onboarding, sample data, and core tools (Phase 1)

   - First-visit guided tour (3 steps)
   - Sample data (50 representative ZIPs)
   - Annual CI/CD refresh script
   - Quick-add comparison (checkbox + keyboard)
   - Guided help system (collapsible + icons)
   - Mobile table redesign (card view, sortable)

   Phase 1 onboarding reduces friction significantly.
   All 3,350 LoC + 30+ tests passing.
   Bundle size +250 LoC (amendments applied).
   Mobile tested on 375px viewport.
   ```

### Approval Criteria

**Before opening PR:**
- [ ] All 30+ tests passing
- [ ] axe-core accessibility: Zero violations (AA)
- [ ] E2E manual flow (desktop + mobile) works
- [ ] Tour + sample data + help + quick-add all functional
- [ ] Bundle size increase <= 15KB
- [ ] TypeScript: Zero errors
- [ ] Mobile: 375px viewport renders without zoom/scroll

**PR Review (Opus):**
- [ ] P1 complete? All 5 features included?
- [ ] Tests adequate? Coverage > 80%?
- [ ] Mobile layout solid?
- [ ] Sample data strategy (annual script) approved?

**After approval, merge to ccr-a1306203-osmm3o**

---

## PHASE 1 ASSESSMENT

**After P1 merged, before starting P2A:**

### UX Score Assessment (1-2 days)

1. **Manual UX audit:**
   - New visitor onboarding: 3-step tour clear?
   - Sample data discovery: Can explore without Census key?
   - Help system: Does margin-of-error explanation work?
   - Quick-add: Comparison building smooth?
   - Mobile: Card view solves horizontal scroll?

2. **Quantify score:**
   - Current (after P0+P1): Est. 78 → 85/100 (per original plan)
   - Question: Does P0+P1 alone reach 95/100?
   - Answer will determine if P2A needed

3. **Decision:**
   - If score >= 95: Launch complete, declare Phase 1 success
   - If score < 95: Proceed to Phase 2A
   - If score >= 92: Optional Phase 2A (would polish to 95+)

---

## PHASE 2A: EXECUTION SEQUENCE (Conditional)

**Start:** Only if P0+P1 score < 95/100  
**Duration:** 1,550 LoC  
**Deliverable:** PR #3 (Profiles + export + methodology + AAA)

### Pre-Implementation (If P0+P1 < 95)

- [ ] P0 + P1 merged
- [ ] UX assessment completed (score < 95 confirmed)
- [ ] Read `PR_PHASE_2A_SCOPE.md` (complete scope)
- [ ] Identify which P2A feature(s) would address lowest-scoring UX areas

### Files to Create

**Order (dependency order):**

1. **Saved searches** (300 LoC)
   - `src/core/savedSearches.ts` (300 LoC)
     - Save, load, list, delete, rename comparisons
     - localStorage keys: `civicscope.saved[id]`
     - Max 50 searches (~500KB)
     - Tests: 5 tests

2. **URL-based sharing** (150 LoC)
   - `src/core/urlState.ts` (150 LoC)
     - Encode: `encodeComparisonState(zctas, preset) → string`
     - Decode: `decodeComparisonState(url) → { zctas, preset }`
     - Format: `/compare?z=78701,78702&preset=renting`
     - Tests: 4 tests

3. **User-defined profiles** (350 LoC)
   - `src/ui/ProfileBuilder.tsx` (200 LoC)
     - Filter builder UI (rent, schools, health, population)
     - Apply filters, reset
     - Show result count
     - Tests: 4 tests
   
   - `src/core/profileMatcher.ts` (150 LoC)
     - Match ZIPs against filter criteria
     - A-Z sort (never ranked)
     - Cap at 1,000 results
     - Tests: 6 tests

4. **Data export** (300 LoC)
   - `src/core/export.ts` (300 LoC)
     - Export CSV + JSON
     - Columns: ZCTA, City, State, Metrics, MOE, Source, Vintage
     - Tests: 4 tests

5. **Methodology** (500 LoC)
   - `src/ui/MethodologyPanel.tsx` (300 LoC)
     - Searchable methodology guide
     - Per-metric deep dives
     - Links to Census tables
     - Tests: 3 tests
   
   - `src/data/methodology.ts` (200 LoC)
     - Static data: All 30 metrics + definitions

6. **AAA Accessibility** (400 LoC)
   - Various files (modify, +400 LoC total)
     - Color contrast: 7:1 ratio
     - Keyboard navigation: Full app
     - Screen reader: NVDA + JAWS support
     - Focus management: Focus trap, skip links
     - Tests: 5 E2E accessibility tests

### Verification Steps (In Order)

**After all P2A files created:**

1. **TypeScript check:** `npm run typecheck`
   - Zero errors

2. **Unit tests:** All P2A test files
   - All 25+ tests passing

3. **Build + bundle:**
   - `npm run build`
   - Bundle size increase <= 20KB
   - No errors

4. **E2E manual flow:**
   - Saved searches: Save → load → list → delete works
   - URL sharing: Share button → copy → paste URL → loads
   - Profile builder: Filter rent < $2k → results < 500ms
   - Data export: Click download → CSV/JSON works
   - Methodology: Search "rent burden" → returns definition
   - Accessibility: Tab navigation, screen reader, high-contrast mode

5. **Accessibility audit (AAA):**
   - axe-core: Zero AAA violations
   - Keyboard: Full app navigable without mouse
   - Screen reader: NVDA announces all content
   - High-contrast: 7:1 text contrast
   - Focus: Outline visible on all interactive elements

6. **Performance:**
   - Profile matching: < 500ms for 33k ZIPs
   - Export: < 100ms download
   - Methodology search: < 200ms results

7. **Post-assessment:**
   - Measure UX score again
   - Expected: 95+/100

### Approval Criteria

**Before opening PR:**
- [ ] All 25+ tests passing
- [ ] axe-core: Zero AAA violations
- [ ] E2E flows (saved, sharing, profiles, export, methodology, a11y)
- [ ] Bundle size increase <= 20KB
- [ ] Performance baselines met
- [ ] UX assessment: 95+/100 achieved

**After approval, merge to ccr-a1306203-osmm3o**

---

## PHASE 2B: APPROVED (ships disabled by default)

**Status:** can start. Both former blockers are closed.

**What changed, 2026-10-04:**
1. **Legal review: dropped, not satisfied.** No attorney review is planned. The
   mitigation is that similarity ships off by default behind a feature flag, with
   the reader choosing the weights and no operator-chosen defaults.
2. **ZIP-level metrics audit: answered.** CDC PLACES publishes a ZCTA-level
   release (`qnzd-25i4`, verified live, keyless, with confidence limits). NCES is
   genuinely district-level and is deferred rather than approximated.

**Build-time conditions:** the flag defaults off; weights are reader-set;
protected-class metrics are refused as ranking inputs; no outcome-named templates.
`GOVERNANCE.md` records that no attorney has reviewed the design and that this is
a mitigation rather than a compliance finding.

**See `PR_PHASE_2B_SCOPE.md` for full details — it is authoritative over this
document.**

---

## POST-LAUNCH MONITORING

**After any phase ships:**

1. **Quantitative metrics:**
   - UX score (per assessment methodology)
   - Feature engagement (tour completion, help clicks, exports, etc.)
   - Performance (load time, scroll smoothness)
   - Bundle size (gzip)
   - Accessibility audit (axe-core, manual)

2. **Qualitative feedback:**
   - User testing (small sample, structured interview)
   - Support feedback (bug reports, feature requests)
   - Accessibility feedback (screen reader, keyboard users)

3. **Error monitoring:**
   - Census API errors (track quotas, failures)
   - Photon API errors (track rate limits, offline fallback)
   - localStorage errors (private mode, quota)
   - Browser compatibility (old browsers)

---

## SUMMARY TABLE

| Phase | LoC | Tests | Duration | Blocker | Approval |
|-------|-----|-------|----------|---------|----------|
| **P0** | 1,200 | 25+ | P0 Scope | None | Opus review |
| **P1** | 3,350 | 30+ | P0 Scope | Decision 1 & 2 ✅ | Opus review |
| **P2A** | 1,550 | 25+ | P0+P1 Scope + UX < 95 | None | Opus review |
| **P2B** | 1700 | 8+ | P2A Scope | Phase 0 + 1 merged | Flag off by default |

---

**All scopes fully defined. Ready for agent execution.**

