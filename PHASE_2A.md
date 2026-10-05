# Phase 2A: Profiles, Export, Methodology, Accessibility (1,600 LoC)

Branch tracks Phase 2A implementation work. **Conditional on a UX measurement of
Phase 0 + Phase 1 — do not start before that exists.**

Scope and decisions: `docs/PR_PHASE_2A_SCOPE.md`, and the Phase 2A corrections in
`docs/OPUS_REMEDIATION_APPLIED.md`.

Two carried decisions worth restating before work starts:

- **School and health filters are removed from profiles.** No ZIP-level source
  exists for them, and steering risk is the reason. Rent, rent burden, home value
  and population are kept. See `docs/EXECUTION_READY.md`.
- **A profile must not reorder or rank places.** Profiles filter; they do not
  produce a "best" list.

Status: not started.
