# Phase 2B: Similarity Scoring (1,700 LoC MVP)

Branch tracks Phase 2B implementation work. **Ships disabled by default.**

Scope: `docs/PR_PHASE_2B_SCOPE.md`, which is authoritative.

## Status: approved, not blocked

This branch previously said BLOCKED pending legal review (issue #2) and a
ZIP-level metrics audit (issue #3). Both are closed:

- **Issue #2 closed by decision.** No attorney review will be obtained for this
  project. The mitigation is that the feature is **off by default** behind a flag,
  the reader sets the weights, and metrics marked `protectedClassProxy` are
  refused as ranking inputs. `GOVERNANCE.md` states plainly that no attorney has
  reviewed the code and that nothing here is legally cleared.
- **Issue #3 closed with evidence.** CDC PLACES does publish a ZCTA-level release
  (`qnzd-25i4`, 1,171,563 rows, keyless, with confidence limits). The earlier
  "CDC is tract-level only" belief described this repository's plugin, not CDC's
  catalogue. NCES is genuinely district-level and is deferred rather than
  approximated.

## Before writing code

`protectedClassProxy` is documented more strongly than it is enforced.
`src/core/types.ts` promises these metrics are "never offered as a sort or filter
control"; what exists is exclusion from composite scores in `src/core/scoring.ts`.
Ranking weights and profile filters are exactly that unenforced surface, and
Phase 2B is about ranking weights. Tracked in **issue #11**, and it should be
closed before this branch starts.

## Two decisions already taken

- **Outcome-named templates are dropped, not deferred.** "Schools Priority" is the
  highest-steering feature in the plan and there is no basis on which to ship it
  later either.
- **The bake must not load on init.** 0.5-1 MB gzipped is five to ten times the
  whole application bundle. Lazy, on demand, served from `/map/`.
