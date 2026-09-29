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

| Phase | Status | Evidence |
|---|---|---|
| CIVICSCOPE-COMPLETION | see STATUS below | see STATUS below |
| CIVICSCOPE-R1-PLATFORM | **open** | Chunked country-wide sweep, cache architecture, state pre-filter. Not yet started. |
| CIVICSCOPE-R2-SCHOOLS | **open** | Per-school data exists for New York only. 49 states district-level only, disclosed. |
| CIVICSCOPE-R3-DOMAIN | **open** | Domain not yet registered. `civicscope.fyi` selected, purchase pending. |
| CIVICSCOPE-R4-A11Y-PERF | **open** | axe-core reports 0 violations. Full audit under a loaded 33k-row table not yet run. |

## STATUS

**CIVICSCOPE-COMPLETION**: _unpopulated — the merge SHA is written here after the
first PR merges._

This file is the single source of truth for phase status. It is edited only after
the corresponding evidence exists; it is never written to describe work that has
not happened.
