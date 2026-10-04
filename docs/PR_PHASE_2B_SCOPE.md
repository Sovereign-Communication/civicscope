# PR PHASE 2B: Insights & Patterns - DEFERRED (Blocked)

**Total LoC:** 250 (similarity scoring only)  
**Confidence:** 70% (conditional)  
**Status:** BLOCKED - Legal review + ZIP-level metrics audit required  
**Blocks:** Nothing (can defer indefinitely)

---

## PR TITLE (DEFERRED)
`feat: Add similarity scoring for "similar neighborhoods" feature (Phase 2B) [BLOCKED]`

---

## BLOCKER SUMMARY

**This PR cannot ship until BOTH conditions are met:**

1. **Legal Review (Fair Housing Compliance)** 
   - Status: NOT STARTED
   - Requirement: Fair Housing counsel must review similarity weights (40% rent, 30% schools, 20% health, 10% income)
   - Question: Do these weights inadvertently steer toward/away from protected classes?
   - Timeline: 2-4 weeks (estimate)
   - Owner: TBD (legal/compliance team)
   - Outcome: Written legal opinion approving weights, or recommendation to adjust

2. **ZIP-Level Metrics Audit**
   - Status: NOT STARTED
   - Requirement: Verify that schools + health metrics exist at ZIP granularity
   - Current state: 
     - Schools data (NCES): District-level only (not per-ZIP)
     - Health data (CDC PLACES): Tract-level only (not per-ZIP)
   - Problem: Can't compute meaningful similarity without per-ZIP data
   - Options:
     - (a) Source new data provider with per-ZIP granularity
     - (b) Use district/tract averages as proxy (less accurate)
     - (c) Drop schools/health metrics from similarity (reduces value)
   - Timeline: 2-4 weeks (audit)
   - Owner: TBD (data engineering)
   - Outcome: Feasibility assessment + recommendation

---

## WHY THIS IS BLOCKED

**Original Decision 4:** Implement similarity scoring to show "neighborhoods similar to your selection" (e.g., "Austin similar to: Albuquerque, Durham, Tucson").

**Opus Finding:** ZIP-level school + health metrics don't exist.
- Schools: NCES EDGE provides data at district level (not ZIP level)
- Health: CDC PLACES provides data at census tract level (not ZIP level)
- Impact: Can't compute valid Euclidean distance without per-ZIP metrics

**Example failure:** 
```
Austin (78701) similarity to Durham (27701):
- Rent: $1,450 vs $1,200 ✓ (ZIP-level data exists)
- Schools: ??? (only district averages exist)
- Health: ??? (only tract averages exist)
→ Weighted Euclidean distance is invalid/misleading
```

**Fair Housing Risk:** Similarity weights (40/30/20/10) must not encode protected-class steering (race, national origin, familial status). This requires legal review before implementation.

---

## PR SCOPE (IF UNBLOCKED)

### P2.2B: Similarity Scoring (250 LoC)

**Files to Create (PLACEHOLDER - IF APPROVED):**

1. `src/ui/SimilarityResults.tsx` (100 LoC, DEFERRED)
   - Component: Display "Similar neighborhoods" results
   - Shows top 5-8 matches sorted alphabetically (never ranked)
   - Per result: City, ZIP, similarity score (as percentage)
   - Explain why: "Similar because: rent band $1.2-1.4k, school funding A-range"
   - Disclaimer: "Results sorted alphabetically to avoid ranking"

2. `src/core/similarity.ts` (150 LoC, DEFERRED)
   - Function: `computeSimilarity(referenceZcta, allZctas) → SimilarResult[]`
   - Algorithm: Euclidean distance on normalized metrics
     - Metrics: Rent burden (%), home value (indexed), school funding (per-pupil), health score
     - Normalize each to [0, 1]
     - Weights: 40% rent, 30% schools, 20% health, 10% income
     - Distance threshold: < 0.3 (tunable)
   - Return: Top 5-8 ZIPs with lowest distance
   - Sort: Alphabetically (never by similarity score)
   - Complexity: O(n) for 33k ZIPs per call (~500ms acceptable)

**Conditional on blocker resolution:**

| If | Then |
|----|------|
| Legal approves weights + schools/health metrics available (option a) | Implement as planned with full metrics |
| Legal approves weights + schools/health not available (option b) | Use district/tract averages (note in UI: "district-level approximation") |
| Legal rejects weights | Abandon similarity feature; use Phase 2A profiles instead |
| Metrics unavailable + legal rejects | Abandon feature entirely |

---

## BLOCKER RESOLUTION PLAN

### Step 1: Legal Review (Timeline: 2-4 weeks)

**Action items:**
1. Identify Fair Housing counsel (HUD office, Fair Housing Center, or external law firm)
2. Provide:
   - Similarity weights (40/30/20/10)
   - Metric definitions (rent burden %, home value, school funding, health score)
   - Example output: "Austin similar to: Albuquerque, Durham, Tucson" (alphabetical sort)
   - Disclaimer: "Results sorted to avoid ranking"
   - Use case: Exploratory discovery tool for housing researchers
3. Request: Written opinion on whether weights steer toward/away from protected classes
4. Outcome: 
   - ✅ Approved → Proceed to implementation
   - ❌ Rejected → Adjust weights or abandon feature
   - 🟡 Conditional → Modify approach based on feedback

**Recommended language for legal review:**
> "These results are sorted alphabetically to avoid ranking neighborhoods. Similarity is computed from rent, school, and health metrics, and we are not attempting to rank neighborhoods as 'better' or 'worse'. Our goal is exploratory discovery to help users find comparable neighborhoods for research purposes."

### Step 2: ZIP-Level Metrics Audit (Timeline: 2-4 weeks)

**Action items:**
1. Contact NCES (National Center for Education Statistics)
   - Question: Can district-level school data be mapped to ZIPs?
   - Alternative: Are per-ZIP school metrics available (private data, paid API)?
2. Contact CDC (Centers for Disease Control)
   - Question: Can tract-level health data be aggregated to ZIP level?
   - Alternative: Are per-ZIP health metrics available?
3. Internal audit:
   - Check existing data sources (current NCES school plugin)
   - Verify granularity (district vs. ZIP)
   - Document limitations

**Feasibility matrix:**

| Schools | Health | Recommendation |
|---------|--------|-----------------|
| Per-ZIP | Per-ZIP | ✅ Proceed (use full metrics) |
| District (avg) | Tract (avg) | 🟡 Proxy approach (document limitations) |
| District only | Tract only | 🟡 Drop metrics; use rent + income only |
| Unavailable | Unavailable | ❌ Abandon feature |

**Outcome:** Feasibility assessment document

---

## DECISION GATE (BEFORE IMPLEMENTATION)

**Do NOT implement Phase 2B until:**

```
Legal Review: ✅ APPROVED 
   AND
ZIP-Level Metrics: ✅ FEASIBLE (options a or b)
```

**If either fails, move resources to Phase 2A or future features.**

---

## ALTERNATIVE: USER-DEFINED PROFILES (PHASE 2A)

**If similarity scoring blocked indefinitely:**

Phase 2A already includes user-defined profiles (Option C), which is:
- Fair Housing safe by design (fully transparent)
- Doesn't require per-ZIP school/health metrics
- Empowers users to discover neighborhoods on their own terms
- Example: "Show me all ZIPs where rent < $2k AND schools rated B+ AND health > 75"

**Recommendation:** Ship Phase 2A regardless. Consider Phase 2B (similarity) only if legal + metrics audit pass.

---

## PLACEHOLDER: FUTURE REFERENCE

If Phase 2B eventually unblocked:

**Implementation checklist:**
- [ ] Legal review completed and approved
- [ ] ZIP-level metrics sourced (or proxy approach documented)
- [ ] Similarity algorithm implemented (250 LoC)
- [ ] Tests: 8 unit tests (similarity computation, edge cases)
- [ ] E2E: 3 tests (button click, results display, A-Z sort)
- [ ] Results sorted A-Z (never ranked)
- [ ] Disclaimer shown: "Results sorted alphabetically to avoid ranking"
- [ ] Performance: < 500ms for 33k ZIPs
- [ ] Accessibility: Keyboard navigation, screen reader compatible

---

## RISK SUMMARY

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Legal review rejects weights | HIGH | Abandon feature; Phase 2A sufficient |
| ZIP-level metrics unavailable | HIGH | Use proxy data or drop feature |
| Legal review delayed | MEDIUM | Proceed with Phase 2A (unblocked) |
| Performance (33k similarity calculations) | MEDIUM | Optimize with memoization; consider pre-computation |
| Fair Housing lawsuit risk | CRITICAL | Must have legal clearance before launch |

---

## SUCCESS CRITERIA (IF UNBLOCKED)

- ✅ Legal opinion: Weights do not steer toward/away from protected classes
- ✅ ZIP-level metrics: Available or proxy approach feasible
- ✅ Results: Show 5-8 similar ZIPs, sorted A-Z
- ✅ Performance: < 500ms for 33k ZIPs
- ✅ Accessibility: Keyboard + screen reader compatible
- ✅ Fair Housing: No ranking, no steering language
- ✅ User engagement: 20%+ click-through on results

---

## RELATED DECISIONS

- **Phase 2A profiles:** Ships regardless (unblocked)
- **Fair Housing compliance:** Required for all clustering/similarity features
- **Data source strategy:** Ongoing (ZIP-level metrics audit)

---

## SUMMARY

**Phase 2B is DEFERRED, not abandoned.** Implementation pathway is clear if blockers resolve:

1. Legal review approves similarity weights (2-4 weeks)
2. ZIP-level metrics sourced or proxy approach validated (2-4 weeks)
3. Implement 250 LoC feature + tests (if approved)

**In the meantime:** Ship Phase 2A (profiles + export + methodology + accessibility). Phase 2A is Fair Housing safe and doesn't require per-ZIP metrics.

