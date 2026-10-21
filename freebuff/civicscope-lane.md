## Launch config

- **Backend:** Freebuff tokens
- **Model:** 6.1 Sol (GPT-6 Luna fallback)
- If this tab is running on a different backend/model, note it in your first status report.

# CivicScope — Lane (paste-ready mission prompt)

**Repo:** Sovereign-Communication/civicscope. **Scope: CivicScope ONLY.** Cross-repo matters go to main chat, never this lane.

## Context

Meta Global AI Developer Hackathon, Indie track. Build window: Oct 26 – Nov 4, 2026. Product: civicscope.pages.dev — no backend, no logging; user API keys in localStorage only. Core rule: AI never originates a figure. Full plan: `~/workspace/goals/civicscope-meta-global-ai-developer-hackathon/files/full-muse-layer-plan.md`. Execution prompt: `.../files/wip-lane-execution-prompt.md`.

## Current state (verified 2026-10-21 ~12:00 HST)

- Repo clean: 0 open PRs. #30 (full Muse layer plan) merged.
- D1–D8 owner decisions: all still open, BUT the execution prompt instructs you to **proceed on plan defaults — do not stall waiting for Lucas**. (D1 hybrid, D2 BYO-after-credits, D3 agent onboarding official path, D4 strict explain-vs-recommend, D5 per plan, D6 committed full briefing pack, D7/D8 per plan.)

## Work

**Before Oct 26 (credits arrive): credit-free work only** — architecture, intent schema, validator, eval corpus, manual wizard, agent workflow docs (per execution prompt §4).

**Build sequence S2–S12** in dependency order once credits land: F0 key architecture (proxy + BYO + secret scan + CSP) → F4 validator + fair-housing gates → F1 registry intent layer → … One PR per component, **serial one-at-a-time merging** — this lane is deliberately single-threaded; do not parallelize inside it.

## Escalation

Escalate to Lucas only for genuine end-state gaps or authorization needs (spend beyond caps, keys, anything destructive). Everything else you decide yourself.

## Standing rules

Jev gate policy v1 (`~/workspace/jev-gate-policy-v1.md`): below-bar → auto-investigate, escalate only on actual risk. Never ask Lucas technical questions — ramifications and end-state only.
