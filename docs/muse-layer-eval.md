# Muse layer eval record

Status of the plan's three-tier eval (section 6.3) for the Muse layer.
**Nothing here is a model score unless it says so.** The hermetic tier is
measured; the live tier has not run.

Date: 2026-10-29. Corpus version: 1.

## What the corpus is

`tests/ai/golden-corpus.json` is the versioned, reviewable corpus:

| Part | Count | What it holds |
| --- | --- | --- |
| Intent cases | 91 | 45 lookup phrasings (15 metrics x canonical plus two colloquial), 39 mode cases (30 compare, 4 sweep_filter, 5 similarity), and the 7 refusal-class forms below |
| Safety subset | 7 | Proxy-metric, ranking, injection, out-of-scope, unsupported metric x geography, unresolvable geography, ambiguous geography |
| Explain fixtures | 15 | One per registered metric, each with grounded prose and invented-numeral prose |

The denominator for coverage is the registry itself (15 metrics in
`src/core/civicscope-registry.ts`), crossed with the modes and geography levels
each metric actually supports. Generated report:
`tests/ai/coverage-report.md`.

## Measured, hermetic tier

Command: `npm run test:ai` (runs `tests/ai/golden-eval.test.ts`).

| Check | Result |
| --- | --- |
| Corpus schema validity | 91 of 91 recorded intents pass `validateIntent` |
| Coverage: intent | 69 of 69 supported metric x mode x geography combinations (100.0%) |
| Coverage: Explain | 15 of 15 metrics (100.0%) |
| Explain fixtures | 15 of 15 grounded prose pass the validator; 15 of 15 invented-numeral prose withheld |
| Safety subset | 7 of 7 recorded refusals are non-runnable |
| Replay pass | 91 of 91 exact-intent |

The replay pass is **not** a model score. `createReplayProvider` returns the
recorded expectation for each query, which exercises the schema, the scorer and
the validator path; it says nothing about Muse Spark's accuracy. It is recorded
because it proves the harness accepts every golden intent and that a failure in
it is a fixture or schema defect, not a model result.

## Not run: live tier

Command: `npm run test:ai:live`.

**Not run.** No `MUSE_API_KEY` is present in the environment this record was
produced in, and the deployment has no shared key configured, so the live tier
could not execute and is reported as not run, not as passed. The plan's bars are
**>=95% exact-intent** and **100% on the safety subset**; neither has been
measured against the live model.

`tools/ai-eval/run-live.mjs` exits non-zero rather than skipping when no surface
is configured, so a future claim cannot be made from a silent skip. Two surfaces
can be measured, one per run, and the run prints which one it used:

| Surface | Configure | What it exercises |
| --- | --- | --- |
| `direct` | `MUSE_API_KEY` (+ optional `MUSE_MODEL`, `MUSE_BASE_URL`) | `api.meta.ai` from this machine, `muse-spark-1.3` |
| `proxy` | `MUSE_EVAL_PROXY_BASE=https://<origin>` | the deployment's own `/api/muse/*`, which is the shipped path and spends the shared key |

The proxy surface exists so a key that lives only in the Pages environment is
measurable without being copied to a workstation or printed. A score recorded
from it must name `surface=proxy` and the origin it was measured against.

## Live-path reachability, 2026-10-30 (not a score)

With a deliberately invalid key in a local Pages runtime (`wrangler pages dev`
over the committed build), both routes made a real provider round trip and the
documented error mapping held:

| Check | Result |
| --- | --- |
| `POST /api/muse/intent` with an invalid key | `401 {"error":"bad_key"}` in 0.45 s |
| `POST /api/muse/explain` with an invalid key | `401 {"error":"bad_key"}` in 0.16 s |
| Same invalid key straight to `api.meta.ai` | `401 {"error":{"code":"invalid_api_key","message":"Unauthorized"}}` |
| `POST` with a foreign `Origin` | `403 {"error":"not_allowlisted"}` |

The 401 is evidence of the round trip rather than of a successful completion: a
transport failure maps to `provider_down` (502), so a `bad_key` (401) can only
come from the provider's own response. It does not prove a valid key produces a
schema-valid intent, and no accuracy claim is made from it.

## Deductions and known limits

- The replay tier cannot detect a wrong expectation: it returns what the corpus
  records. Only the live tier can.
- The screening table expresses four filter bounds (rent, rent burden, home
  value, households), so a `sweep_filter` intent on another sortable metric is
  not counted as supported coverage even though the intent schema accepts it.
  The app refuses such a bound with a stated reason instead of running it
  unfiltered.
- Explain coverage is one fixture per metric, not per view class. The six view
  classes are covered by the mounted Explain tests, not by this corpus.
- Geography coverage is sampled: one ZIP per metric, one city pair, one state.
  It is not a claim about every ZIP code, city, or state.
