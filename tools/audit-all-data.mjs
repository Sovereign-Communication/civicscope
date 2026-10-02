/**
 * An exhaustive data audit: every figure the app holds, against the publisher.
 *
 * The reason this exists is that a semantic review cannot catch a wrong number.
 * Reading a record, no reviewer can tell whether 271,000 is the right median
 * home value or the wrong column, and the whole session's two real defects were
 * found by comparing figures against the source rather than by being read to.
 *
 * So this is the check that actually answers "is the data perfect":
 *
 *   1. drives the real application in a real browser, lets the genuine sweep
 *      run, and reads every row back out of the IndexedDB cache the app itself
 *      populated;
 *   2. independently re-fetches the same ZIP codes from the Census API in the
 *      same chunk sizes; and
 *   3. compares every figure in every row, cell by cell, with no sampling.
 *
 * Anything the app shows that the publisher does not agree with is a defect,
 * and it is reported with the ZIP code, the column, and both values.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4380'
const KEY = process.env.CENSUS_KEY
const OUT = 'audit'

/**
 * The five columns the nationwide screen actually fetches, which is SCREEN_VARS
 * in src/core/plugins/acs.ts.
 *
 * An earlier version of this audit also compared renter-occupied and
 * owner-occupied units and reported 67,544 defects for them. Those were the
 * audit's error rather than the app's: tenure is deliberately a drilldown-only
 * figure, because the nationwide screen is a cost screen and adding two columns
 * to all 43 requests to carry a figure nobody screens on is the wrong trade. The
 * app showing nothing for a column it never claimed is correct behaviour, and an
 * audit that cannot tell the difference will eventually condemn it.
 */
const COLUMNS = {
  median_gross_rent: { est: 'B25064_001E', moe: 'B25064_001M' },
  median_rent_burden_pct: { est: 'B25071_001E', moe: 'B25071_001M' },
  median_home_value: { est: 'B25077_001E', moe: 'B25077_001M' },
  median_household_income: { est: 'B19013_001E', moe: 'B19013_001M' },
  households: { est: 'B25001_001E', moe: 'B25001_001M' },
}

/** Checked separately, because the app must not claim them and must not have them. */
const NOT_CLAIMED = ['renter_occupied', 'owner_occupied']
const SENTINELS = new Set([666666666, -666666666, 999999999, -999999999, 888888888, -888888888])

if (!KEY) {
  console.error('CENSUS_KEY is required')
  process.exit(1)
}

// ---------------------------------------------------------------- the app
console.log('=== 1. running the real application ===')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate((k) => localStorage.setItem('civicscope.censusKey.v1', k), KEY)
await page.evaluate(() => indexedDB.deleteDatabase('civicscope-cache'))
await page.reload({ waitUntil: 'domcontentloaded' })

// Completion is announced by a different sentence than progress. Once the last
// chunk lands, the "N of 43 areas" line is *replaced* by "Loaded N ZIP codes",
// so waiting for "43 of 43" can never match. That made an earlier run of this
// audit report a stalled sweep on a sweep that had in fact finished.
let loaded = null
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(5000)
  const text = await page.locator('body').innerText()
  const m = text.match(/Loaded ([\d,]+) ZIP codes/)
  if (m) {
    loaded = Number(m[1].replace(/,/g, ''))
    break
  }
  if (i % 4 === 0) {
    const p2 = text.match(/(\d+) of 43 areas/)
    console.log(`    ${p2 ? p2[0] : 'starting'}`)
  }
}
if (loaded === null) {
  console.error('the sweep did not finish')
  await browser.close()
  process.exit(1)
}
console.log(`    sweep complete, ${loaded.toLocaleString('en-US')} ZIP codes\n`)

/** Every row the app itself cached, read straight out of its own store. */
const appRows = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const open = indexedDB.open('civicscope-cache', 2)
      open.onerror = () => resolve([])
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction('sweep-chunks', 'readonly')
        const all = tx.objectStore('sweep-chunks').getAll()
        all.onerror = () => resolve([])
        all.onsuccess = () => {
          const rows = []
          for (const rec of all.result ?? []) {
            for (const row of rec.body ?? []) rows.push(row)
          }
          resolve(rows)
        }
      }
    }),
)
await browser.close()
console.log(`=== 2. the app holds ${appRows.length} rows ===\n`)
if (!appRows.length) {
  console.error('no rows were read from the cache')
  process.exit(1)
}

// ---------------------------------------------------------- the publisher
const byZcta = new Map(appRows.map((r) => [r.zcta, r]))
const zctas = [...byZcta.keys()].sort()
const CHUNK = 800
const VARS = [...new Set(Object.values(COLUMNS).flatMap((c) => [c.est, c.moe].filter(Boolean)))]

console.log(`=== 3. re-fetching ${zctas.length} ZIP codes from Census in ${Math.ceil(zctas.length / CHUNK)} requests ===\n`)

const defects = []
let cellsCompared = 0
let nulls = 0
let sentinels = 0

for (let i = 0; i < zctas.length; i += CHUNK) {
  const part = zctas.slice(i, i + CHUNK)
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=NAME,${VARS.join(',')}` +
    `&for=${encodeURIComponent(`zip code tabulation area:${part.join(',')}`)}&key=${KEY}`

  let body
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url)
      const raw = await res.text()
      body = JSON.parse(raw)
      if (!body.error) break
      defects.push({ kind: 'api', detail: `offset ${i}: ${JSON.stringify(body.error).slice(0, 160)}` })
      body = null
      break
    } catch (err) {
      if (attempt === 3) {
        defects.push({ kind: 'api', detail: `offset ${i}: ${err.message}` })
        body = null
        break
      }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  if (!body) continue

  const head = body[0]
  for (const raw of body.slice(1)) {
    const o = Object.fromEntries(head.map((k, idx) => [k, raw[idx]]))
    const zcta = String(o['zip code tabulation area'] ?? '').padStart(5, '0')
    const app = byZcta.get(zcta)

    if (!app) {
      defects.push({ kind: 'missing-row', zcta, detail: 'the API returned it, the app does not hold it' })
      continue
    }

    for (const unclaimed of NOT_CLAIMED) {
      if (app.metrics && unclaimed in app.metrics && app.metrics[unclaimed] !== undefined) {
        defects.push({
          kind: 'unclaimed-column',
          zcta,
          metric: unclaimed,
          detail: 'the nationwide screen carries a figure it does not claim to fetch',
        })
      }
    }

    for (const [metric, col] of Object.entries(COLUMNS)) {
      const rawEst = o[col.est]
      let truth = null
      if (rawEst !== undefined && rawEst !== null && rawEst !== '') {
        const n = Number(rawEst)
        if (SENTINELS.has(n)) {
          sentinels++
          truth = null
        } else if (Number.isFinite(n)) {
          truth = n
        }
      }

      cellsCompared++
      const shown = app.metrics?.[metric]
      if (truth === null) {
        if (shown !== null && shown !== undefined) {
          nulls++
          defects.push({
            kind: 'phantom-figure',
            zcta,
            metric,
            detail: `app shows ${shown}, the API has no value (sentinel or missing)`,
          })
        }
        continue
      }
      if (shown === null || shown === undefined) {
        nulls++
        defects.push({
          kind: 'dropped-figure',
          zcta,
          metric,
          detail: `the API has ${truth}, the app shows not yet imported`,
        })
        continue
      }
      if (Math.abs(shown - truth) > Math.max(0.01, Math.abs(truth) * 1e-9)) {
        defects.push({
          kind: 'wrong-value',
          zcta,
          metric,
          detail: `app ${shown} vs API ${truth} (from ${col.est})`,
        })
      }
    }
  }
  process.stdout.write(`\r    compared ${Math.min(i + CHUNK, zctas.length)}/${zctas.length} ZIP codes`)
  await new Promise((r) => setTimeout(r, 500))
}
process.stdout.write('\n\n')

// ------------------------------------------------------------------ report
console.log('=== result ===\n')
console.log(`  rows audited:        ${appRows.length}`)
console.log(`  cells compared:      ${cellsCompared}`)
console.log(`  sentinel values met: ${sentinels}`)
console.log(`  defects:             ${defects.length}\n`)

if (defects.length) {
  const byKind = {}
  for (const d of defects) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1
  console.log('  by kind:')
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${n}`)
  }
  console.log('\n  the first 30:')
  for (const d of defects.slice(0, 30)) {
    console.log(`    ${d.zcta ?? '-'} ${d.metric ?? ''} ${d.detail ?? ''}`.trim())
  }
}

mkdirSync(OUT, { recursive: true })
writeFileSync(
  join(OUT, 'data-integrity-report.json'),
  JSON.stringify(
    {
      auditedAt: new Date().toISOString(),
      rows: appRows.length,
      cellsCompared,
      sentinelValuesMet: sentinels,
      defectCount: defects.length,
      defects,
    },
    null,
    2,
  ) + '\n',
)
console.log(`\n  written to ${OUT}/data-integrity-report.json`)
process.exit(defects.length ? 1 : 0)
