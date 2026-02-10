const memoryCache = new Map()

export async function fetchPokemonCached(name) {
  // 1. Check in-memory cache first (fastest)
  if (memoryCache.has(name)) return memoryCache.get(name)

  // 2. Check localStorage (survives reloads)
  const key = `pokeapi:pokemon:${name}`
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const data = JSON.parse(stored)
      memoryCache.set(name, data)
      return data
    }
  } catch (err) {
    console.warn('localStorage read failed:', err)
  }

  // 3. Fetch from API and cache in both layers
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}/`)
    const data = await res.json()

    memoryCache.set(name, data)
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (err) {
      console.warn('localStorage write failed:', err)
    }

    return data
  } catch (err) {
    console.error('Failed to fetch pokemon:', name, err)
    return null
  }
}
