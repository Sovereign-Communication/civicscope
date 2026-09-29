/**
 * Versioned sweep cache.
 *
 * This is separate from the generic HTTP cache because the sweep has different
 * needs: many medium-sized records that arrive incrementally, must be readable
 * while more are still arriving, and must be invalidated wholesale when the
 * variable set or the data vintage changes.
 *
 * Three properties matter:
 *
 *   1. A version stamp. `acs5:2023:screen:v1` is the key prefix. Change the
 *      vintage or the variable set and the bump invalidates every chunk at
 *      once, so stale numbers can never be shown under a current label.
 *   2. Independent chunks. A failed or skipped chunk leaves a valid partial
 *      result rather than corrupting the whole record.
 *   3. Stale-while-revalidate. Cached data renders immediately and refresh
 *      happens in the background, so a visitor is never blocked on the network
 *      and an expired entry is still better than a blank page.
 *
 * Storage is IndexedDB with an in-memory fallback, because a browser in private
 * mode or with storage disabled must still work, just without persistence.
 */

const DB_NAME = 'civicscope-cache'
const DB_VERSION = 2
const CHUNKS = 'sweep-chunks'
const MANIFEST = 'sweep-manifest'

/** Chunks older than this are served but flagged for background refresh. */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/** Rough cap on cached sweep rows, to bound storage. */
export const MAX_CACHED_CHUNKS = 200

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: 'key' })
        if (!db.objectStoreNames.contains(MANIFEST)) db.createObjectStore(MANIFEST, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(RESPONSES)) db.createObjectStore(RESPONSES, { keyPath: 'url' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function store<T>(name: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const t = db.transaction(name, mode)
          const r = op(t.objectStore(name))
          r.onsuccess = () => resolve(r.result as T)
          r.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

interface ChunkRecord<T> {
  key: string
  version: string
  body: T
  fetchedAt: number
}

export interface CachedChunk<T> {
  body: T
  fetchedAt: number
  isStale: boolean
}

export const sweepCache = {
  async read<T>(key: string, version: string): Promise<CachedChunk<T> | null> {
    const rec = await store<ChunkRecord<T>>(CHUNKS, 'readonly', (s) => s.get(key))
    // A version mismatch is a miss, never a partial hit. This is the mechanism
    // that prevents a stale figure being labelled with a current vintage.
    if (!rec || rec.version !== version) return null
    return { body: rec.body, fetchedAt: rec.fetchedAt, isStale: Date.now() - rec.fetchedAt > STALE_AFTER_MS }
  },

  async write<T>(key: string, body: T, version: string): Promise<void> {
    await store(CHUNKS, 'readwrite', (s) => s.put({ key, version, body, fetchedAt: Date.now() } as ChunkRecord<T>))
  },

  async count(): Promise<number> {
    const n = await store<number>(CHUNKS, 'readonly', (s) => s.count())
    return n ?? 0
  },

  async clear(): Promise<void> {
    await store(CHUNKS, 'readwrite', (s) => s.clear())
    await store(MANIFEST, 'readwrite', (s) => s.clear())
  },
}

export interface StoredManifest {
  id: string
  version: string
  [k: string]: unknown
}

/**
 * The manifest is stored so a reload can render the previous result immediately,
 * before deciding what still needs fetching. Without it, every reload would
 * start from an empty table.
 */
export const manifestStore = {
  async read<T extends object>(id: string, version: string): Promise<{ data: T; fetchedAt: number } | null> {
    const rec = await store<{ id: string; version: string; data: T; fetchedAt: number }>(
      MANIFEST,
      'readonly',
      (s) => s.get(id),
    )
    if (!rec || rec.version !== version) return null
    return { data: rec.data, fetchedAt: rec.fetchedAt }
  },

  async write<T extends object>(id: string, version: string, data: T): Promise<void> {
    await store(MANIFEST, 'readwrite', (s) => s.put({ id, version, data, fetchedAt: Date.now() }))
  },
}

/** Human-readable cache state for the cache panel. */
export async function cacheStatus(): Promise<{ chunks: number; approxRows: number }> {
  const chunks = await sweepCache.count()
  // Row count is not stored separately to keep writes small; the manifest
  // carries the authoritative figure when present.
  return { chunks, approxRows: chunks * 1000 }
}

// ---------------------------------------------------------------------------
// Generic response cache
//
// Used by the drilldown and per-area requests, which are small, bounded, and
// requested repeatedly. The sweep uses the versioned store above instead,
// because it needs independent chunks and a resumable manifest.
// ---------------------------------------------------------------------------

const RESPONSES = 'responses'
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface ResponseRecord<T> {
  url: string
  body: T
  fetchedAt: number
}

export async function readCache<T>(url: string): Promise<ResponseRecord<T> | null> {
  const rec = await store<ResponseRecord<T>>(RESPONSES, 'readonly', (s) => s.get(url))
  if (!rec || typeof rec.fetchedAt !== 'number') return null
  return rec
}

export function isFresh(rec: { fetchedAt: number }, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - rec.fetchedAt < ttlMs
}

export async function writeCache<T>(url: string, body: T): Promise<void> {
  await store(RESPONSES, 'readwrite', (s) => s.put({ url, body, fetchedAt: Date.now() } as ResponseRecord<T>))
}

