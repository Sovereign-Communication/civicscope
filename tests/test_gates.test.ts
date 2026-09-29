/**
 * Named hermetic gate tests for the CIVICSCOPE-COMPLETION phase.
 *
 * These are the tests the JEV-COMPLETION contract's `gate_tests` axis asks for:
 * named, present, and passing. They are hermetic — no network, no credentials,
 * no browser — because the invariants they protect are exactly the ones that
 * silently break, and a test that needs a network to run is a test that stops
 * being run.
 *
 * Each of the assertions below corresponds to a real defect found during
 * development, which is why they exist at all.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** Strips comments so a gate cannot match an identifier that only appears in prose. */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('gate: ACS request construction', () => {
  const acs = codeOnly(read('src/core/plugins/acs.ts'))

  it('never quotes a ZCTA value in a geography list', () => {
    // A quoted ZCTA list returns HTTP 400 from the Census API. Verified live:
    // for=zip code tabulation area:'78701','78702' -> 400, while the unquoted
    // form returns rows. A chunker that quotes produces an empty screen.
    expect(acs).not.toMatch(/ZCTA5\s*=\s*'\$\{/)
    expect(acs).not.toMatch(/'\$\{zcta\}'/g)
  })

  it('builds ZCTA lists without surrounding quotes', () => {
    // The chunker must join bare five-digit codes.
    expect(acs).toMatch(/join\(','\)|join\(\s*','\s*\)/)
  })

  it('never requests more than the safe chunk size in one request', () => {
    // Measured live against real ZIP lists, the API's limit is on the length of
    // the encoded geography string, not the row count: 900 ZCTAs at 7,342
    // characters returns 200, 950 at 7,742 returns 500, 1,000 at 8,142 returns
    // 400. An earlier version assumed a 1,000-geography ceiling, which happened
    // to hold for short numeric ranges and failed for real ZIP lists.
    const chunk = read('src/core/sweep/chunk.ts')
    const size = /CHUNK_SIZE = (\d+)/.exec(chunk)
    expect(size, 'CHUNK_SIZE must be declared in src/core/sweep/chunk.ts').not.toBeNull()
    expect(Number(size![1])).toBeLessThanOrEqual(800)
    expect(chunk).toMatch(/MAX_GEOGRAPHY_CHARS/)
    // The guard must be enforced before the request, not discovered as a 400.
    expect(chunk).toMatch(/geography\.length > MAX_GEOGRAPHY_CHARS/)
  })

  it('refuses a monolithic country-wide request', () => {
    expect(codeOnly(read('src/core/plugins/acs.ts'))).not.toMatch(/tabulation%20area:\*/)
  })

  it('keeps the country-wide screen to few variables', () => {
    // Measured live: 1 var ~20s, 4 vars ~21-29s, 14 vars ~65s. Latency scales
    // with variable count, so the screen must stay small.
    const block = /const SCREEN_VARS = \[([\s\S]*?)\]/.exec(acs)
    expect(block, 'SCREEN_VARS must exist as a separate small set').not.toBeNull()
    expect((block![1].match(/VARS\./g) ?? []).length).toBeLessThanOrEqual(6)
  })

  it('separates screen variables from detail variables', () => {
    expect(acs).toMatch(/SCREEN_VARS/)
    expect(acs).toMatch(/DETAIL_VARS/)
  })
})

describe('gate: response validation', () => {
  it('validates API responses by shape, not by status code', () => {
    // The Census API answers HTTP 200 with an HTML error page titled
    // 'Invalid Key' or 'Missing Key'. Treating res.ok as success yields an empty
    // screen with no error. This is the single most important reason the app
    // once reported every ZIP as "not a US ZIP".
    const all = ['src/core/http.ts', 'src/core/sweep/chunk.ts'].map(read).join('\n')
    expect(all).toMatch(/trimStart\(\)\.startsWith\('<'\)/)
  })

  it('reports an array-shaped success explicitly', () => {
    // Census returns [header, row, row, ...]. A payload that is not an array of
    // rows is treated as a failure, because the 200-with-HTML case is exactly
    // what a naive check would swallow.
    const all = ['src/core/http.ts', 'src/core/sweep/chunk.ts', 'src/core/plugins/acs.ts'].map(read).join('\n')
    expect(all).toMatch(/Array\.isArray/)
  })
})

describe('gate: geocoding correctness', () => {
  const geo = codeOnly(read('src/core/geocode.ts'))

  it('resolves ZIP codes through the Census ZCTA layer, not a general gazetteer', () => {
    // Photon is a volunteer-run OSM service: a 370-ZIP audit exhausted its
    // budget and it refused connections afterwards, and because limits are
    // per-IP that failure hits every visitor, not just the build machine.
    expect(geo).toMatch(/ZCTA5/)
    expect(geo).toMatch(/tigerweb/)
  })

  it('escapes the apostrophe the Census endpoint requires', () => {
    // encodeURIComponent leaves ' unescaped and this endpoint returns an error
    // body when it sees a literal one.
    expect(geo).toMatch(/replace\(\/'\/g,\s*'%27'\)|%27/)
  })

  it('requests only fields the ZCTA layer actually defines', () => {
    // The layer has no STUSPS field. Requesting a field the layer does not
    // define fails the whole query with HTTP 200 and an error body, which is
    // indistinguishable from a ZIP that does not exist. This was the cause of
    // a total, silent failure.
    expect(geo).not.toMatch(/outFields=[^&`]*STUSPS/)
  })

  it('does not reintroduce a hemisphere-based bounding box for the US', () => {
    // A contiguous-48 box excluded Hawaii, Alaska, Puerto Rico and Guam; a
    // widened box still excluded Guam (13.5N, 144.8E). A bounding box cannot
    // contain a country spanning both hemispheres.
    expect(geo).not.toMatch(/maxLon:\s*-6[0-9]/)
  })
})

describe('gate: fair housing invariants', () => {
  const app = read('src/ui/App.tsx').replace(/\s+/g, ' ')
  const scoring = codeOnly(read('src/core/scoring.ts'))

  it('never places a protected-class metric inside a composite index', () => {
    // This is the most important invariant in the codebase. A unit test can be
    // edited to match the code, so it is asserted here against the source too.
    const ruleKeys = [...scoring.matchAll(/key:\s*'([a-z_]+)'/g)].map((m) => m[1])
    expect(ruleKeys.length).toBeGreaterThan(0)
    const protectedClass = /pct_(white|black|asian|hispanic|indigenous|other)|race|ethnic/
    expect(ruleKeys.filter((k) => protectedClass.test(k))).toEqual([])
  })

  it('renders the Fair Housing notice on any screen showing data', () => {
    // It once rendered only inside the "sweep loaded" branch, so it was
    // invisible to every visitor who had not yet added a key: the people least
    // informed about how to read the figures.
    expect(app).toMatch(/q\.selected\.length > 0 && \(\s*<div className="mt-8">\s*<FairHousingNotice/)
  })

  it('does not gate the Fair Housing notice behind the sweep being loaded', () => {
    expect(app).not.toMatch(/sweepStatus === 'ready' && \(\s*<div className="mt-8">\s*<FairHousingNotice/)
  })

  it('offers a route to file a housing complaint', () => {
    const notice = read('src/ui/FairHousingNotice.tsx')
    expect(notice).toMatch(/hud\.gov/)
    expect(notice).toMatch(/justice\.gov/)
  })
})

describe('gate: data-source table', () => {
  it('every data origin is on the Content-Security-Policy allowlist', () => {
    const headers = read('public/_headers')
    const connectSrc = /connect-src([^;]*)/.exec(headers)?.[1] ?? ''
    const origins = new Set<string>()
    for (const f of [
      'src/core/plugins/acs.ts',
      'src/core/plugins/keyless.ts',
      'src/core/plugins/geography.ts',
      'src/core/plugins/schools.ts',
      'src/core/plugins/ny-schools.ts',
      'src/core/geocode.ts',
    ]) {
      for (const m of read(f).matchAll(/https:\/\/([a-z0-9.\-]+)/gi)) origins.add(m[1].toLowerCase())
    }
    expect(origins.size).toBeGreaterThan(0)
    expect([...origins].filter((o) => !connectSrc.includes(o))).toEqual([])
  })

  it('allows the NY school dataset redirect target', () => {
    // data.ny.gov 308-redirects to data.cityofnewyork.us, and the CSP is
    // checked against the redirected origin, so the browser blocked the
    // request and per-school data silently returned nothing.
    expect(read('public/_headers')).toMatch(/data\.cityofnewyork\.us/)
  })

  it('never declares a Census key placeholder in source', () => {
    for (const f of ['src/core/censusKey.ts', 'src/core/plugins/acs.ts', 'src/core/http.ts']) {
      expect(codeOnly(read(f))).not.toMatch(/[0-9a-f]{40}/)
    }
  })
})

describe('gate: no mocks or placeholder data', () => {
  it('contains no mock, fixture, or fake data in src', () => {
    const files = [
      'src/core/plugins/acs.ts',
      'src/core/plugins/schools.ts',
      'src/core/plugins/ny-schools.ts',
      'src/core/plugins/keyless.ts',
      'src/core/scoring.ts',
      'src/core/useHousingQuery.ts',
    ]
    for (const f of files) {
      const src = read(f)
      expect(src, `${f} must not contain mock data`).not.toMatch(
        /mockData|MOCK_|fixtureData|dummyData|sampleData|FAKE_|hardcodedRent/,
      )
    }
  })

  it('reads the Census key only from user storage or the environment', () => {
    const key = codeOnly(read('src/core/censusKey.ts'))
    expect(key).toMatch(/localStorage/)
    // A key must never be committed, so no hardcoded literal may appear.
    expect(key).not.toMatch(/['"][0-9a-f]{40}['"]/)
  })
})

describe('gate: no hidden blocking on a missing key', () => {
  it('does not abort the whole drilldown when a Census key is absent', () => {
    // The NCES, PLACES, and per-state school sources are all keyless. An
    // early return on the missing key silently discarded every one of them.
    expect(read('src/core/useHousingQuery.ts')).not.toMatch(/if \(!key\) return/)
  })
})
