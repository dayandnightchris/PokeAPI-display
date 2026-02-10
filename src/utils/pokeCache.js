const pokemonCache = new Map()

export async function fetchPokemonCached(name) {
  if (pokemonCache.has(name)) return pokemonCache.get(name)
  
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}/`)
    const data = await res.json()
    pokemonCache.set(name, data)
    return data
  } catch (err) {
    console.error('Failed to fetch pokemon:', name, err)
    return null
  }
}
