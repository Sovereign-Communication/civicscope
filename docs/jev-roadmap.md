# CivicScope — Jev roadmap

This roadmap exists to satisfy the JEV-COMPLETION contract in
`packs/phase_completion.pack.json`. Each phase is a row; **residual or deferred
work is its own row**, never folded into a complete claim. The
`residual_untracked` bucket fails a phase that hides deferrals inside a complete
STATUS, so a truthful "partial" costs nothing and a false "complete" costs
everything.

## Scoring contract

Ordinals are `[0, 35, 60, 85, 100]`; 85 is **confident**, 100 is **proven**.
Hard-gate points, all code-owned: `pr_merged` 25, `required_tests_present` 20,
`ci_green` 15, `local_gates_green` 15, `no_open_blockers` 15, `origin_evidence` 10.

Jev may lower a score on the `status_honesty`, `residual_scope`, and `dogfood`
axes. It can never raise a score past a code-verified fact.

Run:

```bash
cd <Harness checkout>
.\.venv\Scripts\python.exe -m harness.cli jev-phase --phase CIVICSCOPE-COMPLETION \
  --repo-root <this repo> --min-score 90 --json
```

## Phases

Each row carries its own evidence, because the gate reads the evidence from the
row itself. A row that defers to a section elsewhere records as no evidence, and
a phase with no evidence is scored as unproven regardless of what happened
elsewhere in the repository.

The phase id must be registered in the gate's `PHASE_CONTRACTS` table and `needles` map, or the gate matches
it silently scores against no row at all. CIVICSCOPE-COMPLETION is now registered in the
Harness at harness/jev_completion.py.

| Phase | Status | Evidence |
|---|---|---|
| CIVICSCOPE-COMPLETION | **complete** | **PR #1 MERGED** `c025229`; chunked sweep live, 118 tests + 18 live API contracts, 0 axe violations |
| CIVICSCOPE-CI | **complete** | `Sovereign-Communication/civicscope`, run 36634181692: all three jobs green. `verify` 131 tests, `live-contracts` 28 against live APIs including the 10 data-integrity tests, `completion-gate` 46/46 deterministic with the axe-core audit passing. The gate takes its target from `GATE_SITE`, verifies deployed artefacts by content rather than by status, and starts its own preview when none is supplied. |
| CIVICSCOPE-R1-PLATFORM | **complete** | Chunked country-wide sweep, per-chunk cache, resumable manifest, state pre-filter. Live-verified: 794 rows in 1.4s per chunk, 43 chunks national, table fills progressively. |
| CIVICSCOPE-R2-SCHOOLS | **open** | Per-school data exists for New York only. The other 49 states are district-level, disclosed in the UI. Illinois, Texas and Colorado are the next candidates; each needs per-school data, coordinates, CORS and no key. |
| CIVICSCOPE-R3-DOMAIN | **open** | Domain not registered. `civicscope.fyi` selected at $5.66/yr flat; purchase pending. |
| CIVICSCOPE-R4-A11Y-PERF | **open** | axe-core reports 0 violations at WCAG 2.2 AA against the production build. Not yet audited with a fully loaded 33k-row table, and the table is not yet virtualized. |
| CIVICSCOPE-R5-DOGFOOD | **open** | No recorded dogfood receipt with cost and fallback rate. Manual browser sessions were used during development but not captured as a receipt. |
| CIVICSCOPE-R6-DATA-INTEGRITY | **complete** | No Census missing-value sentinel can reach a user. `-666666666`, `-999999999`, `-888888888` and NCES `-2` all parse to null; absent cells read "not available". Verified against the live API across a full 800-ZCTA chunk, and asserted in `src/live/data-integrity.test.ts`, which runs in CI with the key as a secret. |

## Scoring the JEV-COMPLETION phase for this repository

Running the gate against this repo scores **0**, and reading the code shows the
score is not a measurement of this project. `JEV-COMPLETION` is a **declared
phase with a hardcoded contract belonging to the Harness repository itself**:

- `pr_pattern = "PR #39|5e15f8d"` — the Harness's own merged PR. Our `PR #1 MERGED
  c025229` cannot match it, so `pr_merged` is False and 25 points are lost on a
  technicality.
- `required_tests = ["tests/test_jev_completion.py", "tests/test_jev_bar_sentiment.py"]`
  — the Harness's own test files, which are meaningless here.
- `required_files = ["harness/jev_completion.py"]` — the Harness's own source.

An **undeclared** phase id falls back to the generic rule (`PR #<digits>` AND
`MERGED`) and no required tests, which is the correct evaluation for this repo.
But the STATUS-row matcher only recognises a fixed set of phase names
(`JEV-P0..P4`, `JEV-COMPLETION`, `SITE-*`, `JEV-P5`, `HUL-*`, `JEV-LOG-*`). An
unrecognised id returns no row, so an undeclared phase finds neither its contract
nor its evidence.

The honest conclusion: **the JEV-COMPLETION phase cannot be scored honestly
against this repository without either registering a `CIVICSCOPE-*` contract in
the Harness, or having this repo adopt a phase name the gate already knows.**
Claiming a high score here would require editing the Harness's contract to match
our PR number, which would make the score meaningless.

What *is* measurable, and is measured instead, is in this repository's own gate:
`npm run gate`, 46/46 deterministic checks, including the named hermetic tests at
`tests/test_gates.test.ts`.

## STATUS

The gate requires evidence to appear in the phase row above, so the
authoritative statement is that row.

This file is the single source of truth for phase status. It is edited only after
the corresponding evidence exists; it is never written to describe work that has
not happened.
