# CivicScope UX Improvement Plan: 72→95+/100

**Status:** Planning phase, 4 decisions pending from Opus 5.5  
**Date:** October 4, 2026  
**Target Score:** 95/100 UX  
**Estimated Effort:** 7,400 LoC, 8-10 weeks  

---

## Executive Summary

CivicScope is technically excellent (97/100 technical score) but UX/onboarding needs work (72/100). This plan delivers:
- **Phase 0:** City/State search interoperability (foundation)
- **Phase 1:** Onboarding & core tools (weeks 1-6)
- **Phase 2:** Context & personalization (polish to 95)

**95% of features are locked at 80%+ confidence. Only 4 decisions pending.**

---

## Phase 0: City/State Search (2,200 LoC | 95% Confident)

### Why This is Phase 0
Users think "Austin, Texas" not "78701". Current search is ZIP-only. This foundational change makes everything else more discoverable.

### Features (All Ready to Build)

| Feature | LoC | Purpose | Confidence |
|---------|-----|---------|-----------|
| City/State geocoding | 600 | "Austin, TX" → ZCTA resolution | 95% |
| Auto-suggest dropdown | 400 | Real-time city suggestions | 94% |
| Reverse lookup | 300 | Show city/state with ZIP | 93% |
| Browse city ZIPs | 400 | Select multiple neighborhoods | 92% |
| Search clarity | 100 | "Did you mean Austin, TX or MN?" | 90% |
| Table enhancement | 150 | Display city in results | 90% |
| **Total** | **1,950** | **Foundation complete** | **95%** |

### Implementation Details
- Census TIGERweb API (already verified in geocode.ts)
- Photon fallback for free-text queries
- localStorage caching (365-day TTL)
- Mobile-friendly 48px+ touch targets
- Keyboard: arrow keys, enter, escape

### Success Criteria
- Type "Austin" → dropdown shows "Austin, TX (78701)" + other Austin options
- Click selection → area loads in &lt;500ms
- All results display city/state prominently
- Zero additional Census requests on repeat search

---

## Phase 1: Onboarding & Tools (3,100 LoC | 88% Avg Confidence)

### P1.1: First-Visit Onboarding (800 LoC | 88% Confident)
**Purpose:** 3-step guided intro showing what the tool does  
**User Benefit:** Immediate clarity; no "how do I start?" paralysis

**Flow:**
1. Intro: "Every ZIP code's housing + schools, audited by you"
2. Comparison: "Compare neighborhoods side-by-side"
3. Power: "Search every ZIP in the US (requires Census key)"

**Success Criteria:**
- New visitor completes in &lt;60 seconds
- 40%+ convert to Census key request
- &lt;5% abandon during flow
- Dismissible (one click)

---

### P1.2: Optional Census Key (500 LoC | 87% Confident)
**Purpose:** Use app without key; key unlocks country-wide sweep only

**Trade-off:**  
⚠️ **DECISION 1:** Pre-bake 50 representative ZIPs or let empty search show nothing?
- Pre-bake (+10KB bundle): Instant "wow" UX, sample data in &lt;500ms
- No samples: Simpler, but 60% drop-off before Census key adoption

**Recommendation:** Pre-bake 50 ZIPs (10 metros + 10 affordable + 10 expensive + 20 mid-size)

**Success Criteria:**
- Sample data loads instantly (no network)
- &lt;2KB bundled size (gzipped)
- User can compare 2-3 samples without key

---

### P1.3: Comparison Quick-Add (600 LoC | 90% Confident)
**Purpose:** Add/remove areas to comparison faster

**Features:**
- Checkbox on table rows → adds to comparison
- Keyboard: `[` / `]` to add/remove
- Floating indicator: "Comparing [N/6]"
- Touch-friendly on mobile

**Success Criteria:**
- Click checkbox → appears in comparison in &lt;300ms
- Max 6 areas selectable (visual feedback)
- Mobile: 48px+ touch targets

---

### P1.4: Guided Comparison Help (400 LoC | 85% Confident)

**The Problem:** Users mis-read "±$200" as bad data; don't understand derived metrics

**Trade-off:**  
⚠️ **DECISION 2:** Help placement strategy?
- Persistent tooltips on every metric → visible but cluttered
- "?" icons only → opt-in, low discoverability
- Collapsible section → "How to read this" auto-expands first-time
- Guided tour → intrusive if user already knows

**Recommendation:** Hybrid approach
1. Collapsible section above comparison (auto-expand first visit)
2. Small "?" icons on margin of error badges
3. Explains: MOE, derived metrics, absence reasons

**Success Criteria:**
- Users understand "±$200" is uncertainty, not bad
- 30%+ of users open at least one help tooltip
- Power users can hide help (doesn't distract)

---

### P1.5: Mobile Table Redesign (700 LoC | 85% Confident)
**Purpose:** Mobile users browse 33k ZIPs without pinch-zoom or horizontal scroll

**Implementation:**
- Breakpoint: &lt;640px shows card view instead of table
- Each card: ZIP | City | Rent | Income | [Add →]
- Sortable by tapping header
- Scroll performance optimized (windowed rendering)

**Success Criteria:**
- 375px viewport: all content readable without zoom
- Sort 33k cards in &lt;500ms
- Thumb-reachable buttons (48px+)

---

## Phase 1 Summary
- **Total LoC:** 3,100
- **Decisions blocking implementation:** 1 (sample data strategy)
- **Expected UX score gain:** 72 → 85/100
- **Timeline:** Weeks 1-6
- **Success:** New visitor goes from lost → exploring in &lt;2 minutes

---

## Phase 2: Context & Personalization (2,200 LoC | 75% Avg Confidence)

### P2.1: Saved Searches (300-800 LoC | 75% Confident)

**Trade-off:**  
⚠️ **DECISION 3:** Local storage only, or cloud sync?

**Options:**
- localStorage only (300 LoC, $0) → works offline, device-specific
- Cloud sync (800 LoC, $20-50/mo) → cross-device, requires auth
- Manual export/import (400 LoC, $0) → complex UX

**Recommendation:** Two-phase
1. **Phase 2A:** Implement localStorage (good enough for 90%)
2. **Phase 2B:** Add cloud sync only if 40%+ return-visitor data supports it

**Success Criteria:**
- Save button visible in comparison panel
- Saved search loads 6 areas in &lt;2s
- User can manage 50+ saved searches

---

### P2.2: Insights & Patterns (600 LoC | 70% Confident)

**Trade-off:**  
⚠️ **DECISION 4:** How do we show "similar neighborhoods" without creating hidden ranking?

**Options:**
- Similarity scoring: Euclidean distance on (rent, schools, health) → transparent, fast
- K-means clustering: Mathematically grounded, black-box
- User-defined profiles: Fully transparent, requires more UI
- No insights: Simpler, removes feature

**Recommendation:** Two-phase
1. **Phase 2:** Similarity scoring (transparent weights, 250 LoC)
   - "Similar to Austin: Albuquerque, Durham, Tucson"
   - Show why (rent band, school funding, health metrics)
   - Sort alphabetically to avoid ranking

2. **Phase 3:** User-defined profiles if demand exists

**Success Criteria:**
- Suggestions are actually similar (correlation &gt;0.85)
- No Fair Housing violations (never rank or imply "best")
- 20%+ user engagement with suggestions

---

### P2.3: Data Export (300 LoC | 92% Confident)
CSV + JSON export of comparison → enables analysts, researchers, real estate pros

**Success Criteria:**
- Export opens cleanly in Excel/Google Sheets
- Includes metrics + MOE + source + vintage
- &lt;100ms download latency

---

### P2.4: Methodology Depth (500 LoC | 82% Confident)
Searchable, interactive methodology guide with per-metric deep dives

**Success Criteria:**
- Researcher understands any metric in &lt;3 min
- 40%+ visitors click through to methodology
- All claims have source links

---

### P2.5: AAA Accessibility (400 LoC | 80% Confident)
Move from WCAG 2.2 AA (current) to AAA (best-in-class)

**Success Criteria:**
- Zero AAA violations (axe-core)
- Keyboard-navigable app (no mouse required)
- 100% screen reader functional (NVDA + JAWS)
- High-contrast mode: 7:1 contrast ratio

---

## Phase 2 Summary
- **Total LoC:** 2,200
- **Decisions blocking implementation:** 2 (saved searches, clustering)
- **Expected UX score gain:** 85 → 95+/100
- **Timeline:** Weeks 7-10
- **Status:** Conditional (only if Phase 1 doesn't reach 95)

---

## Confidence Matrix

| Feature | Confidence | Decision | Ready? |
|---------|-----------|----------|--------|
| P0.1: City/State geocoding | 95% | None | ✅ |
| P0.2: Auto-suggest | 94% | None | ✅ |
| P0.3: Reverse lookup | 93% | None | ✅ |
| P1.1: Onboarding flow | 88% | ⚠️ P1.2 | ✅ (after P1.2 decides) |
| **P1.2: Sample data** | **87%** | **⚠️ DECISION 1** | ⏳ |
| P1.3: Quick-add | 90% | None | ✅ |
| **P1.4: Help UI** | **85%** | **⚠️ DECISION 2** | ⏳ |
| P1.5: Mobile redesign | 85% | None | ✅ |
| **P2.1: Saved searches** | **75%** | **⚠️ DECISION 3** | ⏳ |
| **P2.2: Insights** | **70%** | **⚠️ DECISION 4** | ⏳ |
| P2.3: Data export | 92% | None | ✅ |
| P2.4: Methodology | 82% | None | ✅ |
| P2.5: AAA a11y | 80% | None | ✅ |

---

## 4 Decisions Pending from Opus

### DECISION 1: Sample Data Strategy
**Confidence:** 87% → 95% pending ruling  
**Impact:** Drop-off rate (40-60%), bundle size (+10KB)  
**Recommendation:** Pre-bake 50 representative ZIPs

### DECISION 2: Comparison Help Placement
**Confidence:** 85% → 93% pending ruling  
**Impact:** User comprehension vs. visual clutter  
**Recommendation:** Hybrid (collapsible section + "?" icons)

### DECISION 3: Saved Searches Architecture
**Confidence:** 75% → 88% pending ruling  
**Impact:** Phase 2 scope, backend cost ($0-50/mo)  
**Recommendation:** localStorage Phase 1, cloud sync Phase 2 if data supports

### DECISION 4: Insights Clustering Algorithm
**Confidence:** 70% → 82% pending ruling  
**Impact:** Fair Housing compliance  
**Recommendation:** Similarity scoring (transparent), user profiles Phase 3

---

## Execution Sequence

**Wave 1 (Weeks 1-2): Phase 0**
- P0.1, P0.2, P0.3 (all independent)
- No decisions blocking

**Wave 2 (Weeks 3-4): Phase 1 Foundation**
- Depends on DECISION 1 (sample data)
- Depends on DECISION 2 (help UI)
- P1.1, P1.2, P1.4 (once decisions made)

**Wave 3 (Weeks 5-6): Phase 1 Polish**
- P1.3 (quick-add), P1.5 (mobile)

**Wave 4+ (Weeks 7-10): Phase 2 (Conditional)**
- Depends on DECISION 3 (saved searches)
- Depends on DECISION 4 (clustering)
- Only if Phase 1 doesn't reach 95 target

---

## Risk & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Sample data inflates bundle | Medium | Monitor gzip; defer if &gt;12KB |
| City auto-suggest adds API calls | Low | Cache results; document quota |
| Mobile table perf on 33k rows | Medium | Windowed rendering (existing pattern) |
| Saved searches complexity | High | DECISION 3 resolves scope |
| Clustering bias (Fair Housing) | High | DECISION 4 resolved: reader-set weights, shipped off by default. Residual risk recorded in GOVERNANCE.md |
| Help discoverability | Medium | DECISION 2 + user testing |

---

## Files to Create/Modify

**New Files:** 15 components + 4 utilities  
**Modified Files:** 6 existing components  
**Tests:** 25+ (unit + E2E)  

See `PLANNING_TECHNICAL_DETAILS.md` for file-by-file breakdown.

---

## Expected Outcomes

**After Phase 0 (Week 2):**
- City/state search works
- UX score: 72 → 74/100 (marginal improvement)
- New baseline for Phase 1

**After Phase 1 (Week 6):**
- Onboarding + tools complete
- UX score: 74 → 85/100 (major improvement)
- **95/100 target may be met here**

**After Phase 2 (Week 10, if needed):**
- Full context + personalization
- UX score: 85 → 95+/100
- Polish complete

---

## Next Steps

1. **Opus rules on 4 decisions** (1 week)
2. **Wave 1 implementation** (Weeks 1-2)
3. **Wave 2 implementation** (Weeks 3-4, depends on decisions)
4. **Wave 3 implementation** (Weeks 5-6)
5. **Assessment:** Does Phase 1 reach 95/100?
6. **Wave 4 (conditional):** Phase 2 if needed

---

**See `PLANNING_DECISION_PACKETS.md` for full decision packet details.**
