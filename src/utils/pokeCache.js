// ---------------------------------------------------------------------------
// IndexedDB-backed cache with in-memory layer
// ---------------------------------------------------------------------------
// localStorage only holds ~5-10 MB total which fills up quickly with PokeAPI
// JSON blobs.  IndexedDB typically allows hundreds of MB, making it a much
// better fit for a persistent API cache.
// ---------------------------------------------------------------------------

const DB_NAME = 'pokeapi-cache'
const DB_VERSION = 1
const STORE_NAME = 'responses'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ---- IndexedDB helpers ----------------------------------------------------

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      console.warn('IndexedDB open failed, falling back to memory-only cache')
      resolve(null)
    }
  })
  return _dbPromise
}

async function idbGet(key) {
  try {
    const db = await openDB()
    if (!db) return undefined
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })
  } catch {
    return undefined
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDB()
    if (!db) return
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Silently ignore write failures
  }
}

// Migrate old localStorage cache entries to IndexedDB (runs once)
let _migrated = false
async function migrateLocalStorage() {
  if (_migrated) return
  _migrated = true
  try {
    const db = await openDB()
    if (!db) return
    const keysToMigrate = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('pokeapi:')) keysToMigrate.push(k)
    }
    if (keysToMigrate.length === 0) return
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const k of keysToMigrate) {
      try {
        const raw = localStorage.getItem(k)
        if (raw) {
          const parsed = JSON.parse(raw)
          store.put(parsed, k)
        }
      } catch { /* skip bad entries */ }
    }
    tx.oncomplete = () => {
      // Remove migrated keys from localStorage to free space
      for (const k of keysToMigrate) {
        try { localStorage.removeItem(k) } catch { /* ignore */ }
      }
    }
  } catch { /* migration is best-effort */ }
}

// Kick off migration immediately on load
migrateLocalStorage()

// ---- In-memory caches -----------------------------------------------------

const memoryCache = new Map()
const moveMemoryCache = new Map()

// ---- Generic cached-fetch helper ------------------------------------------

async function cachedFetch(cacheKey, url, memCache) {
  // 1. In-memory (instant)
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)

  // 2. IndexedDB (survives reloads)
  const stored = await idbGet(cacheKey)
  if (stored) {
    const ts = stored?.ts
    const data = stored?.data ?? stored
    const fresh = typeof ts === 'number' ? (Date.now() - ts) < TTL_MS : true
    if (data && fresh) {
      memCache.set(cacheKey, data)
      return data
    }
  }

  // 3. Network
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    memCache.set(cacheKey, data)
    idbSet(cacheKey, { ts: Date.now(), data }) // fire-and-forget
    return data
  } catch (err) {
    console.error('Failed to fetch:', url, err)
    return null
  }
}

// ---- Public API (unchanged signatures) ------------------------------------

export async function fetchPokemonCached(name) {
  name = String(name).trim().toLowerCase()
  if (!name) return null
  return cachedFetch(`pokeapi:pokemon:${name}`, `https://pokeapi.co/api/v2/pokemon/${name}/`, memoryCache)
}

export async function fetchMoveCached(name) {
  name = String(name).trim().toLowerCase()
  if (!name) return null
  return cachedFetch(`pokeapi:move:${name}`, `https://pokeapi.co/api/v2/move/${name}/`, moveMemoryCache)
}

const machineMemoryCache = new Map()

export async function fetchMachineCached(url) {
  if (!url) return null
  return cachedFetch(url, url, machineMemoryCache)
}

const itemMemoryCache = new Map()

export async function fetchItemCached(name) {
  name = String(name).trim().toLowerCase()
  if (!name) return null
  return cachedFetch(`pokeapi:item:${name}`, `https://pokeapi.co/api/v2/item/${name}/`, itemMemoryCache)
}

const abilityMemoryCache = new Map()

export async function fetchAbilityCached(name) {
  name = String(name).trim().toLowerCase()
  if (!name) return null
  return cachedFetch(`pokeapi:ability:${name}`, `https://pokeapi.co/api/v2/ability/${name}/`, abilityMemoryCache)
}

const speciesMemoryCache = new Map()

export async function fetchSpeciesCached(name) {
  name = String(name).trim().toLowerCase()
  if (!name) return null
  return cachedFetch(`pokeapi:species:${name}`, `https://pokeapi.co/api/v2/pokemon-species/${name}/`, speciesMemoryCache)
}
