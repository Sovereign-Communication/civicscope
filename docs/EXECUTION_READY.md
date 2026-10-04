# CivicScope 72→95 UX Plan: EXECUTION READY

**Status:** ✅ Complete and approved by Opus 5.5  
**Branch:** `ccr-a1306203-osmm3o`  
**Commits:** Planning docs pushed to repo  
**Next Step:** Agent execution begins with Phase 0

---

## EXECUTIVE SUMMARY

Three-phase UX improvement plan (4,200 LoC total) to boost CivicScope from 72→95/100 UX score. All planning complete, Opus-reviewed, and ready for agent execution.

### What's Ready

✅ **Phase 0:** City/State Search Foundation (950 LoC)  
✅ **Phase 1:** Onboarding & Core Tools (1,650 LoC)  
✅ **Phase 2A:** Profiles, Export, Methodology (1,600 LoC)  
✅ **Phase 2B:** Similarity Scoring (BLOCKED pending legal review + metrics audit)

### Documents in Repo

All planning documents committed to `/docs/`:
- `PR_PHASE_0_SCOPE.md` — Complete Phase 0 spec (650 LoC code, 300 tests)
- `PR_PHASE_1_SCOPE.md` — Complete Phase 1 spec (1,150 LoC code, 500 tests)
- `PR_PHASE_2A_SCOPE.md` — Complete Phase 2A spec (1,150 LoC code, 450 tests)
- `PR_PHASE_2B_SCOPE.md` — Blocked spec with blocker details
- `IMPLEMENTATION_GUIDE.md` — Execution sequence for agents
- `OPUS_REMEDIATION_APPLIED.md` — All Opus corrections & LoC recount

---

## KEY DECISIONS (OPUS-APPROVED)

### Phase 0: City/State Search

**Decision:** Bake ZCTA-to-city file from Census 2020 data  
**Reason:** Only option that covers 33k-row sweep table, no network calls  
**File:** `public/map/zcta-city-mapping.json.gz` (150-200KB)  
**Pattern:** Follow existing `tools/gen-map-data.mjs` approach  
**Outcome:** All ZIPs display city/state immediately

### Phase 1: Onboarding & Tools

**Decision:** Native `<dialog>` tour (not 3 custom components)  
**Reason:** Built-in focus trap, semantics, Escape handling  
**Sample data:** PR-based refresh (not direct push)  
**Reason:** CI permissions stay read-only; maintainer approves refresh  
**Schedule:** January (ACS 5-year data released December)  
**Quick-add:** Reuse existing `deselect()` function  
**Reason:** `selectPlace(null)` not valid; existing function exists  
**Mobile:** Reuse existing windowing logic  
**Reason:** `SweepTable` already handles 33k rows; just add card layout

### Phase 2A: Profiles & Export

**Decision:** Remove school/health filters from profiles  
**Reason:** No ZIP-level data exists (NCES=district, CDC=tract)  
**Filters kept:** Rent, rent burden, home value, population  
**Fair Housing:** Reuse existing `protectedClassProxy` rule from `scoring.ts`  
**Claim:** "Transparent by design" (not "safe by design")  
**Export:** Raw numbers + CSV escaping (prevent formula injection)  
**Avoid:** Census `-666666666` sentinels (repo integrity forbids)  
**AAA a11y:** Scoped to contrast, focus, skip links (not "zero violations")

### Phase 2B: Similarity Scoring

**Status:** BLOCKED (no changes to implementation)  
**Blocker 1:** Legal review must include disparate-impact testing (not just weights)  
**Blocker 2:** ZIP-level metrics audit for schools/health data availability  
**Timeline:** 2-4 weeks per blocker (owners: TBD)  
**Fallback:** Phase 2A profiles sufficient if similarity never ships

---

## PHASES BROKEN DOWN

### PHASE 0: 950 LoC (650 code + 300 tests)

**Purpose:** Foundation. Enable city/state search before onboarding.

**Components:**
- ZCTA-to-city mapping loader
- Combobox autocomplete (Photon fallback)
- City ZIP browser
- Multi-result disambiguation
- City/state display updates (Comparison, MetricCard, SweepTable)

**Test coverage:** 25+ (Vitest for logic, Playwright for UI)

**Approval gate:** Autocomplete < 500ms, city/state displayed correctly

### PHASE 1: 1,650 LoC (1,150 code + 500 tests)

**Purpose:** Onboarding & tools. First-time user journey + sample data.

**Components:**
- Single-component tour (native `<dialog>`)
- Sample data (55 ZIPs, sync import, bundled)
- Annual refresh script (.mjs, PR-based)
- Quick-add comparison (reuse `deselect()`)
- Help system (disclosure tooltips, 44px buttons)
- Mobile card view (reuse windowing, add focus retention)

**Test coverage:** 30+ (Vitest for hooks, Playwright for components)

**Approval gate:** Tour works, sample data loads, mobile cards smooth, 40% Census key adoption

### PHASE 2A: 1,600 LoC (1,150 code + 450 tests)

**Purpose:** Polish to 95/100 (conditional, only if P0+P1 < 95).

**Components:**
- Saved searches (localStorage)
- URL-based comparison sharing
- User-defined profiles (4 filters: rent, burden, value, population)
- Data export (CSV/JSON, raw numbers)
- Methodology guide (30 metrics)
- Scoped AAA accessibility (contrast, focus, skip links)

**Test coverage:** 25+ (Vitest for pure logic, Playwright for UI)

**Approval gate:** UX score >= 95/100, all features work, AAA audit passes

### PHASE 2B: BLOCKED

Cannot ship until:
1. Legal review of similarity weights (includes disparate-impact testing)
2. ZIP-level metrics audit (schools/health data availability)

---

## EXECUTION SEQUENCE

| Step | Phase | LoC | Action | Depends On |
|------|-------|-----|--------|-----------|
| 1 | P0 | 950 | Implement + test (create ZCTA file, autocomplete, etc.) | Nothing |
| 2 | P0 | — | Merge to ccr-a1306203-osmm3o | P0 approval |
| 3 | P1 | 1,650 | Implement + test (tour, sample, quick-add, help, mobile) | P0 merged |
| 4 | P1 | — | Merge to ccr-a1306203-osmm3o | P1 approval |
| 5 | Assessment | — | Measure UX score (P0+P1 alone) | P1 merged |
| 6A | P2A | 1,600 | IF UX < 95: Implement + test | Assessment < 95 |
| 6B | Complete | — | IF UX >= 95: Done (declare launch) | Assessment >= 95 |
| 7 | P2A | — | Merge to ccr-a1306203-osmm3o | P2A approval (if 6A) |
| 8 | Blockers | — | Legal review + metrics audit (owners: TBD) | Any time |
| 9 | P2B | 250 | Implement + test (if blockers pass) | Legal + metrics approved |

---

## FAIR HOUSING COMPLIANCE

### Phase 0-1
- No clustering/profiling yet
- No protected-class risks
- All uses of metrics transparent

### Phase 2A
- **Profiles:** Rent, burden, value, population only (no school/health)
- **School/health removed:** No ZIP-level data; too high steering risk
- **Income filter:** Kept with existing `FairHousingNotice` disclosure
- **Logic:** Reuses existing `protectedClassProxy` enforcement from `scoring.ts`

### Phase 2B (Blocked)
- **Legal blocker:** Must demonstrate results don't steer by protected class
- **Similarity weights:** Require disparate-impact testing, not just opinion
- **Proxy data:** Same legal review required if using district/tract averages

---

## TESTING STRATEGY

### Vitest (Node environment)
- Pure logic functions: Debounce, selection, matching, export formatting, URL state
- No component rendering
- Fast, deterministic, no network calls

### Playwright (E2E)
- Rendered components: Autocomplete dropdown, tour, help tooltips, profile UI
- Mocked Photon/Census responses (no flaky network)
- Real keyboard navigation, screen reader testing, accessibility audits
- All tests in `src/e2e/` directory

### Coverage
- Phase 0: 25+ tests (16 Vitest, 9 Playwright)
- Phase 1: 30+ tests (20 Vitest, 10 Playwright)
- Phase 2A: 25+ tests (15 Vitest, 10 Playwright)

---

## PERFORMANCE TARGETS

| Metric | Target | How Verified |
|--------|--------|--------------|
| Autocomplete suggestions | < 500ms first result | Playwright timing |
| Sample data load | < 500ms (bundled) | Network tab (no request) |
| Mobile card sort 33k items | < 500ms | Perf profiler |
| Mobile scroll 33k cards | >= 60fps | DevTools timeline |
| Methodology search | < 200ms results | Playwright timing |
| Data export | < 100ms download | Network tab |
| Help tooltip display | < 100ms | Playwright timing |

---

## BUNDLE SIZE IMPACT

| Phase | Addition | Total |
|-------|----------|-------|
| Current | — | ~500KB gzipped |
| After P0 | +8KB | ~508KB |
| After P1 | +12KB | ~520KB |
| After P2A | +15KB | ~535KB |
| **Total** | **+35KB** | **+7% increase** |

All within acceptable limits (target: <= 10% increase).

---

## ACCESSIBILITY COMPLIANCE

### Phase 0-1
- WCAG 2.2 AA (current standard)
- Combobox pattern (autocomplete)
- Native `<dialog>` semantics (tour)
- Disclosure tooltips (help)
- 44px touch targets
- Keyboard navigation (Arrow, Tab, Enter, Escape)
- Screen reader tested (NVDA, JAWS)

### Phase 2A
- AAA accessibility improvements (subset, not full AAA)
- Contrast: 7:1 ratio (all text)
- Focus outlines: Visible, >= 3px
- Skip links: "Skip to main", "Skip navigation"
- Motion: `prefers-reduced-motion` respected

### Testing
- Automated: axe-core (AA level)
- Manual: Keyboard-only, screen reader, high-contrast mode
- Report: `src/e2e/a11y.e2e.ts` (existing pattern)

---

## BLOCKING ITEMS (Phase 2B only)

### Legal Review (Fair Housing)
- **Status:** Not started
- **Owner:** TBD (compliance/legal team)
- **Timeline:** 2-4 weeks
- **Requirement:** Disparate-impact testing of similarity results
- **Approval:** Written opinion (weights don't steer by protected class)

### ZIP-Level Metrics Audit
- **Status:** Not started
- **Owner:** TBD (data engineering)
- **Timeline:** 2-4 weeks
- **Requirement:** Verify NCES/CDC can provide per-ZIP school/health data
- **Options:**
  - (a) New data source with ZIP-level granularity
  - (b) District/tract averages as proxy (requires legal sign-off)
  - (c) Drop metrics from similarity (reduce value)

**Both blockers must resolve before Phase 2B implementation begins.**

---

## POST-LAUNCH MONITORING

### Phase 0
- Autocomplete usage rate (goal: 70%+ of searches)
- Autocomplete response time (monitor >= 500ms outliers)
- City/state display accuracy (spot-check 10 ZIPs)

### Phase 1
- Tour completion rate (goal: > 70%)
- Census key adoption (goal: 40%+)
- Help tooltip engagement (goal: 30%+)
- Sample data exploration (goal: 50%+ of new visitors)
- Mobile usage (goal: track card view vs. table)

### Phase 2A
- Saved searches adoption (goal: 20%+)
- URL share engagement (goal: 10%+)
- Profile builder usage (goal: 15%+)
- Data export clicks (goal: 25%+)
- Methodology search engagement (goal: 40%+)

### Overall
- UX score assessment (P0+P1: 85/100 expected, P0+P1+P2A: 95+/100 if shipped)
- Performance baselines (maintain 60fps, < 500ms loads)
- Accessibility audit (AA level maintained, AAA items tracked)
- Error rates (Census API, Photon, localStorage)

---

## READY FOR AGENT EXECUTION

All requirements met:

✅ **Scope Complete:** All 4 phases fully scoped with file lists, LoC estimates, test counts  
✅ **LoC Counted:** 4,200 total (2,950 code + 1,250 tests)  
✅ **Dependencies Mapped:** Phase 0 → 1 → 2A, no circular dependencies  
✅ **Assumptions Verified:** Against existing repo code (types, functions, CSP, CI)  
✅ **Accessibility Planned:** Patterns aligned with repo practices (dialog, disclosure, combobox)  
✅ **Fair Housing:** School/health filters removed, existing rules reused  
✅ **Testing Strategy:** Vitest for logic, Playwright for components  
✅ **Opus Approved:** All corrections applied, ready for execution  
✅ **Committed to Repo:** Planning docs in `/docs/`, branch ccr-a1306203-osmm3o

---

## NEXT ACTIONS FOR AGENT

1. **Phase 0 Execution:** Start with `PR_PHASE_0_SCOPE.md` (follow IMPLEMENTATION_GUIDE.md step-by-step)
2. **Create ZCTA-to-city file:** Using Census 2020 relationship files (highest priority blocker)
3. **Implement autocomplete:** Following Opus-approved component breakdown
4. **Test thoroughly:** Vitest + Playwright per scope
5. **Open PR:** After all tests passing, open PR with full scope details

**Phase 0 expected to complete:** After ZCTA file + 950 LoC implementation + testing

---

**All planning complete. Agent execution begins on Phase 0.**

