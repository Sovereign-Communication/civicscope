/**
 * Network resilience for the live contract suite.
 *
 * These tests assert on the shape of responses from five third-party services:
 * Census, TIGERweb, NCES, CDC and NYC Open Data. All of them return 5xx under
 * load, and a release gate that fails on the network rather than on the work
 * trains people to ignore it.
 *
 * The distinction that matters: this retries transport errors and overload
 * statuses. A failed assertion is never retried, so a data-integrity breach
 * still fails immediately and cannot be retried into a pass.
 */

const NETWORK_NOISE = [
  'fetch failed',
  'econnreset',
  'etimedout',
  'enotfound',
  'eai_again',
  'socket hang up',
  'network',
  'timed out',
  'timeout',
  '429',
  '500',
  '502',
  '503',
  '504',
  '529',
  'load',
]

function isNetworkNoise(err: unknown): boolean {
  const text = `${(err as Error)?.message ?? ''} ${(err as Error)?.stack ?? ''}`.toLowerCase()
  return NETWORK_NOISE.some((n) => text.includes(n))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function withNetworkRetry<T>(name: string, body: () => Promise<T>, attempts = 3): () => Promise<T> {
  return async () => {
    let last: unknown
    for (let i = 1; i <= attempts; i++) {
      try {
        return await body()
      } catch (err) {
        last = err
        if (!isNetworkNoise(err)) throw err
        if (i === attempts) {
          throw new Error(
            `${name}: the upstream data source did not answer after ${attempts} attempts. ` +
              `This is a connectivity problem, not a data-integrity failure. Last error: ${(err as Error)?.message}`,
          )
        }
        await sleep(1500 * i)
      }
    }
    throw last
  }
}
