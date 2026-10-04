# CivicScope UX Plan: Decision Packets for Opus Review

**Reference:** See `UX_IMPROVEMENT_PLAN.md` for full context  
**Status:** 4 decisions needed before Wave 2 (Week 3)

---

## DECISION PACKET 1: Sample Data Strategy

**Current Confidence:** 87% → 95% pending decision  
**Impact:** Drop-off rate (40-60%), bundle size (+10KB)  
**Blocking:** P1.1 (Onboarding), P1.2 (Optional key)

### Problem
New visitors without a Census key see a blank search. The app is useless to them for 2-5 minutes (time to request + receive key). This causes 40-60% drop-off before Census key adoption.

### Options

**Option A: Pre-bake 50 representative ZIPs into bundle**
- Load time: &lt;500ms (no network)
- Bundle impact: +10KB gzipped (~2% of 500KB total)
- Maintenance: Quarterly update (15 min)
- Data: 50 ZIPs = 10 metros + 10 affordable + 10 expensive + 20 mid-size
- UX: User sees live data immediately in comparison

Pros:
- Instant "wow" moment → higher Census key adoption
- Zero network requests on load
- Clear value prop before friction (key signup)

Cons:
- +10KB to production bundle
- Maintenance burden (quarterly update)
- Sample set feels arbitrary (why these 50?)

**Option B: Fetch sample ZIPs on first load (cached locally)**
- Load time: 2-3 seconds (Census API call)
- Bundle impact: 0 KB additional
- UX: User still waits 2-3s before seeing data (defeats purpose)

Pros:
- Flexible sample size
- Can update without redeploy
- Fresh data (no staleness)

Cons:
- Doesn't solve the friction (user still waits)
- Census API quota hit on every new visitor
- Defeats the "instant wow" goal

**Option C: No sample data — only show blank search**
- Load time: Instant (no data)
- Bundle impact: 0 KB additional
- UX: "Enter a ZIP code or city name" (no proof it works)
- Key adoption: 60% drop-off before Census key request

Pros:
- Zero code complexity
- No maintenance burden

Cons:
- Fails onboarding goal (40%+ Census key conversion)
- Doesn't enable any exploration without key
- "Try example" feature becomes ineffective

**Option D: Sample data via hardcoded generator (quarterly cron job)**
- Load time: &lt;500ms (bundled data)
- Bundle impact: +8-10KB gzipped
- Maintenance: Automated via Census API cron job
- Data is 2-3 weeks old (refresh monthly)

Pros:
- Fresh data (quarterly refresh)
- Maintainable (cron handles updates)
- Still bundled (no network latency)

Cons:
- Requires CI/CD cron job
- Data age matters for rent tracking
- Adds deployment complexity

### Recommendation

**OPTION A (Pre-bake 50 ZIPs) with quarterly manual refresh**

Trade-off reasoning:
- +10KB in 500KB bundle is acceptable cost
- 40-60% drop-off reduction justifies the maintenance
- Sample set: 10 major metros (NYC, Austin, LA, SF, etc.) + affordable/expensive/mid-size suburbs
- Quarterly review: Update 5-10 ZIPs if rents shifted significantly
- Expected impact: 60% → 65%+ Census key adoption rate

### Opus Decision Needed
✅ Approve Option A, or  
❌ Recommend Option B/C/D with rationale

---

## DECISION PACKET 2: Comparison Help UI Placement

**Current Confidence:** 85% → 93% pending decision  
**Impact:** User comprehension (do they understand "±$200"?) vs. visual clutter  
**Blocking:** P1.4 (Guided help)

### Problem
Users mis-read margin of error. Examples:
- "±$200 means this data is bad" (wrong — it's 90% CI)
- "What is rent-to-income ratio?" (not explained inline)
- "Why is this metric missing?" (absence reasons unclear)

We need help that:
1. Reaches 80%+ of users
2. Doesn't annoy power users
3. Teaches the critical 3 concepts: MOE, derived metrics, absence

### Options

**Option A: Persistent help text on every metric**
- Shows margin of error explanation always visible
- Renders on each MetricCard

Pros:
- Help always there (no discovery)
- Reaches 100% of users

Cons:
- Cards feel crowded
- Power users find it annoying
- Takes up 3-4 lines per card (significant space)

**Option B: "?" icon per metric (tooltip on hover/click)**
- Small "?" badge on MetricCard
- Hover/click shows tooltip

Pros:
- Opt-in help (doesn't annoy power users)
- Minimal visual clutter

Cons:
- Discoverability very low (&lt;20% discover it)
- Mobile touch target small (hard to tap)
- Users don't know what "?" means without instruction

**Option C: Guided 60-second tour on first comparison (dismissible)**
- Interactive overlay showing each part
- "This is margin of error. It means..."
- Auto-dismiss after or on button click

Pros:
- Teaches at exactly the right moment (first comparison)
- Interactive (engaging)
- Complete walkthrough

Cons:
- Feels intrusive if user already knows
- Hard to repeat (no way to trigger again)
- Needs to be dismissible (some users skip)

**Option D: Collapsible section above comparison (hybrid)**
- Section: "Understanding these figures" (auto-expanded first visit)
- Explains: MOE (90% CI), derived metrics, absence reasons
- Collapsible after first click (power users can hide)
- Small "?" icons on badges as secondary help

Pros:
- Visible but not intrusive (collapsible)
- Reaches 80%+ of users (first comparison)
- Power users can collapse (no annoyance)
- Hybrid with icons (secondary help)

Cons:
- Another UI section to scroll past
- First-time visitors might skip without reading

**Option E: Right-click context menu on metric**
- Right-click → "Why this number?" → tooltip
- Keyboard: Shift+? on focused metric

Pros:
- Hidden from casual users
- Available if needed

Cons:
- Discoverability near zero (almost no one right-clicks data)
- Not mobile-friendly

### Recommendation

**HYBRID: Option D (Collapsible section) + Option B (small icons)**

Implementation:
1. **Collapsible "Understanding these figures" section**
   - Position: Above first comparison card
   - Auto-expand on first-time visit (detect via localStorage)
   - 3 subsections:
     - "Margin of error: ±$200 means 90% confidence this is within that range"
     - "Derived metrics: Rent-to-income = computed by us, not a Census figure"
     - "Absence reasons: ⚠ means Census didn't publish this figure"
   - Collapse on click (hide for power users)

2. **Small "?" icons on badges**
   - On "±" margin badge
   - On "computed" badge
   - On absence warning badge
   - Mobile-friendly: 24px touch target (wrap in larger button area)
   - Tap/hover shows 1-line definition

Trade-off reasoning:
- Reaches 80%+ of visitors with low intrusiveness
- Power users skip section immediately (collapsible)
- Covers 3 main confusion points in one place
- Icons provide secondary help for power users
- &lt;5 min implementation per strategy component

### Opus Decision Needed
✅ Approve hybrid approach, or  
❌ Recommend single strategy (A/B/C/E) with rationale

---

## DECISION PACKET 3: Saved Searches Architecture

**Current Confidence:** 75% → 88% pending decision  
**Impact:** Phase 2 scope, backend cost ($0-50/mo), user retention  
**Blocking:** P2.1 (Saved searches)  
**Timeline:** Only needed if Phase 2 ships (Week 7+)

### Problem
Power user (researcher, real estate agent) compares 6 ZIP codes, closes browser, returns next day. Currently must rebuild comparison from scratch. High-value users need this feature; low-value for one-time visitors.

### Options

**Option A: localStorage only (no cloud sync)**
- Store searches in `localStorage` (IndexedDB if needed for size)
- JSON serialization: `{ name, selectedZctas, presetUsed, timestamp }`
- Max ~50 searches (~500KB in localStorage)

Pros:
- Zero backend cost ($0/mo)
- Works offline
- Simple implementation (300 LoC)
- Follows existing `civicscope.*` pattern (Census key also in localStorage)

Cons:
- Lost if user clears browser data
- Single device only (no sync to phone/laptop)
- Research use case limited (can't share across team)

**Option B: Cloud sync with optional login (Supabase/Firebase)**
- User optional: "Save across devices?" → one-time auth
- Stores searches in backend database
- Sync on load + any change
- Enable "share search" link in Phase 3

Pros:
- Sync across devices (researcher on desktop + mobile)
- Team sharing possible
- Durable (survives browser clear)
- Enable future "public search gallery" feature

Cons:
- Backend infrastructure needed ($20-50/mo Supabase)
- Privacy commitment: must never track searches for analytics
- User auth scope creep (is it email-only? OAuth?)
- Fair Housing: must not persist patterns for profiling
- Increases data retention responsibility

**Option C: Manual export/import (JSON)**
- "Export search as JSON" button
- "Import search" file picker
- Share by copy/paste JSON string or file

Pros:
- Zero backend cost ($0)
- User has data (portable)
- Works offline

Cons:
- Friction for users (copy/paste)
- Not seamless (not "one-click restore")
- Limited utility for return visitors

**Option D: No saved searches feature**
- Remove from Phase 2
- Focus on Phase 1 completing 95/100 target

Pros:
- Simpler scope
- Reduces implementation risk

Cons:
- Removes feature requested by power users
- Researcher workflow incomplete

### Recommendation

**TWO-PHASE APPROACH:**
1. **Phase 2A (Week 7):** Implement Option A (localStorage)
   - Simple, works for 90% of users
   - 300 LoC, $0 cost
   - Prove demand for cross-device sync

2. **Phase 3 (Week 11+):** Upgrade to Option B IF data supports
   - Only build cloud sync if analytics show:
     - 40%+ return-visitor rate
     - 30%+ of return visitors use saved searches
   - Upgrade decision based on real usage data, not speculation

Trade-off reasoning:
- Start simple (localStorage + UI)
- If users are saving searches repeatedly across devices, upgrade to cloud
- Avoids pre-building infrastructure for low-probability use case
- Keeps Phase 2 focused on 95/100 UX target

### Opus Decision Needed
✅ Approve two-phase (localStorage now, cloud later if data supports), or  
❌ Recommend Option B now (cloud from start), or  
❌ Recommend Option D (defer feature entirely)

---

## DECISION PACKET 4: Insights Clustering Algorithm

**Current Confidence:** 70% → 82% pending decision  
**Impact:** Fair Housing compliance, discovery feature quality  
**Blocking:** P2.2 (Insights & patterns)  
**Timeline:** Only needed if Phase 2 ships (Week 8+)  
**Legal review:** Required before implementation

### Problem
User selects "Austin, TX (6 areas)". It's valuable to show "Other neighborhoods like your selection: Albuquerque, Durham, Tucson". But clustering can:
- Create false patterns (accidental demographic correlation)
- Imply ranking ("best" vs "worst")
- Violate Fair Housing if clustering encodes protected classes

### Options

**Option A: Euclidean similarity scoring**
- Metrics: Rent burden (%), home value (indexed), school funding (per-pupil), health score (CDC)
- Normalize each to [0, 1]
- Compute L2 distance to every other ZIP
- Show top 5-8 ZIPs with &lt;0.3 distance

Pros:
- Fast (ms on 33k ZIPs)
- Transparent (show weights: "50% rent, 25% schools, 20% health, 5% income")
- Explainable ("Similar because: rent band $1.2-1.4k, school funding A-range")
- No backend needed
- Verifiable (users can check why matches were made)

Cons:
- Weights are somewhat arbitrary (why 50% rent?)
- Doesn't handle correlations
- Could accidentally encode protected-class bias

**Option B: K-means clustering (pre-computed nightly)**
- Cluster all 33k ZIPs into K groups overnight
- User input → find cluster → show all members
- K = TBD (10? 20? 50?)

Pros:
- Mathematically grounded
- Discovers natural patterns (unsupervised)
- Could find non-obvious clusters

Cons:
- Black-box output (why is Austin grouped with Durham?)
- Requires backend cluster job + storage
- K choice is arbitrary (tuning required)
- Could encode demographic bias (clustering can amplify patterns)
- Harder to audit for Fair Housing

**Option C: User-defined profile matching**
- User specifies: "rent &lt; $2k, schools rated B+, health &gt; 75"
- System returns all ZIPs matching profile
- Fully transparent (user defines criteria)

Pros:
- Zero bias (user in control)
- Completely transparent
- Powerful for research use case

Cons:
- Requires more UI (filter builder)
- Users must know what to ask for
- Not "discovery" (user must drive it)
- Not discoverable for first-time use

**Option D: No insights feature**
- Remove from Phase 2 scope
- Focus Phase 2 on export, methodology, accessibility

Pros:
- Reduces complexity
- Eliminates Fair Housing risk
- Simpler Phase 2

Cons:
- Removes discovery feature
- Researchers lose exploratory tool

### Recommendation

**TWO-PHASE WITH LEGAL REVIEW:**
1. **Phase 2 (Week 8):** Implement Option A (similarity scoring)
   - Use these metrics: Rent burden, home value, school funding, health score
   - Weights: 40% rent, 30% schools, 20% health, 10% income
   - Show top 5-8 matches
   - Always explain in UI: "Similar because: [reason]"
   - Always sort alphabetically (never rank)
   - Disclaimer: "Sorted A-Z to avoid ranking"

2. **Phase 3 (Week 12):** Add Option C (user-defined profiles) if demand exists

3. **Before implementation:** Legal review of similarity weights for Fair Housing bias

Trade-off reasoning:
- Similarity scoring is auditable (weights visible in code)
- Transparent (UI shows why matches occurred)
- Users can verify matches make sense
- Option C in Phase 3 gives power users full control if needed
- Avoids black-box clustering that's hard to audit

### Opus Decision Needed
✅ Approve two-phase (similarity now, profiles Phase 3), or  
❌ Recommend Option B (k-means), or  
❌ Recommend Option C (profiles only), or  
❌ Recommend Option D (defer feature)

Plus: **Legal review**: Do you need Fair Housing review of similarity weights before we proceed?

---

## Summary Table

| Decision | Confidence | Blocker | My Recommendation | Request |
|----------|-----------|---------|-------------------|---------|
| **1** | 87% | P1.1-P1.2 | Pre-bake 50 ZIPs (+10KB) | Approve or alt? |
| **2** | 85% | P1.4 | Hybrid (section + icons) | Approve or alt? |
| **3** | 75% | P2.1 | localStorage Phase 1, cloud Phase 2 if data | Approve or alt? |
| **4** | 70% | P2.2 | Similarity Phase 2, profiles Phase 3 + legal review | Approve or alt? |

---

## If You Approve Recommendations
- **Wave 1 (Weeks 1-2):** Phase 0 ships (no decisions needed)
- **Wave 2 (Weeks 3-4):** Phase 1 ships (decisions 1 & 2 unblock P1.1-P1.4)
- **Wave 3 (Weeks 5-6):** Phase 1 polish (P1.5 ships)
- **Assessment (Week 6):** Has Phase 1 reached 95/100?
- **Wave 4 (Weeks 7-10, conditional):** Phase 2 ships if Phase 1 &lt; 95 (decisions 3 & 4 unblock)

---

## Quick Decision Format

To approve/reject, provide one response per decision:

```
DECISION 1: [Approve Option A / Recommend Option B-D / Need more analysis]
DECISION 2: [Approve hybrid / Recommend Option A-E / Need more analysis]
DECISION 3: [Approve two-phase / Recommend Option B-D / Need more analysis]
DECISION 4: [Approve two-phase + legal review / Recommend Option B-D / Need more analysis]
```

That's all we need to unblock Wave 2 development.
