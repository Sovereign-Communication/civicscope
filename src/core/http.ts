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

export async function getJson<T>(url: string, opts: GetJsonOptions): Promise<T> {
  const existing = inFlight.get(url)
  if (existing) return existing as Promise<T>

  const p = (async (): Promise<T> => {
    if (opts.metered) countRequest()
    const res = await fetch(url, {
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
