# S1 — Ruled end states (contest-new; mirrors the CivicScope S1 plan-amendment content)

Owner-ruled, not defaults. Do not re-open. Encoded here for review;
the CivicScope-side S1 plan-amendment PR (Muse Code Session 1) is the
plan-of-record copy and is HELD alongside PR #32 (rulings sync, on
HOLD — do not merge, owner decision Oct 26). If this file and that PR
ever disagree, STOP and reconcile.

## D-slate (ruled Oct 25)

- **D1** hybrid: shared-$150 proxy first, BYO beyond. **D2**
  BYO-after-credits. **D3** official Muse workflow inside the
  CivicScope repo. **D4** strict: describe/compare cited figures,
  never call a place good/bad. **D5** proxy-side minimisation
  (structured slots, not raw query text, wherever the feature allows)
  + standing disclosure in the privacy text. **D6** briefing pack
  committed fully (1,450–2,050 LoC). **D7** English-only at launch,
  with an honest boundary. **D8** "Muse layer" in-product.

## §6.4 budget (canonical, JUDGING-HEAVY, owner-decided Oct 26)

Live eval $60 (including Wonder offline grading) / judging-window
shared allowance $52.50 (per-client capped) / build iteration $22.50
/ reserve $15. This SUPERSEDES the Oct 25 amendment split
($60/$37.50/$30/$22.50) — do not use that split, and do not carry
two budgets. Note: the per-client cap inside the $52.50 judging
allowance is set in the F0 meter config at S10; no per-client number
is decided here — do not invent one. Billing
gate GREEN since Oct 26 ~12:19 HST ($150 free credits in use, payment
method verified). Spend-limit notification + Team ID on the claim:
unconfirmed (owner actions; the code meter enforces caps regardless).

## Dual-track + runner rule

Build Fusion Lite panels now; calibrate against Jev during build;
submit Plan A (Meta-pure) only if panels meet ≥90% decision gates AND
100% safety subset, otherwise Plan B (Meta runtime + Jev offline-only
gates; every user-facing model is Meta either way). Orchestration may
orchestrate the build, but user-facing language jobs stay Muse Spark —
never swap in a cheap non-Meta model for a user-facing job.

## Voice — L6 / component F8 (IN SCOPE, ruled Oct 26 14:34)

Modality layer over F1 intent + F3 Explain + F6 pack, not a new
product or model. Mic icon next to search, additive (full text /
keyboard path stays intact). Goals-first conversation (live-in vs
rent-out first, then budget, household, priorities). Transcript shown
as editable intent chips; a misheard place or number never silently
drives a search; low-confidence transcripts route to clarification.
Context-aware follow-ups reuse stated criteria only; state in session
+ URL state. Last-mile flush-out once a ZIP shortlists (school
district, tract/neighbourhood figures, rent burden, home value — each
with margin of error and source — then a briefing pack). Transcription
via **muse-voice-transcribe-1.0 on the Meta Model API**
(speech-to-text); NO Meta voice-synthesis model exists, so responses
stay ON-SCREEN as figure cards, never a spoken summary alone. Spoken
numbers pass the SAME F4 validator as written numbers. Fair-housing
line holds in voice exactly as in text. Privacy: capture is a browser
capability and transcription sends audio to Meta — the standing
disclosure MUST be extended to cover the capture + transcription path
explicitly, with first-use consent before mic use. Transcription calls
meter under §6.4 via D1 proxy-first / D2 BYO (no separate budget
line); the F0 allowlist MUST include the transcription endpoint. F8
LoC 1,650–2,310. Build order: F8 lands AFTER F1/F2/F3, never first.
Demo: voice appears inside the Ask beat (mic → chips → results), not
as a separate beat. Ship-gate (ruled Oct 26): voice is best-effort —
set up for it, but if it is not fully functional, it does NOT ship:
cut it from submission claims and demo without breaking the rest. DM
consistency: the moderator eligibility DM
already describes the new layer as including voice — no correction
needed.

## Scope — Explain OPEN, rest narrowed

- Explain scope: OPEN — awaiting the owner's call (do NOT decide
  this). The candidate split — Explain CLAIMED on drilldown /
  comparison / sweep views, with map selection / saved view /
  similarity as stretch (only after winning-set Explain is green) —
  is NOT decided. Settled count (plan §6.2.3, verified): the six
  view classes are drilldown, comparison, sweep, map selection,
  saved view, similarity; affordability composite is a separate
  surface, not a class, and is not part of this claim decision.
- Winning set: C05 / C07 / C08 / C01; C04 trust beat; C09 reserve.
  Lead-story order between C05 and C08 is OPEN (two-model
  disagreement, Round 3), decided at S12 from footage — not by another
  poll. Beat 1 cold open (C07 keyless) is fixed.
- No SAM, no Muse Image, no Glimmer anywhere. Tooling argued at the
  layer level (Spark runtime + agent onboarding + Wonder offline eval
  + validator), never per use case.
- One story: "Ask in plain words. Get cited figures, honest
  uncertainty, and a pack you can take to a meeting."

## Conformity pointers (verbatim texts live elsewhere — not paraphrased here)

Portal text, README, video captions, and privacy text will place
verbatim texts at S11/S12: eligibility paragraph, built-during vs
pre-existing breakdown, revised privacy sentence, ownership + license
paragraph, video credits rule, C05/C10 narration lines (tracking
brief §§14–16 / conformity + Round 3 reports). S11/S12 checklist
additions from Round 3: a STATED post-generation check for partisan
framing in the briefing-pack path + an explicit MOE-retention
restatement for C07; an enumerated list of which features cannot
slot-minimise (replacing the "wherever the feature allows" qualifier).
Contributor-mode confirmation before submission is the entire margin
on the (h) boundary pass — confirm the actual mode against session
settings, never ship it unconfirmed.

## Open items carried (not resolved by this seed)

OR-1: organizer DM unanswered (safe posture default; contingency =
narrow to the Muse layer, never a rebuild). PR #32 on HOLD — do not
merge (owner decision Oct 26; may serve as the example for phase 0
prep for integration, separate workstream). Spend-limit notification
UNCONFIRMED (open owner action). Team ID CONFIRMED on the credit
claim: REDACTED (confirmed in tracking thread) (closed). Round 3
in flight at seed time folds into S11/S12 text only and does not block
build. Issue #31 lane skim is not a build blocker.
