/**
 * Reads the local Jev key and verifies it against the live TypeSafe API.
 *
 * The key is read from disk on demand and sent only to api.typesafe.ai. It is
 * never printed in full, never written to a tracked file, and never sent
 * anywhere else.
 */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ENV_FILE = join(homedir(), '.config', 'harness', 'jev.env')

/** Parses a .env file into a record, without executing it. */
function parseEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    // Strip surrounding quotes, and ignore inline comments on unquoted values.
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

export function readJevKey() {
  const env = parseEnv(ENV_FILE)
  return process.env.TYPESAFE_API_KEY ?? env.TYPESAFE_API_KEY ?? env.HARNESS_JEV_KEY ?? undefined
}

/**
 * Confirms the key is accepted. The endpoint answers 401 for a bad key, so this
 * is a real verification rather than a guess.
 */
export async function verifyJevKey(key) {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: 'A narrow smoke test: is this key accepted?',
      model: 'jev-latest',
      questions: { reachable: { type: 'noul', instructions: 'Is this text a test?' } },
    }),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 200) }
  const body = JSON.parse(text)
  return { ok: true, model: body.model, answers: body.answers, usage: body.usage }
}

if (process.argv[1]?.endsWith('jev-key.mjs')) {
  const key = readJevKey()
  if (!key) {
    console.log('No Jev key found.')
    process.exit(1)
  }
  console.log(`key: ${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)`)
  const r = await verifyJevKey(key)
  if (r.ok) {
    console.log(`ACCEPTED. model=${r.model} noul=${JSON.stringify(r.answers?.reachable?.noul)}`)
    console.log(`tokens: ${r.usage?.input_tokens} in / ${r.usage?.output_tokens} out`)
    process.exit(0)
  }
  console.log(`REJECTED: HTTP ${r.status} ${r.detail}`)
  process.exit(1)
}
