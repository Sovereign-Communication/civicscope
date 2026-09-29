/**
 * HTTP layer: request deduplication, quota accounting, and graceful failure.
 *
 * Every request from here originates in the user's browser. That is a product
 * and legal decision, not an accident: a server that sees who searched where
 * can allocate results differently per person, which is precisely the conduct
 * that fair housing enforcement targets. This layer has no backend to call.
 */

/** In-flight requests keyed by URL, so concurrent callers share one fetch. */
const inFlight = new Map<string, Promise<unknown>>()

export interface QuotaState {
  used: number
  lastResetAt: number
}

const quota: QuotaState = { used: 0, lastResetAt: Date.now() }

const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000
const listeners = new Set<(s: QuotaState) => void>()

export function onQuotaChange(fn: (s: QuotaState) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getQuota(): QuotaState {
  maybeResetQuota()
  return { ...quota }
}

function maybeResetQuota(): void {
  if (Date.now() - quota.lastResetAt > QUOTA_WINDOW_MS) {
    quota.used = 0
    quota.lastResetAt = Date.now()
    listeners.forEach((l) => l(quota))
  }
}

function countRequest(): void {
  maybeResetQuota()
  quota.used += 1
  listeners.forEach((l) => l(quota))
}

export class SourceUnavailableError extends Error {
  constructor(
    message: string,
    readonly sourceId: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SourceUnavailableError'
  }
}

export interface GetJsonOptions {
  signal: AbortSignal
  /** Counts against the visible quota meter when true. */
  metered?: boolean
  headers?: Record<string, string>
}

/**
 * Statuses worth retrying.
 *
 * These are answers from an overloaded upstream, not refusals of this request:
 * 429 is the Census API's rate limit, 529 is TypeSafe's overload signal, and
 * 5xx is a server that is briefly unavailable. A 400 means the request itself
 * is wrong and retrying it would just repeat the mistake, so it is never
 * retried.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetches with bounded retries on transport errors and overload statuses.
 *
 * Every data source this project uses is a public service, and all of them
 * return 503 under load. Without this, a release gate fails on the network
 * rather than on the work, which trains people to ignore the gate. Retrying a
 * 429/503 is correct behaviour for a client, not a workaround.
 */
export async function fetchResilient(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<Response> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, init)
      if (!RETRYABLE_STATUS.has(res.status) || i === attempts) return res
      // Honour Retry-After when the service supplies it.
      const wait = Number(res.headers.get('retry-after') ?? 0) * 1000
      await sleep(wait > 0 ? Math.min(wait, 8000) : 1200 * i)
    } catch (err) {
      lastErr = err
      if (i === attempts) throw err
      await sleep(1200 * i)
    }
  }
  throw lastErr
}

export async function getJson<T>(url: string, opts: GetJsonOptions): Promise<T> {
  const existing = inFlight.get(url)
  if (existing) return existing as Promise<T>

  const p = (async (): Promise<T> => {
    if (opts.metered) countRequest()
    const res = await fetchResilient(url, {
      signal: opts.signal,
      headers: { Accept: 'application/json', ...opts.headers },
    })
    if (!res.ok) {
      throw new SourceUnavailableError(`Request failed (${res.status})`, url, res.status)
    }
    return (await res.json()) as T
  })()

  inFlight.set(url, p)
  try {
    return await p
  } finally {
    inFlight.delete(url)
  }
}
