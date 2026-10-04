# PR PHASE 1: Onboarding & Core Tools

**Total LoC:** 3,350 (includes +250 LoC from Opus amendments)  
**Confidence:** 88%  
**Status:** APPROVED - Depends on Phase 0 complete  
**Blocks:** Phase 2A assessment gate

---

## PR TITLE
`feat: Add onboarding, sample data, and core comparison tools (Phase 1)`

---

## PR DESCRIPTION

### Summary
Phase 1 implements five core features that transform the app from technical tool to everyday user tool. New visitors get guided onboarding, sample data enables exploration without Census key, help system explains confusing concepts, quick-add makes comparison building frictionless, and mobile redesign removes scroll friction.

**Impact:** Expected UX score 78 → 85/100

### Features Included

| Feature | LoC | File(s) | Description | Blocker |
|---------|-----|---------|-------------|---------|
| P1.1: First-Visit Onboarding | 800 | `src/ui/GuidedTour.tsx`, `src/ui/TourStep.tsx`, `src/ui/Tooltip.tsx` (new) | 3-step guided intro | Decision 1 (sample data) |
| P1.2: Sample Data + Build Script | 700 | `src/data/sampleZips.json` (generated), `scripts/generate-sample-data.ts` (new) | 50 representative ZIPs + annual refresh | Decision 1 (sample data) |
| P1.3: Quick-Add Comparison | 600 | `src/ui/SweepTable.tsx` (modify) | Checkbox → instant add to comparison | None |
| P1.4: Guided Comparison Help | 450 | `src/ui/Comparison.tsx`, `src/ui/MetricCard.tsx` (modify) | Collapsible help + 44px touch buttons | Decision 2 (help UI) |
| P1.5: Mobile Table Redesign | 700 | `src/ui/SweepTable.tsx` (modify) | Card view for mobile, windowed rendering | None |

**Total: 3,350 LoC**

---

## DETAILED FEATURE SCOPE

### P1.1: First-Visit Onboarding (800 LoC)

**Files to Create:**
1. `src/ui/GuidedTour.tsx` (250 LoC)
   - Parent component managing tour state
   - Detects first visit via localStorage flag (civicscope.toured = true)
   - Renders overlay + step container
   - Manages step navigation (next, back, skip, complete)
   - Accessibility: Focus trap, dismissible with Escape

2. `src/ui/TourStep.tsx` (200 LoC)
   - Individual step component (step 1, 2, 3)
   - Animated fade-in/out
   - Highlight target element (search input, comparison card, etc.)
   - Display text + arrow pointer
   - Next/Back/Skip buttons

3. `src/ui/Tooltip.tsx` (100 LoC)
   - Reusable tooltip component (used by tour + help system)
   - Positioning logic (top/bottom/left/right, avoid viewport edges)
   - Content: text + optional close button
   - Accessibility: role="tooltip", aria-describedby

4. Modify `src/ui/App.tsx` (+150 LoC)
   - Import GuidedTour
   - Render conditionally (if first visit)
   - Pass callback to set toured=true on completion
   - Wire up tour navigation

**Tour Flow:**
```
Step 1: Welcome overlay
  - "Every ZIP code's housing + schools, audited by you"
  - Highlight: Search input
  - Action: Next

Step 2: Comparison intro
  - "Compare neighborhoods side-by-side"
  - Highlight: Comparison panel
  - Action: Next or Show Example

Step 3: Census key intro
  - "Search every ZIP in the US with your Census API key"
  - Highlight: Census key input
  - Action: Got it! / Skip

Post-tour: localStorage.setItem('civicscope.toured', 'true')
```

**Success Criteria:**
- [ ] Tour renders on first visit only
- [ ] Each step animated (fade-in 300ms)
- [ ] Text clear and actionable
- [ ] Skip button dismisses tour immediately
- [ ] Completion < 60 seconds
- [ ] 40%+ of users proceed to Census key request
- [ ] < 5% abandon during flow
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader announces step (e.g., "Step 1 of 3")

---

### P1.2: Sample Data Pre-baking (700 LoC)

**OPUS AMENDMENT:** Replace quarterly manual updates with annual CI/CD script.

**Files to Create:**

1. `src/data/sampleZips.json` (GENERATED, not hand-maintained)
   - 50 representative ZIPs: 10 major metros + 10 affordable + 10 expensive + 20 mid-size
   - Format: `[{ zcta: "78701", city: "Austin", state: "TX", metrics: { rent: 1450, rentBurden: 28, income: 52000, ... } }, ...]`
   - Data sourced from Census ACS 5-year latest release
   - Metro selection rationale (documented in script comments):
     - NYC, LA, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, San Jose (10 major metros)
     - Austin TX, Denver CO, Portland OR, Seattle WA, Nashville TN, Atlanta GA, Charlotte NC, Raleigh NC, Salt Lake City UT, Boulder CO (10 mid-size)
     - San Francisco, Boston, Washington DC, Silicon Valley (4 expensive suburbs)
     - Rural Arkansas, Mississippi, Kentucky, Alabama ZIP codes (10 affordable)
   - Updated annually (ACS releases mid-year)

2. `scripts/generate-sample-data.ts` (200 LoC)
   - Node script (runs in GitHub Actions)
   - Process:
     ```
     1. Fetch ACS 5-year B25064 (rent), B25077 (home value), B25071 (rent burden), 
        B19013 (income), B25001 (households) for each of 50 ZIPs
     2. Validate: all metrics >= 0 (handle -666666666 sentinels as absent)
     3. Serialize: { zcta, city, state, metrics: { rent, rentBurden, homeValue, income, households } }
     4. Write: src/data/sampleZips.json
     5. Commit: "chore: Update sample data (ACS 2024 release)"
     ```
   - No manual intervention needed

3. GitHub Actions workflow file (NEW, ~50 LoC)
   - File: `.github/workflows/sample-data-refresh.yml`
   - Trigger: Scheduled mid-September (after typical ACS release)
   - Or: Manual trigger via `workflow_dispatch`
   - Steps:
     ```
     1. Checkout repo
     2. Run: npm install
     3. Run: node scripts/generate-sample-data.ts --census-key=$CENSUS_KEY
     4. If changes: git add src/data/sampleZips.json
     5. If changes: git commit -m "chore: Update sample data (ACS ...)"
     6. If changes: git push
     7. Else: Log "No changes" and exit
     ```
   - Requires: CENSUS_KEY secret (existing)

**Files to Modify:**

1. `src/ui/App.tsx` (+100 LoC)
   - Import sampleZips data
   - On app load, if user has no Census key:
     - Set comparison to first 3 sample ZIPs
     - Display: "Explore sample neighborhoods"
     - Add banner: "Ready to search all 33k? Add your Census API key"
   - Sample data renders in comparison view exactly like normal areas
   - User can remove samples and add their own (after getting Census key)

2. `src/core/useHousingQuery.ts` (+100 LoC)
   - Add `loadSampleData()` function
   - Returns Promise<HousingData[]> for 50 sample ZIPs
   - Loaded from sampleZips.json (no network request)
   - Synchronously available (bundled data)

**Success Criteria:**
- [ ] Sample data loads in < 500ms (bundled, no network)
- [ ] 50 ZIPs display in comparison (visual confirmation)
- [ ] Bundle size increase <= 12KB gzipped
- [ ] Data freshness: Reflects latest ACS 5-year release
- [ ] Annually refreshed: Script runs without manual intervention
- [ ] User sees sample data on first visit (no Census key)
- [ ] User can get Census key to unlock all 33k ZIPs
- [ ] User can add Census key mid-session (sample data replaced with user search)

---

### P1.3: Quick-Add Comparison (600 LoC)

**Files to Modify:**

1. `src/ui/SweepTable.tsx` (+300 LoC)
   - Add checkbox column (first column, before ZCTA)
   - Checkbox behavior:
     - Click → calls `selectPlace(zcta)` (existing function)
     - Instant visual feedback (checked, item added to comparison)
     - Max 6 areas in comparison (disable checkboxes after 6th)
   - Visual indicator: "Comparing [3/6]" badge floating below table
   - Keyboard support:
     - Focus row: Tab to checkbox
     - Add area: `[` key (bracket, vim-style)
     - Remove area: `]` key (bracket, vim-style)
   - Mobile: Checkbox touch target >= 48px
   - Accessibility:
     - Checkbox has aria-label (e.g., "Add Austin, TX (78701) to comparison")
     - aria-checked="true/false" updated on toggle
     - Announce: "Added Austin, TX to comparison" (via aria-live on badge)

2. `src/ui/App.tsx` (+50 LoC)
   - Render floating badge showing "Comparing [N/6]"
   - Position: Fixed bottom-right (mobile), or floating above comparison
   - Badge shows: Clear all button (if N > 0)
   - On clear: `selectPlace(null)` for all areas

**Success Criteria:**
- [ ] Checkbox click → area adds in < 300ms
- [ ] Max 6 areas selected (visual feedback when limit reached)
- [ ] Floating badge updates in real-time
- [ ] Keyboard shortcuts (`[` / `]`) work
- [ ] Mobile touch target >= 48px
- [ ] Screen reader announces additions
- [ ] Visual feedback clear (checked state, highlight row)

---

### P1.4: Guided Comparison Help (450 LoC)

**OPUS AMENDMENT:** Enforce 44px touch targets, keyboard focus, ARIA labels.

**Files to Create:**

1. `src/ui/ComparisonHelp.tsx` (250 LoC)
   - Collapsible section: "Understanding these figures"
   - Auto-expand on first-time visit (detect via localStorage: civicscope.helpShown = true)
   - Content (3 subsections):
     ```
     "Margin of error: ±$200 means 90% confidence interval"
       Explanation: This is a statistical measure, not bad data.
       Example: Rent estimate $1,450 ± $200 = 90% confidence between $1,250-$1,650.

     "Derived metrics: Rent-to-income ratio"
       Explanation: We compute this from Census rent + income data.
       Not a Census figure itself; our calculation.

     "Absence reasons: Why is some data missing?"
       Explanation: ⚠ means Census didn't publish (privacy, too small, suppressed).
       Not bad data; data protection.
     ```
   - Collapsible after first interaction (store expanded=false in localStorage)
   - Power users can hide permanently

2. `src/ui/HelpIcon.tsx` (100 LoC)
   - "?" icon wrapped in 44px button (CRITICAL - Opus requirement)
   - Placement: On margin-of-error badge, "computed" badge, absence warning badge
   - Behavior: Click/Tap → tooltip appears (via Tooltip component)
   - Tooltip content: 1-line definition
   - Keyboard: Tab to focus, Enter to show, Escape to hide
   - Mobile: 44px touch target (button wraps icon)
   - Styling:
     - Default: Gray icon (inactive)
     - Hover: Darker color
     - Focus: Visible outline (2px solid, 1px offset)
   - ARIA: aria-label="Explanation: Margin of error", aria-describedby="tooltip-content"

3. Modify `src/ui/MetricCard.tsx` (+100 LoC)
   - Import HelpIcon
   - Wrap existing badges (margin of error, computed, absence) with HelpIcon
   - On badge render: Insert HelpIcon as trailing element
   - Integration: HelpIcon uses existing Tooltip component

**Files to Modify:**

1. `src/ui/Comparison.tsx` (+50 LoC)
   - Render ComparisonHelp at top of comparison section
   - Pass callback to update expanded state

**Help Icon Content:**

| Badge | Tooltip Text |
|-------|--------------|
| ±$200 | "Margin of error: 90% confidence this value is within this range" |
| Computed | "We calculated this from Census rent + income data" |
| ⚠ Missing | "Census didn't publish; may be privacy-protected or data too small" |

**Success Criteria:**
- [ ] Collapsible section renders above first comparison
- [ ] Auto-expands on first visit
- [ ] Can collapse (power users hide it)
- [ ] 44px button wraps each "?" icon (WCAG requirement)
- [ ] Tooltip shows on click/hover
- [ ] Keyboard: Tab navigates icons, Enter opens tooltip
- [ ] Mobile: Touch target >= 44px
- [ ] Screen reader: aria-label announces icon purpose
- [ ] Visual focus indicator visible (outline)
- [ ] 30%+ of users interact with at least one help tooltip

---

### P1.5: Mobile Table Redesign (700 LoC)

**Files to Modify:**

1. `src/ui/SweepTable.tsx` (+400 LoC)
   - Add breakpoint check: `useMediaQuery('(max-width: 640px)')`
   - Render different layout based on breakpoint:
   
   **Desktop (>= 640px):** Current table format (no change)
   
   **Mobile (< 640px):** Card view
   ```
   Each ZCTA as card:
   ┌─────────────────────────┐
   │ 78701 | Austin, TX      │  (header row)
   │ Median Rent: $1,450 ± $50 │  (metric 1)
   │ Rent Burden: 28% (computed) │ (metric 2)
   │ ...                     │
   │ [✓] [Remove] [→ More]   │  (action buttons)
   └─────────────────────────┘
   ```
   - Card layout: Single column, stacked metrics
   - Sortable: Tap column header (Rent, Burden, Income, Households) to sort all cards
   - Keyboard: Tab through cards, arrow keys to navigate
   - Checkbox: Large 48px touch target, checkbox on left

2. Performance optimization: Windowed rendering
   - Use existing `useVirtualList` or similar (verify in codebase)
   - 33k ZIPs must render without lag
   - Visible viewport: ~8-10 cards (mobile height)
   - Render buffer: +5 above/below viewport
   - Success: Scroll 33k cards smoothly < 60fps

3. `src/ui/App.tsx` (+50 LoC)
   - Detect mobile viewport
   - Pass `isMobile` prop to SweepTable
   - Adjust comparison panel layout (side-by-side on desktop, stacked on mobile)

**Success Criteria:**
- [ ] 375px viewport: All content readable without zoom
- [ ] No horizontal scroll at 375px
- [ ] Sort 33k cards: < 500ms
- [ ] Touch targets: All >= 48px
- [ ] Thumb-reachable buttons (avoid top of screen on mobile)
- [ ] Card view shows 4-5 metrics (essential ones; collapse "More" for optional)
- [ ] Keyboard navigation: Tab through cards, arrow keys move focus
- [ ] No performance regression (60fps scrolling)
- [ ] Tested on: iPhone 12 (375px), Pixel 4a (393px), iPad Mini (768px)

---

## Tests to Add (30+ tests)

**Unit Tests:**
- `src/ui/GuidedTour.test.tsx` (5 tests): Renders, navigation, localStorage flag
- `src/ui/TourStep.test.tsx` (3 tests): Step rendering, animation, buttons
- `src/ui/ComparisonHelp.test.tsx` (4 tests): Expand/collapse, localStorage, content
- `src/ui/HelpIcon.test.tsx` (4 tests): Render, click, keyboard, focus styles
- `src/core/useHousingQuery.test.ts` (+2 tests): loadSampleData() returns correct data

**E2E Tests:**
- `e2e/onboarding.e2e.ts` (5 tests): Tour renders, navigation, completion
- `e2e/sample-data.e2e.ts` (3 tests): Sample data loads, user explores, Census key replaces
- `e2e/quick-add.e2e.ts` (4 tests): Checkbox click, keyboard shortcut, max 6 areas, floating badge
- `e2e/help-system.e2e.ts` (5 tests): Help section expand/collapse, icon tooltips, keyboard, focus
- `e2e/mobile-layout.e2e.ts` (4 tests): Card view, touch targets, sortable, scroll performance

**Integration Tests:**
- Sample data + Census key integration (user without key sees samples, gets key, search replaces)
- Tour + sample data (first-time user flow end-to-end)
- Help icon + MetricCard interaction (icon appears alongside existing badges)
- Mobile breakpoint transitions (smooth layout swap at 640px)

---

## Verification Checklist

**Onboarding:**
- [ ] Tour renders only on first visit (check localStorage)
- [ ] Tour dismissible at any point (Skip button)
- [ ] Each step has clear CTA (Next, Got it, etc.)
- [ ] 40%+ of users proceed to Census key after tour
- [ ] Tour takes < 60 seconds to complete

**Sample Data:**
- [ ] 50 ZIPs load in < 500ms (bundled)
- [ ] All 50 ZIPs render in comparison view
- [ ] Data visually indistinguishable from normal search
- [ ] Bundle size increase <= 12KB gzipped
- [ ] User can remove samples and search normally
- [ ] User sees "Get Census key" button prominently

**Quick-Add:**
- [ ] Checkbox click → area adds in < 300ms
- [ ] Floating badge shows "Comparing [N/6]"
- [ ] Max 6 areas enforced (checkboxes disabled after 6th)
- [ ] Keyboard shortcuts (`[` / `]`) work as documented
- [ ] Touch target >= 48px (mobile)
- [ ] Visual feedback: Checked state, badge update

**Help System:**
- [ ] Collapsible section renders at top of comparison
- [ ] Auto-expands first visit, can collapse on repeat
- [ ] "?" icons appear next to badges (margin, computed, absence)
- [ ] 44px button wraps each icon (measure in DevTools)
- [ ] Icon tooltip shows 1-line definition on click
- [ ] Keyboard: Tab to icon, Enter opens tooltip, Escape closes
- [ ] Mobile: Touch target >= 44px (button size)
- [ ] Focus outline visible (2px solid, contrasts)
- [ ] 30%+ user engagement with help tooltips

**Mobile Redesign:**
- [ ] Card view renders at < 640px viewport width
- [ ] All metrics readable at 375px without zoom
- [ ] No horizontal scroll at 375px
- [ ] Touch targets >= 48px (all interactive elements)
- [ ] Sort works: Click header → resort all cards < 500ms
- [ ] Scroll 33k cards smoothly (60fps, no lag)
- [ ] Mobile tested on real device (iOS + Android)

**Accessibility (WCAG 2.2 AA):**
- [ ] Tour: Focus trap, Escape dismissible, screen reader announces step
- [ ] Help icons: aria-label, aria-describedby, focus outline
- [ ] Quick-add: aria-live announces additions
- [ ] Mobile: Touch targets >= 44px, readable text
- [ ] Zero new accessibility violations (axe-core)

**Performance:**
- [ ] Tour + sample data doesn't block initial render
- [ ] Lazy-load tour components (only on first visit)
- [ ] Sample data bundled (no network request)
- [ ] Help icons lightweight (SVG + CSS, no bloat)
- [ ] Mobile card rendering: 33k items in <1s initial, smooth scroll

---

## Opus Review Required

**Scope:** Is P1 complete and sufficient for 78→85 UX improvement?
- All 5 features fully defined?
- 30+ tests cover functionality + accessibility + edge cases?
- Mobile layout covers all viewport sizes?
- Sample data strategy (annual script) sufficient?

**Architecture:** Are patterns consistent?
- Reuses existing Tooltip, useHousingQuery, selectPlace logic?
- No new dependencies introduced?
- Accessibility patterns consistent with Phase 0?

**Completeness:**
- Tour copy: Are the 3 steps clear for new users?
- Sample data: Are 50 ZIPs representative? Any gaps?
- Help content: Explain margin of error well enough?
- Mobile: Does card view work on all screen sizes?

**Risks:**
- Bundle size: Verify +250 LoC doesn't exceed limits
- Performance: Mobile with 33k cards + virtualization adequate?
- Accessibility: 44px buttons work across browsers?

---

## Review Criteria for Approval

**Must pass:**
1. All 30+ tests passing
2. E2E tests run on desktop + mobile viewports
3. Zero accessibility violations (axe-core)
4. Bundle size increase <= 15KB gzipped (including amendments)
5. Performance baselines:
   - Tour renders in < 100ms
   - Sample data loads in < 500ms
   - Mobile card sort in < 500ms
   - 33k card scroll >= 60fps
6. 40%+ Census key conversion rate (A/B testable post-launch)

**Nice-to-have:**
- Tour animations smooth (300ms fade)
- Help tooltips position-aware (avoid viewport edges)
- Mobile tested on physical device
- Keyboard navigation fully mapped (Tab, Arrow, Enter, Escape)

---

## Deployment Notes

- **Feature flags:** None needed (all features on by default)
- **Backwards compatibility:** Fully compatible (enhancements only)
- **Data migration:** None (sample data generated fresh)
- **Database changes:** None
- **API changes:** None (Census API calls same as before)

---

## Post-Launch Monitoring

- Census key adoption rate (goal: 40%+)
- Help tooltip engagement (goal: 30%+)
- Mobile card view usage (goal: >25% of traffic)
- Tour completion rate (goal: >70%)
- Sample data engagement (goal: 50%+ of new visitors explore)

