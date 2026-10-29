#!/usr/bin/env node
/**
 * Live-tier eval runner (credit-budgeted, plan section 6.3 tier 3).
 *
 * Refuses rather than skipping quietly when MUSE_API_KEY is absent: a silent
 * skip here would let the submission claim a live score it never measured. The
 * recorded result is the console line printed by src/live/muse-eval.test.ts;
 * copy it into docs/muse-layer-eval.md with the date and model.
 */
import { spawnSync } from 'node:child_process'

if (!process.env.MUSE_API_KEY) {
  console.error(
    'MUSE_API_KEY is not set. The live tier cannot run, so it is reported as NOT RUN. ' +
      'Do not write a live score into any document without this run.',
  )
  process.exit(2)
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', '--config', 'vitest.live.config.ts', 'src/live/muse-eval.test.ts'],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
