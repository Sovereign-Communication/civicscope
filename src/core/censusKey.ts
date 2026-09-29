/**
 * Census API key storage.
 *
 * The key is supplied by the end user, stored only in their browser, and never
 * transmitted to any server we control. That is a deliberate architectural
 * choice: it keeps request IPs distributed across users rather than
 * concentrated on a single operator, and it means we never hold a credential
 * that identifies our users to a government agency.
 *
 * Signup cannot be automated. POST /data/KeySignup returns 405 to GET and
 * sends no CORS headers, so a browser cannot submit that form cross-origin,
 * and the key is delivered by email with no programmatic read endpoint. The
 * flow is therefore designed to be as short as that constraint allows: one
 * click to open the form, one paste to finish.
 */

const STORAGE_KEY = 'civicscope.censusKey.v1'
const RETURN_KEY = 'civicscope.returnPath'

/**
 * Dispatched on `window` when a key is saved or removed, so an open results view
 * can re-run its query. The alternative — polling localStorage — cannot detect
 * the change, and reading the key during render produces a constant value.
 */
export const CENSUS_KEY_EVENT = 'civicscope:census-key'

export const CENSUS_SIGNUP_URL = 'https://api.census.gov/data/key_signup.html'
export const CENSUS_ATTRIBUTION =
  'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'

export function getCensusKey(): string | undefined {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && v.length > 0 ? v : undefined
  } catch {
    return undefined
  }
}

export function setCensusKey(raw: string): void {
  try {
    // Store the extracted token, not the raw paste, so the saved value is
    // exactly what the API will receive.
    const { key } = normalizeCensusKey(raw)
    localStorage.setItem(STORAGE_KEY, key.trim())
  } catch {
    /* storage may be unavailable in private mode; key simply won't persist */
  }
  notifyKeyChanged()
}

export function clearCensusKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  notifyKeyChanged()
}

function notifyKeyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CENSUS_KEY_EVENT))
  }
}

/**
 * Census API keys are 40 hexadecimal characters.
 *
 * Keys are emailed, so what arrives in the paste box is frequently not a bare
 * key: it can carry the surrounding sentence, surrounding quotes, a trailing
 * newline, or a copy-paste artefact. Sending that string verbatim to the API
 * returns "Invalid Key" even though the key itself is perfect, which is
 * indistinguishable from a genuinely wrong key.
 *
 * Extracting the token first makes the app tolerant of the realistic cases
 * while still rejecting a genuinely malformed paste, which is a different
 * problem and gets a different message.
 */
const KEY_PATTERN = /\b[0-9a-fA-F]{40}\b/

export type KeyShape = 'ok' | 'not-found'

export function normalizeCensusKey(raw: string): { key: string; shape: KeyShape } {
  const trimmed = raw.trim()
  const match = KEY_PATTERN.exec(trimmed)
  if (match) return { key: match[0], shape: 'ok' }

  // No 40-char token anywhere. If the input is plausibly a key that was
  // truncated or mistyped, say so specifically rather than claiming the key
  // was rejected.
  if (trimmed.length > 0 && /^[0-9a-fA-F\s]+$/.test(trimmed)) {
    return { key: trimmed.replace(/\s+/g, ''), shape: 'not-found' }
  }
  return { key: trimmed, shape: 'not-found' }
}

/** Diagnostic outcome, so the UI can say what actually went wrong. */
export type KeyValidation =
  | { ok: true }
  | { ok: false; reason: 'malformed'; detail: string }
  | { ok: false; reason: 'rejected'; detail: string }
  | { ok: false; reason: 'network'; detail: string }

/**
 * Validates a key by making one tiny real request.
 *
 * The Census API answers **HTTP 200 with an HTML error page** for a missing,
 * malformed, or invalid key, so `res.ok` is true in every failure case and the
 * response body is the only usable signal. Distinguishing "the network or the
 * browser blocked the request" from "Census rejected the key" is what lets the
 * UI give an honest message instead of always blaming the user's key.
 */
export async function validateCensusKey(rawKey: string, signal: AbortSignal): Promise<KeyValidation> {
  const { key, shape } = normalizeCensusKey(rawKey)

  if (shape === 'not-found') {
    return {
      ok: false,
      reason: 'malformed',
      detail: `We could not find a 40-character key in that text (it looked like ${key.length} characters). Census keys are 40 hexadecimal characters. Copy just the key from the email.`,
    }
  }

  const url = `https://api.census.gov/data/2023/acs/acs5?get=NAME&for=state:06&key=${encodeURIComponent(key)}`

  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, reason: 'network', detail: 'Cancelled.' }
    }
    return {
      ok: false,
      reason: 'network',
      // A CSP violation or offline state surfaces here, and telling the user
      // their key is wrong would be actively misleading in that case.
      detail:
        'The request to the Census API never completed. This is usually a network or connection problem rather than a key problem.',
    }
  }

  if (!res.ok) {
    return { ok: false, reason: 'rejected', detail: `The Census API responded with HTTP ${res.status}.` }
  }

  const text = await res.text()

  if (text.trimStart().startsWith('<')) {
    const title = /<title>([^<]*)<\/title>/i.exec(text)?.[1]?.trim() ?? 'error page'
    if (/invalid key/i.test(title)) {
      return {
        ok: false,
        reason: 'rejected',
        detail:
          'The Census Bureau rejected this key. Keys can take a few minutes to become active after signup — if you only just requested it, wait a little and try again.',
      }
    }
    return { ok: false, reason: 'rejected', detail: `The Census API returned an error page: ${title}.` }
  }

  try {
    const body: unknown = JSON.parse(text)
    if (Array.isArray(body)) return { ok: true }
    return { ok: false, reason: 'rejected', detail: 'The Census API returned an unexpected response shape.' }
  } catch {
    return { ok: false, reason: 'rejected', detail: 'The Census API returned a response we could not read.' }
  }
}

/**
 * Records where to send the user back to after they obtain their key, so
 * returning from the Census tab lands them exactly where they left off.
 */
export function rememberReturnPath(path: string): void {
  try {
    sessionStorage.setItem(RETURN_KEY, path)
  } catch {
    /* ignore */
  }
}

export function consumeReturnPath(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v
  } catch {
    return null
  }
}
