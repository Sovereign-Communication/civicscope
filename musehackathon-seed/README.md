# musehackathon — contest-only staging & review repo (SEED, not yet live on Entire)

**Status:** seed package prepared 2026-10-26. NOT yet pushed to Entire.
Access CONFIRMED 2026-10-26 (entire CLI auth good, GitHub auth good)
and route decided (build-first on Entire) — but seeding itself remains
a SEPARATELY GATED step: access confirmation is not a seeding
authorization. Do not push this seed until Lucas explicitly authorizes
the seeding step. (Assessment runs first: read-only Spark session, no
Trail, no seeding; its report feeds the phase 1 prompt.)

## The one rule

This repo keeps ONLY the contest additions separate, fully, for review.
It is not a second copy of CivicScope, and it is not a shortcut into
CivicScope. Nothing here auto-merges, auto-ports, or auto-deploys to
`Sovereign-Communication/civicscope` or to civicscope.pages.dev.

## What this repo is for

- Contest-only staging and review for the Meta Global AI Developer
  Hackathon, INDIE track. Window Oct 26 – Nov 4, 2026; submissions due
  Nov 4, 9:00 PM ET = 4:00 PM HST via the Cerebral Valley portal.
- The review surface for each contest step, one step at a time.

## What goes in / what stays out

- IN: the Muse layer work from the plan of record (L1–L6, S1–S12, in
  order); per-step evidence (prompts, evals, demo capture notes,
  portal text, credit-budget accounting against the canonical judging-heavy $150 split ($60 live eval / $52.50 judging / $22.50 build / $15 reserve);
  and the root manifest labelling every file contest-new /
  contest-modified / pre-existing reference. No file ships without a
  label.
- OUT: no full copy of pre-existing CivicScope core, data, or registry.
  Pre-existing work is referenced, not duplicated: repo
  `Sovereign-Communication/civicscope`, pinned main SHA `3aa7e10`
  (kickoff), link. If a runnable demo needs pre-existing code, it pulls
  it as a pinned-SHA reference (submodule / pinned checkout /
  documented dependency) — never a pasted copy, never a moving branch.
  The manifest updates the pinned SHA deliberately per step.
- OUT: no secrets, API keys, or payment details — ever. This includes
  Entire's Continuous Memory surface: sessions and prompts stored
  alongside code must contain no keys. Evidence logs are aggregate
  only (same rule as the F0 proxy meter and F7 diagnostics).
- OUT: no unrelated lanes, no other repos' work, no chat transcripts.

## Review flow (adapted to Entire's model)

Entire does NOT use pull requests. It uses Trails: agent-scored evals
on every push, with optional human sign-off before merge. Adapted flow:

1. One S-step = one Trail (branch) = one review unit. No bundled
   multi-step drops.
2. Each unit is reviewed against the plan of record, the validator
   rule (the model never originates a figure; the validator gates all
   model text), fair-housing gates, Jev gate v1, and Lucas Gate v2 —
   before it lands on the repo's default branch.
3. Entire's default Trail evals (quality / security / slop) do NOT
   cover the plan gates. The plan gates run as custom evals or
   attached evidence. Trail green ≠ plan green.
4. Porting to CivicScope is a separate, later decision by Lucas, via
   its own PR(s) per step/component with full CivicScope CI + gates.
   A landing here is not a landing in CivicScope. (PR #32 is the
   rulings sync — it is NOT the porting vehicle.)

## Route & submission notes (ROUTE DECIDED 2026-10-26: build-first on Entire)

- ROUTE: build-first on Entire (Lucas, 2026-10-26). Work is built in
  this repo's Trails, per Muse Code Session Prompt 1 — Entire
  variant (`files/muse-code-session-prompt-entire.md`). Verification
  authority stays with the CivicScope gate suite, executed against an
  OVERLAY (pinned CivicScope checkout + this tree copied over it) —
  see the variant prompt §4. A Trail merges only on overlay-green +
  evidence + human sign-off. The staging-mirror route is retained as
  fallback only (build in CivicScope per the CivicScope-root Prompt
  1) if Lucas reverses the route call.
- DEFAULT SUBMISSION REPO: CivicScope (public, per the Official
  Rules). This repo is the build home under route B, but the
  submission repo stays CivicScope unless Lucas explicitly decides
  otherwise AND the breakdown text, DM description, and OR-1 framing
  are updated. Visibility CONFIRMED private 2026-10-26: this repo
  cannot be the submission repo and judges cannot verify it — the
  submission names CivicScope and describes this repo's role without
  linking it. (A submission-repo change would require revisiting
  visibility itself plus updating the breakdown text, DM description,
  and OR-1 framing together.)

## Repo layout (this seed + future steps)

- `README.md` (this file) — purpose, rule, review flow.
- `MANIFEST.md` — per-file labels + pinned pre-existing references.
- `s1-rulings.md` — S1 encoding: ruled D-slate, §6.4 budget,
  dual-track, voice L6, narrowed scope, conformity pointers.
- `evidence/` — per-step evidence lands here (see its README).
- Future steps land as `s2-…/`, `s3-…/`, … — one directory per
  S-step, each with its own manifest section, only after that step's
  review unit completes. S2/S3 are NOT seeded now: they are unbuilt.

## Transfer note (redacted copy)

This branch is a redacted copy of the seed, prepared for public transfer
to the laptop session without a download. One line in s1-rulings.md (the
credit-claim Team ID) is redacted; the value is confirmed in the tracking
thread and is not needed to build or to call the API. The Entire seed
pushed from this branch carries the same redacted line. This branch is
never merged and is deleted after the Entire seed lands.
