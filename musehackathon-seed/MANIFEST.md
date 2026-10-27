# Manifest — musehackathon seed (updated per step; no file ships without a label)

Labels: **contest-new** (written during Oct 26 – Nov 4, 2026 for this
contest) · **contest-modified** (pre-existing file changed by contest
work; the change is the contest work, the base is pre-existing) ·
**pre-existing reference** (not copied here; cited by repo + pinned SHA
+ link only).

## Seed files (this package)

| File | Label | Notes |
|---|---|---|
| `README.md` | contest-new | Purpose, rule, review flow, route/submission defaults. |
| `MANIFEST.md` | contest-new | This file. |
| `s1-rulings.md` | contest-new | S1 encoding (see below). Mirrors the CivicScope S1 plan-amendment content; it is not a substitute for it. |
| `evidence/README.md` | contest-new | Per-step evidence landing rules. |

## Pre-existing references (NOT copied; pinned, not moving)

| Reference | Pinned at | Notes |
|---|---|---|
| `Sovereign-Communication/civicscope`, main | `3aa7e10dc59e764a8636aa273d4ff86714a3e782` (kickoff) | Pre-existing product: plugin registry, deterministic data engine, sweep / drilldown / comparison / similarity views, figure components, Census ACS / TIGERweb, CDC PLACES, NCES EDGE, EPA wetlands integrations, executor fair-housing rules (PR #15), URL state, sitemap. Zero Meta AI integration before the hackathon (only Jev, offline, in the completion gate). |
| `docs/full-muse-layer-plan.md` (in CivicScope) | main `3aa7e10` + PR #32 rulings sync (OPEN, unmerged at seed time) | Plan of record. The CivicScope S1 plan-amendment PR waits for, or rebases onto, PR #32. |
| PR #29 (merged Oct 19) | — | EPA wetlands integration; pre-existing, not contest work. |

## S1 note

`s1-rulings.md` encodes the owner-ruled end states (D1–D8, §6.4 budget,
dual-track, voice L6, narrowed scope). It is contest-new text. The
CivicScope-side S1 plan-amendment PR is a separate artifact owned by
Muse Code Session 1; this seed mirrors its content for review. If the
two ever disagree, STOP and reconcile — do not silently pick one.

## Per-step manifest rule

Each future S-step appends its section here before its review unit
lands: every file it adds or modifies, labelled; every pre-existing
file it touches, labelled contest-modified with the change described;
the pinned CivicScope SHA in force for that step (updated deliberately,
never auto-followed). A step with an unlabelled file does not land.
