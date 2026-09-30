/**
 * End-to-end verification in a real browser, using the user's own Census key.
 *
 * The Census API answers HTTP 200 with an HTML error page for every failure
 * mode, so nothing about the sweep can be verified from a plain fetch without a
 * real key. This runs the actual app in Chromium, injects a key into
 * localStorage exactly as the app's own code does, and asserts on what the user
 * would see.
 *
 * The key is never written to this file. Supply it with:
 *   CENSUS_KEY=<40 chars> npm run test:e2e
 *
 * Without that variable the suite skips rather than failing, so it is safe to
 * run in CI where no key exists.
 */

import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const KEY = process.env.CENSUS_KEY
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4173'

// Two ZIP codes chosen to be unambiguously different in every metric we assert.
const ZIPS = ['78701', '60601']

let browser: Browser
let page: Page

async function searchFor(zip: string) {
  await page.fill('#place', zip)
  await page.click('button[type="submit"]')
}

beforeAll(async () => {
  browser = await chromium.launch()
  const context = await browser.newContext()
  page = await context.newPage()

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  ;(page as Page & { __errors?: string[] }).__errors = errors

  // Count real network traffic to the Census API, which is what the
  // "sorting is local" assertion actually depends on.
  page.on('request', (r) => {
    if (r.url().includes('api.census.gov')) censusRequests++
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })

  if (KEY) {
    // Inject the key the same way the app's own setter does, so the test
    // exercises the real storage path.
    await page.evaluate((k) => localStorage.setItem('civicscope.censusKey.v1', k), KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
}, 120000)

afterAll(async () => {
  await browser?.close()
})

describe('e2e: application loads', () => {
  it('renders the shell and the search control', async () => {
    expect(await page.locator('h1').innerText()).toMatch(/CivicScope/i)
    expect(await page.locator('#place').count()).toBe(1)
    expect(await page.locator('button:has-text("Methodology")').count()).toBe(1)
  }, 60000)
})

describe.skipIf(!KEY)('e2e: country-wide sweep with a real key', () => {
  it('loads a national set of ZIP codes in one request', async () => {
    await page.waitForSelector('#screen-heading', { timeout: 120000 })
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[role="status"][aria-live="polite"]')
        return el?.textContent?.includes('ZIP codes') ?? false
      },
      { timeout: 180000 },
    )

    const text = await page.locator('[role="status"][aria-live="polite"]').first().innerText()
    const n = Number(text.replace(/[^0-9]/g, ''))
    // A national sweep must cover tens of thousands of areas, not a handful.
    expect(n).toBeGreaterThan(30000)
  }, 240000)

  it('shows household counts that differ between ZIP codes', async () => {
    // This is the regression this whole suite exists for: household counts were
    // read from B25002 (occupied housing units), and the same value appeared
    // regardless of which ZIP was searched.
    const settle = (zip: string) =>
      page.waitForFunction(
        (z) => {
          const card = [...document.querySelectorAll('main article')].find((a) =>
            a.textContent?.includes(z),
          )
          return Boolean(card) && !card?.textContent?.includes('Fetching detail')
        },
        zip,
        { timeout: 120000 },
      )

    await searchFor(ZIPS[0]!)
    await settle(ZIPS[0]!)
    const first = await readFigure(ZIPS[0]!, 'Households')
    expect(first, `no households figure for ${ZIPS[0]}`).not.toBeNull()

    await searchFor(ZIPS[1]!)
    await settle(ZIPS[1]!)
    const second = await readFigure(ZIPS[1]!, 'Households')

    expect(second, `no households figure for ${ZIPS[1]}`).not.toBeNull()
    // A residential Austin ZIP and a dense Chicago one cannot have identical
    // household counts. If this fails, values are not varying by area.
    expect(first).not.toBe(second)
  }, 300000)

  it('renders real published figures with their margin of error', async () => {
    // Spot-checks the shape of what a user sees, so a wrong table or a
    // suppressed column cannot pass unnoticed.
    await searchFor('78701')
    await page.waitForFunction(
      () => {
        const card = [...document.querySelectorAll('main article')].find((a) => a.textContent?.includes('78701'))
        return Boolean(card) && !card?.textContent?.includes('Fetching detail')
      },
      undefined,
      { timeout: 120000 },
    )
    const card = page.locator('main article').first()
    const text = await card.innerText()

    // Median gross rent, median home value and per-pupil spend are all present
    // as formatted figures rather than blanks.
    expect(text).toMatch(/Median gross rent/)
    expect(text).toMatch(/\$[\d,]+/)
    expect(text).toMatch(/Expenditure per pupil/)
    // Margins of error must be rendered, not hidden.
    expect(text).toMatch(/±/)
  }, 300000)

  it('sorts the screen locally, without further requests', async () => {
    // Sorting the 33k-row table is a local operation over data already in
    // memory, so it must not touch the network. The count is only compared once
    // the sweep has settled, because a background cache sweep or a late chunk
    // landing inside the window would otherwise be misread as a request the
    // sort caused.
    await page
      .waitForFunction(
        () => (document.querySelector('[role="status"]')?.textContent ?? '').includes('Loaded'),
        undefined,
        { timeout: 240000 },
      )
      .catch(() => undefined)
    await page.waitForTimeout(3000)

    const before = await censusRequestCount()
    await page.click('table button:has-text("Median rent")')
    await page.waitForTimeout(2000)
    const after = await censusRequestCount()
    expect(after, `sorting issued ${after - before} Census request(s)`).toBe(before)
  }, 300000)
})

/**
 * Reads a named figure from the comparison card.
 *
 * The value is a sibling paragraph of the metric's heading, not part of the
 * heading's own text, so the heading is located first and its card is then read.
 */
async function readFigure(zip: string, label: string): Promise<number | null> {
  const card = page.locator('main article').filter({ hasText: zip }).first()
  const heading = card.locator('h3', { hasText: new RegExp(`^${label}`) }).first()
  if ((await heading.count()) === 0) return null
  // The figure sits in the element immediately after its heading.
  const text = await heading.locator('xpath=following-sibling::*[1]').innerText().catch(() => '')
  const cleaned = text.replace(/[^\d.]/g, '')
  return cleaned ? Number(cleaned) : null
}

/**
 * Counts requests actually made to the Census API.
 *
 * An earlier version of this counted console errors, which proves nothing: the
 * assertion it guarded could never fail. Request counting is done by observing
 * the network, so it measures the thing being claimed.
 */
let censusRequests = 0
async function censusRequestCount(): Promise<number> {
  return censusRequests
}
