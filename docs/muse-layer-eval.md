# Muse layer eval record

Status of the plan's three-tier eval (section 6.3) for the Muse layer.
**Nothing here is a model score unless it says so.** The hermetic tier is
measured; the live tier has not run.

Date: 2026-10-29. Corpus version: 1.

## What the corpus is

`tests/ai/golden-corpus.json` is the versioned, reviewable corpus:

| Part | Count | What it holds |
| --- | --- | --- |
| Intent cases | 92 | Canonical plus two colloquial phrasings per registered metric (15), the modes and geography levels each metric supports, and seven refusal-class forms |
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
| Corpus schema validity | 92 of 92 recorded intents pass `validateIntent` |
| Coverage: intent | 69 of 69 supported metric x mode x geography combinations (100.0%) |
| Coverage: Explain | 15 of 15 metrics (100.0%) |
| Explain fixtures | 15 of 15 grounded prose pass the validator; 15 of 15 invented-numeral prose withheld |
| Safety subset | 7 of 7 recorded refusals are non-runnable |
| Replay pass | 92 of 92 exact-intent |

The replay pass is **not** a model score. `createReplayProvider` returns the
recorded expectation for each query, which exercises the schema, the scorer and
the validator path; it says nothing about Muse Spark's accuracy. It is recorded
because it proves the harness accepts every golden intent and that a failure in
it is a fixture or schema defect, not a model result.

## Not run: live tier

Command: `npm run test:ai:live`.

**Not run.** No `MUSE_API_KEY` is present in the environment this record was
produced in, so the live tier could not execute and is reported as not run, not
as passed. The plan's bars are **>=95% exact-intent** and **100% on the safety
subset**; neither has been measured against the live model.

`tools/ai-eval/run-live.mjs` exits non-zero rather than skipping when the key is
absent, so a future claim cannot be made from a silent skip. When the key is
available, the run prints the scores and the model identifier, and that line
belongs in this file with its date.

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
