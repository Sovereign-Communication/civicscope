# PR PHASE 0: City/State Search Foundation

> **SUPERSEDED — do not implement from this document.**
> **`PHASE_0_RECONCILIATION.md` is authoritative for Phase 0.**
>
> Several assumptions below were checked against the working tree on 2026-10-04
> and found false. The most consequential: this document makes
> `src/ui/SearchInput.tsx` an existing file (it does not exist — the search form
> is inline in `src/ui/App.tsx`), specifies 16 unit tests in `.test.tsx` files
> (which `vite.config.ts` never collects, so they would have reported green while
> asserting nothing), adds a `zcta`/`city` shape to `ResolvedPlace` (neither field
> exists), and points at a `npm run test:a11y` script that does not exist.
> `IMPLEMENTATION_GUIDE.md` has the same defects.
>
> This document is retained for its scope narrative, not as a build target.

**Total LoC:** 1,200 (superseded — reconciliation says ~650 code + 300 tests)  
**Confidence:** 95%  
**Status:** SUPERSEDED by `PHASE_0_RECONCILIATION.md`  
**Depends on:** Nothing  
**Blocks:** Phase 1 (logical dependency, not technical blocker)

---

## PR TITLE
`feat: Add city/state search interoperability (Phase 0 foundation)`

---

## PR DESCRIPTION

### Summary
Expose existing geocoding infrastructure (TIGERweb + Photon) through a new UX layer that allows users to search by city/state names in addition to ZIP codes. This is the foundational UX improvement that unlocks all downstream features and significantly reduces user friction.

**Current State:** App requires ZIP code input; users must know or find ZIP codes before searching.

**After PR:** Users type "Austin, TX" → autocomplete shows matching cities/ZIPs → click to load → comparison displays city/state alongside ZIP.

### Features Included

| Feature | LoC | File(s) | Description |
|---------|-----|---------|-------------|
| P0.1: Smart Search Input | 100 | `src/ui/SearchInput.tsx` (new) | Placeholder + hint text update |
| P0.2: Autocomplete Dropdown | 300 | `src/ui/SearchAutocomplete.tsx` (new) | Photon-powered suggestions with city/state display |
| P0.3: Reverse City/State Display | 150 | `src/ui/Comparison.tsx`, `src/ui/MetricCard.tsx` (modify) | Show city/state with ZIP in results |
| P0.4: Browse City ZIPs | 400 | `src/ui/CityZipBrowser.tsx` (new) | Collapsible list of all ZIPs in selected city |
| P0.5: Search Result Clarity | 100 | `src/core/useHousingQuery.ts` (modify) | "Did you mean?" modal for multiple results |
| P0.6: Results Table Enhancement | 150 | `src/ui/SweepTable.tsx` (modify) | Display city/state in sweep table column |

**Total: 1,200 LoC**

### Technical Architecture

**No new dependencies required.** Geocoding infrastructure already exists:
- Census TIGERweb API (for ZCTA reverse lookup)
- Photon OSM geocoder (for free-text city search)
- Both already verified in `src/core/geocode.ts`

**Data flow additions:**
```
SearchInput (text)
  → SearchAutocomplete
  → geocode(text) via Photon
  → Filter results (US only, prioritize postcodes)
  → Display suggestions with city/state
  → User clicks suggestion
  → selectPlace(zip, city, state)
  → Comparison displays "ZIP | City, State"
  → Optional: CityZipBrowser shows all ZIPs in city
```

### Files to Create (New)

1. **`src/ui/SearchAutocomplete.tsx`** (300 LoC)
   - React component wrapping Photon API
   - Debounced search (400ms minimum interval, existing pattern)
   - Cache results in localStorage (civicscope.autocomplete.*)
   - Keyboard navigation (Arrow keys, Enter, Escape)
   - Accessibility: ARIA labels, role="listbox", aria-selected
   - Display format: "City, State (ZIP)" for postcodes, "City, State" for city centroids
   - Max 8 suggestions, postcodes prioritized first
   - Touch targets: 44px minimum

2. **`src/ui/CityZipBrowser.tsx`** (400 LoC)
   - React component for browsing ZIPs within a city
   - Collapsible section below comparison header
   - Shows top 10 ZIPs by population (lazy-load on expand)
   - Checkbox for each ZIP (add/remove from comparison)
   - Integration with existing `selectPlace()` logic
   - Mobile-responsive (stacked on small screens)
   - Accessibility: Keyboard navigation, ARIA labels

### Files to Modify (Existing)

1. **`src/ui/SearchInput.tsx`** (existing, modify +50 LoC)
   - Change placeholder: "e.g. 78701" → "e.g. 78701 or Austin, TX"
   - Add hint text below input: "Search by ZIP code, city, or city, state"
   - Import + render `<SearchAutocomplete />` below input

2. **`src/ui/App.tsx`** (existing, modify +30 LoC)
   - Import SearchAutocomplete component
   - Wire up suggestion click to existing `selectPlace()` function
   - No state changes needed (uses existing housing query state)

3. **`src/ui/Comparison.tsx`** (existing, modify +50 LoC)
   - Add city/state display in comparison card header
   - Format: "ZIP | City, State" (already have city from geocode, add state abbr)
   - Optional: County name if available (lower priority)
   - Import + render `<CityZipBrowser />` below header (collapsible)

4. **`src/ui/MetricCard.tsx`** (existing, modify +30 LoC)
   - Update header to show "ZIP | City, State" format
   - Already have city from place object; add state display

5. **`src/ui/SweepTable.tsx`** (existing, modify +50 LoC)
   - Add city/state column (rename "ZCTA" column to "ZIP & Location")
   - Format: "ZIP\nCity, State" (multi-line cell for readability)
   - Apply to both desktop (table) and mobile (card) layouts

6. **`src/core/useHousingQuery.ts`** (existing, modify +100 LoC)
   - Add `ResolvedPlace` type if not present: `{ zcta, city, state, lat, lon, precise }`
   - Update `selectPlace()` signature to accept city + state
   - Add multi-result handling in `loadSweep()` (if search returns multiple cities, show "Did you mean?" modal)
   - Wire up modal to call `selectPlace()` with chosen result

7. **`src/core/geocode.ts`** (existing, verify, no changes expected)
   - Already supports both TIGERweb (ZCTA) and Photon (city search)
   - Verify Photon returns city/state in response
   - Verify filtering to US-only works
   - Verify postcode vs. city centroid distinction is accessible

### Tests to Add/Update (25+ tests)

**Unit Tests:**
- `src/ui/SearchAutocomplete.test.tsx` (8 tests)
  - Renders input + dropdown
  - Fetches suggestions on input change
  - Debounces API calls (verify 400ms minimum)
  - Handles multiple results (cities + postcodes)
  - Keyboard navigation (arrow keys, enter, escape)
  - Filters to US only
  - Caches results in localStorage
  - Prioritizes postcodes in display order

- `src/ui/CityZipBrowser.test.tsx` (6 tests)
  - Renders collapsible section
  - Lazy-loads ZIPs on expand
  - Shows top 10 ZIPs by population
  - Checkbox add/remove works
  - Mobile responsive (stacked on small screens)
  - Keyboard navigation

- `src/core/useHousingQuery.test.ts` (4 tests)
  - `selectPlace()` accepts city + state
  - Multi-result modal displays
  - Modal selection calls selectPlace with correct result
  - Reverse lookup returns city/state

**E2E Tests:**
- `e2e/search-city-state.e2e.ts` (5 tests)
  - User types "Austin" → suggestions appear
  - User clicks "Austin, TX (78701)" → area loads
  - Comparison displays "Austin, TX" alongside ZIP
  - Browse city ZIPs feature works
  - Mobile autocomplete touch targets >= 44px

- `e2e/reverse-lookup.e2e.ts` (2 tests)
  - Every ZIP displays city/state
  - Sweep table shows city/state in column

**Integration Tests:**
- Photon API rate limiting (400ms debounce verified)
- localStorage caching (TTL verification)
- Fallback if Photon unavailable (TIGERweb-only mode)

### Verification Checklist

**Functionality:**
- [ ] Autocomplete shows suggestions within 500ms of input
- [ ] "Austin" shows: Austin TX, Austin MN, Austin WI (if exist)
- [ ] Austin TX has centroid + multiple postcodes (78701, 78702, etc.)
- [ ] Click suggestion → page loads that area in < 500ms
- [ ] Comparison displays "Austin, TX" for all selected areas
- [ ] Browse city ZIPs shows all 10-20 Austin ZIPs
- [ ] Add Austin ZIP from browser → appears in comparison instantly
- [ ] Results table shows city/state for every ZIP

**Accessibility (WCAG 2.2 AA):**
- [ ] Input has visible label ("Search by ZIP code or city name")
- [ ] Autocomplete dropdown has role="listbox"
- [ ] Each suggestion has aria-selected (true/false)
- [ ] Keyboard navigation: Arrow Up/Down cycles suggestions
- [ ] Keyboard: Enter selects focused suggestion
- [ ] Keyboard: Escape closes dropdown
- [ ] Touch targets: Dropdown items >= 44px tall
- [ ] CityZipBrowser checkboxes >= 44px
- [ ] Screen reader announces suggestion count ("8 results")
- [ ] Screen reader announces selected city on load

**Performance:**
- [ ] First autocomplete suggestion appears < 500ms (debounced 400ms + network)
- [ ] Photon API called max once per 400ms (debounce verified)
- [ ] localStorage cache hit reduces latency to < 50ms
- [ ] Sweep table renders city/state column without performance regression
- [ ] Mobile card view renders without horizontal scroll

**Privacy/Security:**
- [ ] Photon searches are not logged (verify CSP allows photon.komoot.de)
- [ ] localStorage cache only stores search results (no PII)
- [ ] No Census key transmitted to geocoding service (verify in http.ts)

**Browser Compatibility:**
- [ ] Works in Chrome, Firefox, Safari, Edge (modern versions)
- [ ] Mobile: iOS Safari (14+), Chrome Android (90+)
- [ ] Graceful degradation if Photon unavailable (show "Try a ZIP code instead")

**Data Integrity:**
- [ ] Reverse lookup returns correct city for ZIP (spot-check 10 ZIPs)
- [ ] State abbreviations correct (TX not Texas, NY not New York)
- [ ] County names (if shown) match official records

### Opus Review Required

**Scope:** Is P0 complete and sufficient to unblock P1?
- Does P0 cover all city/state search UX gaps?
- Are all files and tests identified?
- Is data flow clear and correct?
- Any missing edge cases?

**Architecture:** Are design patterns consistent?
- Uses existing geocode.ts patterns?
- Follows existing accessibility patterns (compare to MetricCard)?
- Reuses existing state management (useHousingQuery)?
- No new dependencies introduced?

**Completeness:** What's missing?
- Tests: Any gap in coverage?
- Edge cases: Handling for < 5 results? > 50 results? Empty results?
- Internationalization: Should we handle non-US cities (maybe for future)?
- Offline: Should autocomplete work offline (fallback to localStorage only)?

---

## Review Criteria for Approval

**Must pass:**
1. All 25+ tests passing
2. E2E tests run without Census key (graceful skip if needed)
3. Zero accessibility violations (axe-core)
4. No bundle size regression (check gzip delta)
5. Performance baseline: autocomplete < 500ms, sweep table render < 200ms
6. Spot-check 10 ZIPs for correct city/state display

**Nice-to-have:**
- Photon result caching (localStorage) implemented
- Keyboard navigation fully tested
- Mobile autocomplete tested on real device

---

## Deployment Notes

- **Bundle size impact:** +5-8KB gzipped (SearchAutocomplete + CityZipBrowser components)
- **API quota impact:** Photon is free/unlimited for OSM community
- **No infrastructure changes needed:** Uses existing geocoding endpoints
- **Backwards compatible:** ZIP-only search still works (autocomplete is enhancement)

---

## Success Metrics (Post-Deployment)

- Autocomplete suggestions clicked in 70%+ of searches
- City/state display shown in 100% of comparison views
- Zero errors from Photon API failures (graceful degradation)
- Accessibility audit score maintained at AA level

