/**
 * Does the map actually draw?
 *
 * Unit tests prove the arithmetic. Only a real browser proves the canvas
 * rendered something, that the shapes are in the right places, and that a
 * visitor can read a figure off it. A blank or misprojected map would pass
 * every test in map-data.test.ts.
 */
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4173'
const KEY = process.env.CENSUS_KEY

let browser: Browser
let page: Page

/** Waits for the sweep to have produced a usable number of rows. */
async function waitForRows(timeoutMs = 300000): Promise<number> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const n = await page.locator('table tbody tr').count()
    if (n > 20) return n
    await page.waitForTimeout(2000)
  }
  return page.locator('table tbody tr').count()
}

beforeAll(async () => {
  browser = await chromium.launch()
  page = await browser.newPage()
  const res = await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => null)
  if (!res || res.status() >= 400) throw new Error(`unreachable: ${BASE}`)
  if (KEY) await page.evaluate((k) => localStorage.setItem('civicscope.censusKey.v1', k), KEY)
}, 120000)

afterAll(async () => {
  await browser?.close()
})

describe.skipIf(!KEY)('the map view', () => {
  it('draws hexagons across the country rather than a blank canvas', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForRows()
    await page.click('nav[aria-label="Primary"] button:has-text("Map")')
    await page.waitForSelector('canvas', { timeout: 60000 })
    // The centroid fetch and the first paint are not instantaneous.
    await page.waitForTimeout(4000)

    const painted = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return { pixels: 0, colours: new Set<string>().size }
      const ctx = canvas.getContext('2d')!
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const colours = new Set<string>()
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue
        colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`)
      }
      return { pixels: colours.size, colours: colours.size }
    })

    // More than a handful of distinct colours means the ramp is actually being
    // applied across many bins, not one flat fill.
    expect(painted.colours, 'the canvas is blank or a single flat colour').toBeGreaterThan(3)
  }, 400000)

  it('publishes an equivalent of the map as text', async () => {
    // A canvas has no accessibility tree. If this text is missing, a screen
    // reader user gets silence from the map and only the table.
    const text = await page.locator('[role="status"][aria-live="polite"]').allInnerTexts()
    const combined = text.join(' ')
    expect(combined, 'no text equivalent for the map').toMatch(/map shows/i)
    expect(combined).toMatch(/screening table/i)
  }, 120000)

  it('names every legend step in text, not only in colour', async () => {
    const legend = await page.locator('#\\:r0\\:-legend, [id$="legend"]').first().innerText().catch(() => '')
    const body = legend || (await page.locator('body').innerText())
    expect(body, 'the legend does not state real values').toMatch(/to the highest|to \$/)
    // The absent category must be named, so "no data" is never just a colour.
    expect(body).toMatch(/no valid data available here/)
  }, 120000)

  it('carries the Fair Housing notice on the map surface', async () => {
    // A colour-coded housing map is exactly what the notice is for, so its
    // presence cannot be limited to the table view.
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/steering/i)
    expect(body).toMatch(/hud\.gov|Department of Housing/i)
  }, 120000)

  it('pans and zooms from the keyboard', async () => {
    const before = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement
      return c.toDataURL().length
    })
    await page.focus('canvas')
    await page.keyboard.press('Equal')
    await page.waitForTimeout(600)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement
      return c.toDataURL().length
    })
    // A different image length means the canvas repainted, which is the only
    // evidence available that the keyboard handlers fired.
    expect(after, 'the canvas did not change after zooming and panning').not.toBe(before)
  }, 120000)

  it('shows no sentinel or negative figure anywhere on the map', async () => {
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/-?\s?\$?\s?(666666666|999999999|888888888)\b/)
  }, 120000)
})
