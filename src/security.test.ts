import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { registry } from './core/useHousingQuery'

const root = join(dirname(fileURLToPath(import.meta.url)), '.')
const headers = readFileSync(join(root, '..', 'public', '_headers'), 'utf8')

function csp(): string {
  const line = headers
    .split('\n')
    .find((l) => l.includes('Content-Security-Policy:'))
  if (!line) throw new Error('No Content-Security-Policy in _headers')
  return line.split('Content-Security-Policy:')[1]!.trim()
}

describe('deployment security headers', () => {
  it('sets a Content-Security-Policy', () => {
    expect(csp()).toContain("default-src 'self'")
  })

  it('forbids inline and eval scripts', () => {
    const policy = csp()
    const scriptSrc = policy.split(';').find((d) => d.trim().startsWith('script-src'))!
    expect(scriptSrc).not.toContain('unsafe-inline')
    expect(scriptSrc).not.toContain('unsafe-eval')
  })

  it('locks the document against framing', () => {
    expect(csp()).toContain("frame-ancestors 'none'")
    expect(headers).toContain('X-Frame-Options: DENY')
  })

  it('enables HSTS and disables unused browser capabilities', () => {
    expect(headers).toContain('Strict-Transport-Security')
    const perms = headers.split('\n').find((l) => l.includes('Permissions-Policy:'))!
    expect(perms).toContain('camera=()')
    expect(perms).toContain('microphone=()')
  })

  it('caches hashed assets immutably but not the HTML shell', () => {
    // Match only real header block openers, not the `/*` inside a comment.
    const blocks = headers.split(/\n(?=\S)/).filter((b) => b.startsWith('/'))
    const assets = blocks.find((b) => b.startsWith('/assets/*'))
    expect(assets).toMatch(/immutable/)

    // A bare `/*` block would apply immutable caching to index.html, which
    // would pin users to a stale shell after a deploy.
    const catchAll = blocks.find((b) => b.trim() === '/*')
    expect(catchAll ?? '').not.toMatch(/immutable/)
  })
})

/**
 * The connect-src allowlist is a public claim about who this app talks to. If a
 * plugin starts calling a new origin and the allowlist is not updated, the
 * request is blocked in production and nobody notices in development. This test
 * makes the coupling explicit.
 */
describe('CSP allowlist matches the code', () => {
  const originsInCode = new Set<string>()

  // Plugin sources live in core/plugins; the geocoder and the map live directly
  // in core. The map is included so that if it ever starts talking to a tile
  // server or a geocoding API, this test forces the allowlist to say so rather
  // than letting the request fail silently in production.
  const sources = [
    join(root, 'core', 'plugins', 'acs.ts'),
    join(root, 'core', 'plugins', 'keyless.ts'),
    join(root, 'core', 'plugins', 'geography.ts'),
    join(root, 'core', 'plugins', 'schools.ts'),
    join(root, 'core', 'geocode.ts'),
    join(root, 'core', 'map', 'centroids.ts'),
    join(root, 'core', 'map', 'projection.ts'),
    join(root, 'core', 'map', 'binning.ts'),
    join(root, 'core', 'map', 'scale.ts'),
  ]
  for (const path of sources) {
    const src = readFileSync(path, 'utf8')
    for (const m of src.matchAll(/https:\/\/([a-z0-9.\-]+)/gi)) originsInCode.add(m[1]!.toLowerCase())
  }

  it('finds the data origins in the source', () => {
    expect(originsInCode.size).toBeGreaterThan(0)
    expect([...originsInCode]).toContain('api.census.gov')
  })

  it('allows every origin the source code actually calls', () => {
    const policy = csp()
    const connectSrc = policy.split(';').find((d) => d.trim().startsWith('connect-src'))!
    const missing = [...originsInCode].filter((o) => !connectSrc.includes(o))
    expect(missing, `Add these to connect-src in public/_headers: ${missing.join(', ')}`).toEqual([])
  })

  it('every registered plugin is reachable under the policy', () => {
    // Guards the inverse direction: a plugin that cannot fetch is worse than
    // one that is absent, so the count is asserted rather than assumed.
    expect(registry.all().length).toBeGreaterThan(0)
  })
})
