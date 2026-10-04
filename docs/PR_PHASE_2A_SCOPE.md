# PR PHASE 2A: Context & Personalization (Profiles, Export, Methodology, Accessibility)

**Total LoC:** 1,550  
**Confidence:** 85%  
**Status:** CONDITIONAL - Only if P0 + P1 don't reach 95/100 UX target  
**Blocks:** Phase 2B decision gate

---

## PR TITLE
`feat: Add user-defined profiles, data export, methodology, and AAA accessibility (Phase 2A)`

---

## PR DESCRIPTION

### Summary
Phase 2A is a polish release that adds power-user features and accessibility depth. Only ship if Phase 1 assessment shows UX score < 95. Features include user-defined profile matching (transparent alternative to clustering), CSV/JSON data export, searchable methodology guide, and WCAG 2.2 AAA compliance.

**Impact:** Expected UX score 85 → 95+/100 (if shipped)

### Features Included

| Feature | LoC | File(s) | Description |
|---------|-----|---------|-------------|
| P2.1A: localStorage Saved Searches | 300 | `src/core/savedSearches.ts` (new) | Save comparisons locally |
| P2.1B: URL-Based Comparison Sharing | 150 | `src/core/urlState.ts` (new) | Encode/decode comparison state in URL |
| P2.2A: User-Defined Profiles | 350 | `src/ui/ProfileBuilder.tsx`, `src/core/profileMatcher.ts` (new) | Filter builder for transparent matching |
| P2.3: Data Export (CSV/JSON) | 300 | `src/core/export.ts` (new) | Export comparison with MOE + metadata |
| P2.4: Methodology Depth | 500 | `src/ui/MethodologyPanel.tsx` (new) | Searchable, interactive guide |
| P2.5: AAA Accessibility | 400 | Various (modify) | WCAG 2.2 AAA compliance audit |

**Total: 1,550 LoC**

---

## DETAILED FEATURE SCOPE

### P2.1A: localStorage Saved Searches (300 LoC)

**Files to Create:**

1. `src/core/savedSearches.ts` (300 LoC)
   - Data structure: `interface SavedSearch { id: string, name: string, selectedZctas: string[], presetUsed?: string, timestamp: number }`
   - Function: `saveComparison(name: string, selectedZctas, preset)` → stores in localStorage
   - Function: `loadComparison(id)` → retrieves from localStorage
   - Function: `listSavedSearches()` → returns all saved comparisons
   - Function: `deleteComparison(id)` → removes from localStorage
   - Function: `renameComparison(id, newName)` → updates name
   - Storage key format: `civicscope.saved[id]` (per-search key)
   - Limit: Max 50 searches (~500KB in localStorage)
   - Persistence: Survives browser close/reopen
   - Fallback: If localStorage unavailable (private mode), use in-memory Map

**Files to Modify:**

1. `src/ui/Comparison.tsx` (+50 LoC)
   - Add "Save this comparison" button (top-right of comparison panel)
   - Click → modal: "Name your comparison" → input field
   - Enter name → calls `saveComparison(name, selectedZctas, presetUsed)`
   - Success message: "Comparison saved as '{name}'"
   - List of saved comparisons (collapsible): Click to load, delete button per item

**Success Criteria:**
- [ ] Save button visible in comparison panel
- [ ] Modal captures comparison name (required field)
- [ ] Comparison saves to localStorage with all metadata
- [ ] Saved list shows up to 50 items
- [ ] Click saved item → loads comparison instantly
- [ ] Delete removes from localStorage
- [ ] Max 50 searches enforced (disable save button if at limit)
- [ ] localStorage fallback works (private mode)

---

### P2.1B: URL-Based Comparison Sharing (150 LoC)

**Files to Create:**

1. `src/core/urlState.ts` (150 LoC)
   - Function: `encodeComparisonState(selectedZctas, preset) → string`
     - Serializes to: `/compare?z=78701,78702,78703&preset=renting`
     - Alphabetically sorted ZIPs (deterministic)
     - Gzip-friendly (short param names)
   - Function: `decodeComparisonState(url) → { selectedZctas, preset }`
     - Parses URL query params
     - Validates ZIPs (format check only)
     - Returns state object
   - Integration: On app load, check URL → if `z=` present → auto-load that comparison

**Files to Modify:**

1. `src/ui/Comparison.tsx` (+50 LoC)
   - Add "Share this comparison" button (next to save)
   - Click → copies URL to clipboard
   - URL format: `https://civicscope.example.com/compare?z=78701,78702&preset=renting`
   - Visual feedback: Toast "Link copied to clipboard"
   - Users can share via email/Slack/messaging

2. `src/ui/App.tsx` (+50 LoC)
   - On mount, check `window.location.search` for `z=` or `preset=`
   - If present, decode and auto-load comparison
   - User opens link → sees comparison immediately (no setup needed)

**Success Criteria:**
- [ ] "Share" button generates short URL with comparison state
- [ ] URL contains: selected ZIPs (comma-separated), preset name
- [ ] Link copied to clipboard on click
- [ ] Shared link opens app → auto-loads comparison
- [ ] Mobile: URL works on all devices
- [ ] Privacy: No tracking (URL is stateless; no server logging)
- [ ] Team sharing use case: User builds comparison on desktop, shares link to colleague on mobile

---

### P2.2A: User-Defined Profiles (350 LoC)

**Why this instead of similarity scoring:**
Opus identified that ZIP-level metrics for schools/health don't exist (NCES district-level, CDC tract-level). User-defined profiles don't require per-ZIP data; users specify criteria, system matches. Fair Housing safe by design (fully transparent, no hidden steering).

**Files to Create:**

1. `src/ui/ProfileBuilder.tsx` (200 LoC)
   - React component: Filter builder UI
   - Filters:
     - Rent: < $1,500 / $1,500-2,000 / $2,000-2,500 / > $2,500 [slider or buttons]
     - Rent Burden: < 25% / 25-35% / > 35% [buttons]
     - Home Value: Ranges (budget slider)
     - Schools: A / B+ / B / B- / C+ / C [dropdown]
     - Health Score: Slider [0-100]
     - Population: > 5,000 / > 10,000 / Any [buttons]
   - "Apply" button → calls `matchProfiles(filters)`
   - "Reset" button → clears all filters
   - Show result count: "Matching XX neighborhoods"
   - Keyboard: Tab through filters, arrow keys on sliders, Enter to apply

2. `src/core/profileMatcher.ts` (150 LoC)
   - Function: `matchProfiles(filters) → ResolvedPlace[]`
   - Logic: For each ZIP in dataset, check if all filter criteria match
   - Return matched ZIPs sorted alphabetically (never by "best")
   - Handle absence: If metric absent (sentinel value), exclude from filter match
   - Performance: 33k ZIPs filtered in < 500ms (likely O(n))
   - Result limit: Cap at 1,000 results (show count)

**Files to Modify:**

1. `src/ui/Comparison.tsx` (+50 LoC)
   - Add "Build a profile" section (collapsible, below help system)
   - Import ProfileBuilder component
   - On result: Display matched ZIPs in sortable list
   - User can add any matched ZIP to comparison

**Success Criteria:**
- [ ] Filter builder renders with all criteria
- [ ] Sliders + buttons work (keyboard + mouse + touch)
- [ ] Apply filters → results show in < 500ms
- [ ] Results sorted A-Z (never ranked or "best")
- [ ] 1,000+ results capped at "1,000+ neighborhoods match"
- [ ] Can add matched ZIPs to comparison one-by-one
- [ ] Filters saved in URL (share filtered profile)
- [ ] Fair Housing safe: Fully transparent (user controls everything)

---

### P2.3: Data Export (CSV & JSON) (300 LoC)

**Files to Create:**

1. `src/core/export.ts` (300 LoC)
   - Function: `exportComparison(selectedZctas, format: 'csv' | 'json') → Blob`
   - Columns (CSV): ZCTA, City, State, Metric1, MOE1, Metric2, MOE2, ..., Source, Vintage
   - Metadata row (optional): "Exported: 2026-10-04", "Data vintage: ACS 5-year 2023"
   - Format preservation:
     - Currency: $1,450.00
     - Percent: 28.5%
     - Ratio: 0.285
   - Missing values: Show sentinel (-666666666) or text "N/A" (decide based on user feedback)
   - JSON structure: Array of objects, one per ZCTA, with all metrics as keys

**Files to Modify:**

1. `src/ui/Comparison.tsx` (+50 LoC)
   - Add "Export comparison" button (or dropdown menu)
   - Options: "Download as CSV" / "Download as JSON"
   - Click → calls `exportComparison()` → triggers browser download
   - Filename: `civicscope-comparison-YYYY-MM-DD.csv` or `.json`
   - Toast: "Downloaded comparison-YYYY-MM-DD.csv"

2. `src/core/export.test.ts` (NEW, 4 tests)
   - Test CSV format (headers, data, metrics, MOE)
   - Test JSON structure
   - Test currency/percent formatting
   - Test edge case: Single ZCTA, many metrics, missing values

**Success Criteria:**
- [ ] Export button visible in comparison panel
- [ ] CSV opens cleanly in Excel/Google Sheets
- [ ] JSON opens in code editor, valid JSON structure
- [ ] Data matches comparison view (spot-check 5 metrics)
- [ ] MOE included for each metric
- [ ] Source + vintage metadata included
- [ ] Download < 100ms latency
- [ ] Filename includes date (sortable)
- [ ] Excel: 33 metrics + MOE + metadata fit without truncation

---

### P2.4: Methodology Depth (500 LoC)

**Files to Create:**

1. `src/ui/MethodologyPanel.tsx` (300 LoC)
   - Expandable panel: "Understanding the data"
   - Features:
     - Search box: Filter by metric name or keyword
     - Tabs: All metrics / Housing / Schools / Health / Demographics
     - Per-metric deep dive:
       - Metric name + definition
       - Census table ID (link to Census.gov)
       - Vintage (ACS 2023 5-year, released 2024)
       - Margin of error explanation
       - Data quality (coverage %)
       - Example: "Median Rent (B25064): $1,450 ± $50 (ΔE = 3.4%)"
   - Searchable: "What is rent burden?" → returns B25071 + definition
   - Keyboard: Focus in search, Tab through results, Enter to expand
   - Accessibility: aria-expanded, aria-labelledby

2. `src/data/methodology.ts` (NEW, 200 LoC)
   - Static data structure: `{ metricId, name, definition, tableId, vintage, category }`
   - Example entries (placeholder, expand with all 30 metrics):
     ```
     { 
       metricId: 'medianRent', 
       name: 'Median Gross Rent', 
       definition: '...',
       tableId: 'B25064',
       vintage: 'ACS 5-year 2023',
       category: 'Housing',
       link: 'https://data.census.gov/...'
     }
     ```
   - Source of truth: Maintain in code (linked to app's metric definitions)

**Files to Modify:**

1. `src/ui/Methodology.tsx` (existing, +100 LoC)
   - Expand existing methodology page to include MethodologyPanel
   - Or: Add MethodologyPanel as collapsible section in app footer

**Success Criteria:**
- [ ] Methodology panel renders with search box
- [ ] Search "rent burden" → returns B25071 + definition
- [ ] Click metric → shows deep dive (table ID, vintage, example)
- [ ] Tab through results: Keyboard navigation works
- [ ] All 30 metrics documented (100% coverage)
- [ ] Sources linked to Census.gov
- [ ] 40%+ visitor click-through
- [ ] Mobile-friendly: Fits on 375px viewport

---

### P2.5: AAA Accessibility (400 LoC)

**Current state:** WCAG 2.2 AA (passing)  
**Target:** WCAG 2.2 AAA (exceeds standard)

**Files to Modify (various components):**

1. Color contrast: Minimum 7:1 ratio (AAA standard)
   - Audit all text colors vs. background
   - Headers: Already likely >= 7:1 (dark text on light)
   - Labels: Verify against accessibility checker
   - Interactive elements: Buttons, links, focus indicators

2. Keyboard navigation: Full app keyboard-accessible
   - [ ] No reliance on mouse
   - [ ] Tab order logical (left-to-right, top-to-bottom)
   - [ ] Focus indicator visible (outline >= 3px)
   - [ ] Escape key dismissed modals/popovers
   - [ ] Arrow keys navigate complex widgets (dropdowns, tabs)
   - [ ] Enter/Spacebar activates buttons

3. Screen reader: NVDA + JAWS full functional support
   - [ ] All form fields labeled (aria-label or <label>)
   - [ ] Live regions announce updates (aria-live="polite")
   - [ ] Links have descriptive text (not "click here")
   - [ ] Images have alt text
   - [ ] Heading hierarchy correct (h1 → h2 → h3)
   - [ ] Lists semantic (<ul>/<li>, not divs)
   - [ ] Tables have headers + captions

4. High-contrast mode: 7:1 text contrast
   - [ ] All text readable in high-contrast mode
   - [ ] SVG icons scale proportionally
   - [ ] No information conveyed by color alone (e.g., red error)

5. Focus management:
   - [ ] Focus trap in modals (tab cycles within modal)
   - [ ] Focus restored after modal close
   - [ ] Skip links work (skip to main, skip nav)

6. Testing framework:
   - Use axe-core (already in E2E tests)
   - Manual testing: Keyboard navigation, screen reader, high-contrast
   - External audit: Optional (AccessibilityChecker.com or similar)

**Estimate:** +400 LoC across multiple components (css classes, aria attributes, semantic HTML updates)

**Success Criteria:**
- [ ] Zero AAA violations (axe-core automated checks)
- [ ] Manual keyboard test: Navigate entire app without mouse
- [ ] Manual screen reader test (NVDA): All content accessible
- [ ] High-contrast mode: Text 7:1 contrast ratio
- [ ] Focus indicator: Visible outline on all interactive elements
- [ ] Test report: Document all manual checks

---

## Tests to Add (25+ tests)

**Unit Tests:**
- `src/core/savedSearches.test.ts` (5 tests): Save, load, list, delete, rename
- `src/core/urlState.test.ts` (4 tests): Encode, decode, URL format, invalid input
- `src/core/profileMatcher.test.ts` (6 tests): Match filters, A-Z sort, result count, performance
- `src/core/export.test.ts` (4 tests): CSV format, JSON structure, currency/percent, metadata

**E2E Tests:**
- `e2e/saved-searches.e2e.ts` (3 tests): Save, list, load, delete
- `e2e/url-sharing.e2e.ts` (3 tests): Share button, URL copy, link opens
- `e2e/profile-builder.e2e.ts` (4 tests): Filter application, result count, keyboard navigation
- `e2e/data-export.e2e.ts` (3 tests): CSV download, JSON download, open in Excel
- `e2e/methodology.e2e.ts` (3 tests): Search functionality, deep dives, click-through
- `e2e/accessibility-aaa.e2e.ts` (5 tests): axe-core AAA audit, keyboard navigation, screen reader

---

## Verification Checklist

**Saved Searches:**
- [ ] Save button visible in comparison
- [ ] Modal captures name (required)
- [ ] Saved comparison loads instantly
- [ ] Max 50 searches (disable if at limit)
- [ ] Delete removes from localStorage
- [ ] Private mode: In-memory fallback works

**URL Sharing:**
- [ ] Share button generates URL with selected ZIPs + preset
- [ ] URL copied to clipboard
- [ ] Shared link opens app → auto-loads comparison
- [ ] Mobile: Works on iOS + Android
- [ ] Privacy: No server-side tracking

**User Profiles:**
- [ ] Filter builder renders (rent, schools, health, population)
- [ ] Apply filters → results in < 500ms
- [ ] Results A-Z sorted (never ranked)
- [ ] 1,000+ results capped at "1,000+ neighborhoods"
- [ ] Can add results to comparison one-by-one
- [ ] Fair Housing compliant (fully transparent)

**Data Export:**
- [ ] CSV opens in Excel/Google Sheets
- [ ] JSON valid and parseable
- [ ] Metadata included (date, vintage, source)
- [ ] Currency/percent formatting preserved
- [ ] Download < 100ms
- [ ] Filename includes date

**Methodology:**
- [ ] Search box functional
- [ ] "Rent burden" search returns B25071 + definition
- [ ] All 30 metrics documented
- [ ] Sources linked
- [ ] 40%+ click-through rate
- [ ] Mobile-friendly

**Accessibility (AAA):**
- [ ] 7:1 text contrast (all interactive elements)
- [ ] Keyboard navigation: Full app without mouse
- [ ] Screen reader: NVDA announces all content
- [ ] Focus indicator: Visible outline (>= 3px)
- [ ] High-contrast mode: Readable
- [ ] Zero AAA violations (axe-core)

---

## Opus Review Required

**Scope:** Is P2A complete and sufficient for 95/100 UX?
- All 6 features fully defined?
- 25+ tests adequate coverage?
- URL sharing solves cross-device use case?
- Profiles Fair Housing safe?

**Architecture:**
- Reuses existing components (Comparison, URLParams)?
- No new dependencies?
- localStorage + URL state compatible with existing patterns?

**Completeness:**
- Profile filters comprehensive? (rent, schools, health, population)
- Methodology covers all 30 metrics?
- Export metadata sufficient?
- AAA accessibility requirements clear?

**Risks:**
- LoC count accurate?
- Performance (33k profiles matching < 500ms)?
- localStorage limit (50 searches = ~500KB)?

---

## Review Criteria for Approval

**Must pass:**
1. All 25+ tests passing
2. E2E tests on desktop + mobile
3. Zero accessibility violations (AAA axe-core audit)
4. Performance: Profile matching < 500ms, export < 100ms
5. Privacy: No tracking (URL stateless, localStorage only)
6. Fair Housing: Profile builder fully transparent

**Nice-to-have:**
- URL shortened (TinyURL integration)
- Profile suggestions (e.g., "Popular profiles: Tech workers, Families")
- Methodology video tutorials

---

## Deployment Notes

- **Feature flags:** None (all on by default)
- **Data migration:** None
- **Backwards compatibility:** Fully compatible
- **A/B testing:** Track adoption of each feature (profiles, export, sharing)

---

## Post-Launch Monitoring

- Saved search adoption (goal: 20%+)
- URL share engagement (goal: 10%+)
- Profile builder usage (goal: 15%+)
- Export clicks (goal: 25%+)
- Methodology search engagement (goal: 40%+)
- AAA accessibility audit score (goal: 100%)

