const memoryCache = new Map()
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function fetchPokemonCached(name) {
  // Normalize input
  name = String(name).trim().toLowerCase()
  if (!name) return null

  // 1. Check in-memory cache first (fastest)
  if (memoryCache.has(name)) return memoryCache.get(name)

  // 2. Check localStorage (survives reloads)
  const key = `pokeapi:pokemon:${name}`
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      const ts = parsed?.ts
      const data = parsed?.data ?? parsed
      const fresh = typeof ts === 'number' ? (Date.now() - ts) < TTL_MS : true

      if (data && fresh) {
        memoryCache.set(name, data)
        return data
      }
    }
  } catch (err) {
    console.warn('localStorage read failed:', err)
  }

  // 3. Fetch from API and cache in both layers
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    memoryCache.set(name, data)
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
    } catch (err) {
      console.warn('localStorage write failed:', err)
    }

    return data
  } catch (err) {
    console.error('Failed to fetch pokemon:', name, err)
    return null
  }
}
