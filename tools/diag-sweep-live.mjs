/**
 * Drives the real country-wide sweep in a browser: the thing that previously
 * failed. Verifies chunks land progressively and the table fills in.
 * Read-only diagnostic.
 */
import { chromium } from 'playwright'

const b = await chromium.launch()
const c = await b.newContext()
const p = await c.newPage()

const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
p.on('console', (m) => {
  if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 140)}`)
})

await p.goto('https://civicscope.pages.dev', { waitUntil: 'domcontentloaded' })
await p.evaluate((k) => localStorage.setItem('civicscope.censusKey.v1', k), process.env.CENSUS_KEY)
await p.reload({ waitUntil: 'domcontentloaded' })

// Open the state filter and load Texas only: 3 chunks instead of 34.
const choose = p.locator('button:has-text("Choose states")')
if ((await choose.count()) > 0) {
  await choose.first().click()
  await p.waitForTimeout(2500)
  const tx = p.locator('label', { hasText: 'Texas' }).first()
  if ((await tx.count()) > 0) {
    await tx.click()
    const apply = p.locator('button:has-text("Load selected states")')
    if ((await apply.count()) > 0) await apply.first().click()
  }
}

const samples = []
for (let i = 0; i < 26; i++) {
  await p.waitForTimeout(2500)
  const s = await p.evaluate(() => {
    const status = document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? ''
    const rows = document.querySelectorAll('table tbody tr').length
    const heading = document.querySelector('#screen-heading')?.textContent ?? ''
    const sub = document.querySelector('#screen-heading')?.parentElement?.textContent?.slice(0, 90) ?? ''
    return { status: status.slice(0, 70), rows, heading, sub }
  })
  samples.push(`${String(i * 2.5).padStart(4)}s  rows=${String(s.rows).padStart(4)}  ${s.status}`)
  if (s.rows > 0 && /Loaded|areas/.test(s.status) && i > 4) break
}

console.log(samples.join('\n'))
const final = await p.evaluate(() => ({
  rows: document.querySelectorAll('table tbody tr').length,
  status: document.querySelector('[role="status"][aria-live="polite"]')?.textContent?.slice(0, 110),
  zipCells: document.querySelectorAll('table tbody th[scope="row"]').length,
  body: document.body.innerText.slice(0, 400),
}))
console.log('\n--- final ---')
console.log('table rows      :', final.rows)
console.log('zip identifiers :', final.zipCells)
console.log('status          :', final.status)
console.log('\nerrors:', errs.length ? errs.slice(0, 5).join('\n  ') : '(none)')
await b.close()
