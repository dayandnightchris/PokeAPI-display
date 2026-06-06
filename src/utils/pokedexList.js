// Bulk Pokédex data for the landing-page list. One GraphQL request fetches
// every Gen 1–7 species' types, base stats, and abilities (instead of ~800
// REST calls), cached in localStorage + an in-memory memo so it loads once.

const GRAPHQL_URL = 'https://beta.pokeapi.co/graphql/v1beta'
const CACHE_KEY = 'pokedexList-v1'

// National-Dex id ranges per region (Gen 1–7; Gen 8+ is excluded elsewhere).
export const REGIONS = [
  { name: 'Kanto', min: 1, max: 151 },
  { name: 'Johto', min: 152, max: 251 },
  { name: 'Hoenn', min: 252, max: 386 },
  { name: 'Sinnoh', min: 387, max: 493 },
  { name: 'Unova', min: 494, max: 649 },
  { name: 'Kalos', min: 650, max: 721 },
  { name: 'Alola', min: 722, max: 809 },
]

export const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]

// Sprite icon URL straight from the id — no extra fetch needed.
export const spriteUrlForId = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

const QUERY = `{
  pokemon_v2_pokemon(where: {id: {_lte: 809}}, order_by: {name: asc}) {
    id
    name
    pokemon_v2_pokemontypes { pokemon_v2_type { name } }
    pokemon_v2_pokemonstats { base_stat pokemon_v2_stat { name } }
    pokemon_v2_pokemonabilities { is_hidden pokemon_v2_ability { name } }
  }
}`

function normalize(raw) {
  return raw.map(p => {
    const stats = {}
    for (const s of p.pokemon_v2_pokemonstats || []) {
      stats[s.pokemon_v2_stat?.name] = s.base_stat
    }
    return {
      id: p.id,
      name: p.name,
      types: (p.pokemon_v2_pokemontypes || []).map(t => t.pokemon_v2_type?.name).filter(Boolean),
      abilities: (p.pokemon_v2_pokemonabilities || [])
        .map(a => ({ name: a.pokemon_v2_ability?.name, isHidden: a.is_hidden }))
        .filter(a => a.name),
      stats,
    }
  })
}

let memo = null

export async function fetchPokedexList() {
  if (memo) return memo

  // localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      memo = JSON.parse(cached)
      return memo
    }
  } catch { /* ignore corrupt/unavailable storage */ }

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  })
  if (!res.ok) throw new Error(`Pokédex list request failed (${res.status})`)
  const json = await res.json()
  if (json.errors) throw new Error('Pokédex list query error')

  const list = normalize(json.data?.pokemon_v2_pokemon || [])
  memo = list
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)) } catch { /* storage full/unavailable */ }
  return list
}
