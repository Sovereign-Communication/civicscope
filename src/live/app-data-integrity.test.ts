/**
 * What the app holds, against what the publisher says — on every CI run.
 *
 * The full audit in `tools/audit-all-data.mjs` compares all 33,772 areas and
 * finds zero defects, but it takes long enough that it is a release check
 * rather than a per-commit one. This is the version CI runs.
 *
 * The distinction that matters: a semantic review cannot catch a wrong number.
 * Nothing an LLM reads can tell whether 271,000 is the right median home value
 * or the wrong column. What catches it is comparing the figure against the
 * source, cell by cell, which is what this does.
 *
 * The sample is taken by taking every Nth ZCTA from the real national list, so
 * it is spread across the whole country rather than clustered at the
 * low-numbered end. A mis-mapped variable, a leaked sentinel, a percentage
 * parsed as a currency, a swapped column — every one of those is systematic and
 * shows up immediately at this sample size. A single wrong row would not, and
 * that is what the full audit is for.
 */
import { chromium } from 'playwright'
import { describe, expect, it } from 'vitest'

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'
const KEY = process.env.CENSUS_KEY

/**
 * The five columns the nationwide screen fetches. Must equal SCREEN_VARS in
 * src/core/plugins/acs.ts, and the gate checks that it does.
 *
 * Deliberately does not include tenure. It is a drilldown-only figure, and an
 * audit that compared it would report a defect for every row of the country for
 * a column the app never claimed to fetch.
 */
const COLUMNS: Record<string, string> = {
  median_gross_rent: 'B25064_001E',
  median_rent_burden_pct: 'B25071_001E',
  median_home_value: 'B25077_001E',
  median_household_income: 'B19013_001E',
  households: 'B25001_001E',
}

const SENTINELS = new Set([666666666, -666666666, 999999999, -999999999, 888888888, -888888888])

/** How many ZCTAs to compare. Two chunks keeps CI honest and affordable. */
const SAMPLE_SIZE = 1600

interface AppRow {
  zcta: string
  metrics: Record<string, number | null>
  moes: Record<string, number | null>
}

async function readAppRows(base: string): Promise<AppRow[]> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.evaluate((k) => localStorage.setItem('civicscope.censusKey.v1', k), KEY!)
    // A fresh sweep, so the comparison is against this build's own output rather
    // than something an earlier build left behind.
    await page.evaluate(() => indexedDB.deleteDatabase('civicscope-cache'))
    await page.reload({ waitUntil: 'domcontentloaded' })

    let loaded = 0
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(5000)
      const text = await page.locator('body').innerText()
      // Completion is announced by this sentence; the "N of 43" progress line is
      // *replaced* when the last chunk lands, so waiting for it never matches.
      const m = /Loaded ([\d,]+) ZIP codes/.exec(text)
      if (m?.[1]) {
        loaded = Number(m[1].replace(/,/g, ''))
        break
      }
    }
    expect(loaded, 'the country-wide sweep did not finish').toBeGreaterThan(33000)

    return await page.evaluate(
      () =>
        new Promise<AppRow[]>((resolve) => {
          const open = indexedDB.open('civicscope-cache', 2)
          open.onerror = () => resolve([])
          open.onsuccess = () => {
            const tx = open.result.transaction('sweep-chunks', 'readonly')
            const all = tx.objectStore('sweep-chunks').getAll()
            all.onerror = () => resolve([])
            all.onsuccess = () => {
              const rows: AppRow[] = []
              for (const rec of all.result ?? []) for (const r of rec.body ?? []) rows.push(r)
              resolve(rows)
            }
          }
        }),
    )
  } finally {
    await browser.close()
  }
}

describe.skipIf(!KEY)('what the app shows is what the Census Bureau says', () => {
  let appRows: AppRow[] = []
  let sample: string[] = []
  let compared = 0
  const defects: string[] = []
  let sentinelValuesMet = 0

  it('sweeps the country in a real browser', async () => {
    appRows = await readAppRows(BASE)
    // The Census Bureau publishes 33,791 ZCTAs; every one of them is on the
    // table, including those with no ACS coverage, which read as absent.
    expect(appRows.length).toBeGreaterThan(33000)
  }, 900000)

  it('agrees with the publisher, cell by cell, across the country', async () => {
    const all = appRows.map((r) => r.zcta).sort()
    const step = Math.max(1, Math.floor(all.length / SAMPLE_SIZE))
    sample = all.filter((_, i) => i % step === 0)
    expect(sample.length).toBeGreaterThan(500)

    const vars = Object.values(COLUMNS).join(',')
    for (let i = 0; i < sample.length; i += 800) {
      const part = sample.slice(i, i + 800)
      const url =
        `https://api.census.gov/data/2023/acs/acs5?get=NAME,${vars}` +
        `&for=${encodeURIComponent(`zip code tabulation area:${part.join(',')}`)}&key=${KEY}`
      let body: unknown
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch(url)
          body = JSON.parse(await res.text())
          break
        } catch {
          if (attempt === 3) throw new Error(`Census did not answer for offset ${i}`)
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        }
      }
      const parsed = body as { error?: unknown } | unknown[]
      expect((parsed as { error?: unknown }).error, `Census returned an error body at offset ${i}`).toBeUndefined()

      const head = (parsed as unknown[])[0] as string[]
      for (const raw of (parsed as unknown[]).slice(1) as unknown[][]) {
        const o = Object.fromEntries(head.map((k, idx) => [k, raw[idx]]))
        const zcta = String(o['zip code tabulation area'] ?? '').padStart(5, '0')
        const app = appRows.find((r) => r.zcta === zcta)
        expect(app, `the app does not hold ${zcta}`).toBeDefined()

        for (const [metric, v] of Object.entries(COLUMNS)) {
          const rawEst = o[v]
          let truth: number | null = null
          if (rawEst !== undefined && rawEst !== null && rawEst !== '') {
            const n = Number(rawEst)
            if (SENTINELS.has(n)) {
              sentinelValuesMet++
              truth = null
            } else if (Number.isFinite(n)) truth = n
          }
          compared++
          const shown = app!.metrics?.[metric] ?? null
          if (truth === null) {
            // A missing-data encoding must never become a figure.
            if (shown !== null) defects.push(`${zcta} ${metric}: app shows ${shown}, API has none`)
            continue
          }
          if (shown === null) {
            defects.push(`${zcta} ${metric}: API has ${truth}, app shows not yet imported`)
            continue
          }
          if (Math.abs(shown - truth) > Math.max(0.01, Math.abs(truth) * 1e-9)) {
            defects.push(`${zcta} ${metric}: app ${shown} vs API ${truth} (from ${v})`)
          }
        }
      }
      await new Promise((r) => setTimeout(r, 500))
    }
  }, 600000)

  it('found no figure the publisher does not agree with', () => {
    // Printed whether or not it passes, because a silent change in `compared`
    // would otherwise make this look like the same coverage it used to be.
    console.log(
      `    compared ${compared} cells across ${sample.length} ZIP codes; met ${sentinelValuesMet} missing-data encodings; ${defects.length} defects`,
    )
    expect(defects.slice(0, 12).join('\n'), 'figures disagree with the publisher').toBe('')
    expect(defects).toHaveLength(0)
    expect(compared).toBeGreaterThan(1000)
  })

  it('never shows a negative figure, which no estimate here can be', () => {
    let negatives = 0
    for (const row of appRows) {
      for (const v of Object.values(row.metrics ?? {})) {
        if (typeof v === 'number' && v < 0) negatives++
      }
    }
    expect(negatives).toBe(0)
  })
})
