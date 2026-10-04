/**
 * A warm cache must cost nothing.
 *
 * This is the assertion that should have existed from the start and did not:
 * everything known about caching in this project had been established by hand,
 * in a browser, by someone watching a network panel. Nothing in the suite
 * enforced it, so a regression would have shipped silently.
 *
 * The test is cheap because it never lets the sweep run. It seeds a COMPLETE
 * current-version cache — every chunk, built from the same baked ZCTA list the
 * app uses — and then loads the app once. With everything already cached there
 * is nothing left to fetch, so the whole thing finishes in seconds instead of
 * the minutes a cold sweep takes. That matters: an earlier version of this
 * check let the sweep run and then reloaded to observe it, which is why cache
 * behaviour took so long to pin down and went unverified for hours.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, it } from 'vitest'

import { CHUNK_SIZE } from '../core/sweep/chunk'
import { decodeCentroids } from '../core/map/centroids'
import { SWEEP_VERSION } from '../core/sweep/runSweep'
import { ENUM_CACHE_KEY } from '../core/sweep/chunk'

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'

/**
 * Seeds every chunk of the country at the current version.
 *
 * The chunk keys are derived from the real national ZCTA list rather than
 * invented, because a key the app never asks for would prove nothing.
 */
async function seedCompleteCache(page: import('playwright').Page): Promise<number> {
  const bin = join(__dirname, '..', '..', 'public', 'map', 'zcta-centroids.bin')
  const buf = readFileSync(bin)
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  const zctas = decodeCentroids(arrayBuffer)
    .map((p) => p.zcta)
    .sort()

  const keys: string[] = []
  for (let i = 0; i < zctas.length; i += CHUNK_SIZE) {
    const part = zctas.slice(i, i + CHUNK_SIZE)
    keys.push(`zcta:${part[0]}-${part[part.length - 1]}:n${part.length}`)
  }

  await page.evaluate(
    ({ keys: k, version, zctas: all, enumKey }) =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('civicscope-cache', 2)
        open.onupgradeneeded = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('sweep-chunks')) {
            db.createObjectStore('sweep-chunks', { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains('sweep-manifest')) {
            db.createObjectStore('sweep-manifest', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('responses')) {
            db.createObjectStore('responses', { keyPath: 'url' })
          }
        }
        open.onerror = () => resolve(-1)
        open.onsuccess = () => {
          const db = open.result
          const t = db.transaction('sweep-chunks', 'readwrite')
          const st = t.objectStore('sweep-chunks')
          st.clear()
          k.forEach((key, idx) => {
            st.put({
              // The stored key carries the version, so one chunk can hold
              // several and a stamp bump no longer discards the cache.
              key: `${key}@${version}`,
              version,
              body: [
                {
                  zcta: '00001',
                  name: 'Seeded fixture, not real data',
                  metrics: { median_home_value: 100000, median_household_income: 50000 },
                  moes: {},
                },
              ],
              fetchedAt: Date.now() - (idx + 1) * 1000,
            })
          })
          // The national ZIP list is cached separately, in the response store,
          // because it is the partition the sweep is built from and so cannot
          // depend on the cache the sweep is about to fill. Without it seeded,
          // a fully warm load still re-reads the list, which is what this test
          // caught the first time it ran.
          try {
            const rt = db.transaction('responses', 'readwrite')
            const rs = rt.objectStore('responses')
            rs.put({ url: enumKey, body: all, fetchedAt: Date.now() })
          } catch {
            /* the assertion below reports it */
          }
          t.oncomplete = () => resolve(k.length)
          t.onerror = () => resolve(-1)
        }
      }),
    { keys, version: SWEEP_VERSION, zctas, enumKey: ENUM_CACHE_KEY },
  )
  return keys.length
}

// Only runs where the application is actually being served with a browser
// available. The unit job has neither, and running it there would fail on a
// missing server rather than on anything about caching.
const SERVED = Boolean(process.env.E2E_BASE_URL)

describe.skipIf(!SERVED)('a warm cache costs nothing', () => {
  it('loads the whole country without spending a single request', async () => {
    if (!existsSync(join(__dirname, '..', '..', 'public', 'map', 'zcta-centroids.bin'))) {
      // The baked map is the source of the real ZCTA list; without it there is
      // nothing meaningful to seed.
      throw new Error('public/map/zcta-centroids.bin is missing; run npm run gen:map')
    }

    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      const census: string[] = []
      const tiger: string[] = []
      page.on('request', (r) => {
        const u = r.url()
        if (u.includes('api.census.gov')) census.push(u)
        else if (u.includes('tigerweb.geo.census.gov')) tiger.push(u)
      })

      await page.goto(BASE, { waitUntil: 'domcontentloaded' })
      const seeded = await seedCompleteCache(page)
      expect(seeded, 'the fixture did not seed').toBeGreaterThan(40)

      census.length = 0
      tiger.length = 0

      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.evaluate((k) => localStorage.setItem('civicscope.censusKey.v1', k), process.env.CENSUS_KEY ?? '')
      await page.reload({ waitUntil: 'domcontentloaded' })

      // The sweep resolves from cache, so this arrives quickly. The generous
      // ceiling is only here so a failure reports "no data" rather than a
      // timeout: if anything is going to be fetched, it will not be subtle.
      let loaded = ''
      // Generous on time, because the sweep resolves from cache in seconds but
      // a sibling suite may be running a full cold sweep on the same machine.
      // The assertion that matters is the request count below, not the clock.
      for (let i = 0; i < 90; i++) {
        await page.waitForTimeout(1000)
        loaded = await page.locator('body').innerText()
        if (/Loaded [\d,]+ ZIP codes/.test(loaded)) break
      }

      expect(loaded, 'the country did not load from the cache').toMatch(/Loaded [\d,]+ ZIP codes/)
      // A moment for any straggler to arrive, so a late request is still seen.
      await page.waitForTimeout(3000)

      expect(
        census.length,
        `a fully cached load spent ${census.length} Census request(s): ${census.slice(0, 3).join(' | ')}`,
      ).toBe(0)
      // The ZCTA enumeration is cached too, so it must not be re-read either.
      expect(
        tiger.length,
        `a fully cached load re-read the national ZIP list (${tiger.length} request(s))`,
      ).toBe(0)
    } finally {
      await browser.close()
    }
  }, 600000)
})