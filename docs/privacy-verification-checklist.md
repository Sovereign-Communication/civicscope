# Privacy text verification checklist

Date: 2026-10-30. Issue: #63. Plan criterion: 6.2.1, "shipped privacy text
verified line-by-line against the shipped proxy deployment config as a gate
checklist item".

**Status: NOT SIGNED OFF.** The only privacy text in the repository is
[docs/privacy-workbench.md](privacy-workbench.md), whose own header says
"WORKBENCH COPY - NOT FINAL". It has not been changed by this pass. This
checklist checks that DRAFT against the code and deployment as they exist, so
the owner can see exactly what a final text would have to say.

A final text cannot be called verified until the owner signs it, because the
text is owner-reserved. What is recorded here is the evidence a sign-off would
need, plus one line the shipped code does not support.

## Configuration inspected

| Item | Observed | How |
| --- | --- | --- |
| Server-side routes | `functions/api/muse/{intent,explain,transcribe,diagnostics}.ts` | repository |
| Storage bindings | None declared. No `wrangler.toml` / `wrangler.jsonc`; Pages Functions are built from `functions/` | repository |
| Durable Object / D1 / R2 / KV use | None in `functions/`, `src/server/`, or `src/core/ai/` | `grep` over those trees |
| Meter implementation | `Meter` class with per-instance Maps for totals, error counts, per-client spend, reservations | `src/core/ai/meter.ts` |
| Meter persistence | Per isolate. The diagnostics route reports `meterPersistence: "isolate"`; totals reset on a cold start | `functions/api/muse/diagnostics.ts` |
| Secrets in Pages | Zero in both production and preview, measured 2026-10-30 | `wrangler pages secret list`, recorded on #55/#56 |
| CSP / permissions | `connect-src` includes `https://api.meta.ai`; `microphone=()` | `public/_headers` |
| Logging | No `console.*` calls in `functions/` or `src/server/` | `grep` |

## Line-by-line check of the DRAFT text

| # | DRAFT claim | Observed | Status |
| --- | --- | --- | --- |
| 1 | "Metering uses one Durable Object that keeps an aggregate counter." | There is no Durable Object class or binding. The counter is an in-process `Meter`; totals are per isolate and reset on cold start. | **FAIL** |
| 2 | "It counts only requests, tokens, spend, and error classes in total." | `MeterSnapshot` holds `requests`, `tokensIn`, `tokensOut`, `spentMicroUsd`, `budgetExhausted`, `errors`. No content fields. | PASS (within the isolate) |
| 3 | "It never stores searches, keys, query text, IP addresses, or content. There is no per-search or per-person record in this store." | The meter stores no content. The proxy does not log request bodies. No storage binding exists. Per-client spend is keyed by an opaque client id, not a person. | PASS for the meter and store |
| 4 | "A hard budget shutoff is kept ... further shared-allowance calls stop." | `reserve()` returns null when committed spend plus outstanding reservations would exceed the cap; the route answers 429 `budget_exhausted`. | PASS |
| 5 | "Any per-client cap is set at meter config; this copy states no cap value." | `perClientCapMicroUsd` is optional and env-wired only when `MUSE_PER_CLIENT_CAP_MICRO_USD` is set. It is unset (S10); the diagnostics surface reports only whether it is configured. | PASS |
| 6 | "The browser sends structured slots to the proxy ... not raw query text ... wherever the feature allows." | Explain sends the displayed figure set only. Ask sends `queryText` because intent parsing cannot work from slots alone, and the app shows `RAW_TEXT_DISCLOSURE` before the input, which states that this path cannot be answered from structured choices alone. | PASS with the stated qualifier |
| 7 | "A standing disclosure accompanies model wording." | `DISCLOSURE_TEXT` renders in `AskPanel` and `ExplainBox`. | PASS |
| 8 | "If a visitor chooses to supply a key, it is stored only in that visitor's browser localStorage ... sent only to the Meta origin ... not stored on the server." | The client stores it under `civicscope.metaKey.v1` and sends it only to `https://api.meta.ai`; no server route accepts or stores a visitor key. **But `ByoSettings` is not mounted**, so a visitor cannot exercise this path in the shipped build. | **PARTIAL / UNREACHABLE** |
| 9 | "There is no tracking, no analytics, and no search logging." | No analytics dependency or script. No request-body logging. Diagnostics counts are local and exported only by the visitor. | PASS |
| 10 | "The product is English-only at launch." | `IntentRequest.locale` is `'en'`; no translation layer or non-English corpus. | PASS |

## What must change before the text can be final

1. **Owner sign-off.** The final text must be approved and then re-checked
   against the deployed config, not against this draft. That decision is
   owner-reserved and is not made here.
2. **Claim 1 must be corrected or the code changed.** Either the final text
   describes the meter as per-serving-instance totals that reset, or the layer
   gains durable storage. Both are product decisions; this checklist records the
   mismatch rather than choosing.
3. **Claim 8 must be made true or removed.** Either mount the BYO settings
   surface (a product/UI decision) or stop implying a visitor key path is
   available. The copy currently says "if a visitor chooses to supply a key",
   which is vacuous while no surface exists.
4. **Per-client cap value (S10).** The text correctly states no value. The
   operator decision remains open; the code does not invent one.

## What this checklist does not prove

- It does not verify a final text, because no final text exists.
- It does not verify production, because production serves `main` without the
  layer; the inspected deployment is the `submission` preview.
- It does not prove the absence of all logging in Cloudflare's own platform
  telemetry. It checks this repository's code and configuration; platform-level
  retention is outside what the repo can assert.
