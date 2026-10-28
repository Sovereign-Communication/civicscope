# Contest port manifest

This file is the record of what the Meta hackathon contest work in this
repository is built from. It exists so the submission breakdown (built
during the contest vs pre-existing) is a file in the repo, not a claim in
a form.

## Pre-existing (not contest-built)

The metric registry is CivicScope's own code, written before the contest.
It is retained on the contest base branch unchanged in substance; the only
edits are the pre-existing label headers at the top of each file.

| File | Contents | Source |
| --- | --- | --- |
| `src/core/plugins/acs.ts` | `METRIC_DEFS` (15 keys), `METRIC_DEFS_BY_KEY`, `METRIC_KEYS` | `Sovereign-Communication/civicscope` at `3aa7e10dc59e764a8636aa273d4ff86714a3e782` |
| `src/core/sortable-surface.ts` | `SORTABLE_METRIC_KEYS` (5 keys) | `Sovereign-Communication/civicscope` at `3aa7e10dc59e764a8636aa273d4ff86714a3e782` |
| `src/core/civicscope-registry.ts` | Same 15 + 5 keys, as the House layer's registry module | Pre-existing copy of the two files above, labelled as such in its own header; ported byte-faithful from the contest workbench, and pinned against drift from the registry above by `tests/contest-registry-pin.test.ts` |

`tests/contest-registry-pin.test.ts` pins both key sets exactly, so any
drift in the registry on the contest branch fails the suite instead of
slipping into the submission as an unrecorded change.

Everything else on `main` at the same source SHA is likewise pre-existing:
the registry is called out here because the contest work builds directly
on it.

## Built during the contest

The House work (Ask, Explain, the numeral-provenance validator, the meter
and proxy, the harness fixtures and golden corpus, the disclosure text,
and the provider interface) is tracked as port issues #33-#40. Each item
is recorded in this manifest when its pull request lands on the contest
base branch (`contest/house-port`), with its pull request number.

| Issue | Item | Status |
| --- | --- | --- |
| #33 | Registry, labeled pre-existing | Landed, PR #41, merged at 191d0288 |
| #34 | Ask surface, text only | Pending port |
| #35 | Explain, capability only | Pending port |
| #36 | Validator (F4) | Landed (this PR): src/core/ai/validator.ts, src/core/ai/intent-schema.ts (shared Ask foundation) |
| #37 | Meter and proxy (F0) | Pending port |
| #38 | Harness fixtures and golden corpus | Pending port |
| #39 | Privacy and disclosure text | Pending port |
| #40 | Provider interface | Landed with the port foundation (PR #43): src/core/ai/provider.ts, src/core/ai/proxy-errors.ts |

## Submission scope

The submission is scoped to the House work only. This registry and the
rest of the pre-existing application are the pad the House builds upon;
they are not claimed as contest work in any submission material.
