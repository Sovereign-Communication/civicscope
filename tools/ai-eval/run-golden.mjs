#!/usr/bin/env node
/**
 * Golden-corpus runner (hermetic).
 *
 * The scoring lives in tests/ai/golden-eval.test.ts so there is one
 * implementation; this script is the entry point the plan names, and passes the
 * real exit status through unchanged. A green run proves the corpus is
 * schema-valid, that every supported metric x mode x geography combination has
 * a fixture, and that every invented-numeral Explain fixture is withheld. It
 * does not prove model accuracy: the replay provider returns the recorded
 * expectation. Use run-live.mjs for that.
 */
import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'tests/ai/golden-eval.test.ts'],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
