// Bulk Pokédex data for the landing-page list. One GraphQL request fetches
// every Gen 1–7 species' types, base stats, and abilities (instead of ~800
// REST calls), cached in localStorage + an in-memory memo so it loads once.

const GRAPHQL_URL = 'https://beta.pokeapi.co/graphql/v1beta'
const CACHE_KEY = 'pokedexList-v2'

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

// Gen 8 box icon URL straight from the id — no extra fetch needed.
export const spriteUrlForId = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${id}.png`

const QUERY = `{
  pokemon_v2_pokemon(where: {id: {_lte: 809}}, order_by: {name: asc}) {
    id
    name
    pokemon_v2_pokemontypes { pokemon_v2_type { name } }
    pokemon_v2_pokemontypepasts { generation_id pokemon_v2_type { name } }
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
    // Group past-type rows (one row per type per generation) by generation.
    const pastByGen = {}
    for (const pt of p.pokemon_v2_pokemontypepasts || []) {
      const g = pt.generation_id
      const name = pt.pokemon_v2_type?.name
      if (g != null && name) (pastByGen[g] ||= []).push(name)
    }
    const pastTypes = Object.entries(pastByGen)
      .map(([generation, types]) => ({ generation: Number(generation), types }))
      .sort((a, b) => a.generation - b.generation)

    return {
      id: p.id,
      name: p.name,
      types: (p.pokemon_v2_pokemontypes || []).map(t => t.pokemon_v2_type?.name).filter(Boolean),
      pastTypes,
      abilities: (p.pokemon_v2_pokemonabilities || [])
        .map(a => ({ name: a.pokemon_v2_ability?.name, isHidden: a.is_hidden }))
        .filter(a => a.name),
      stats,
    }
  })
}

// The types a Pokémon had in a given generation. past_types entries record the
// LAST generation a set of types applied; pick the earliest entry still in
// effect for `gen` (e.g. Clefairy: Normal through Gen 5, Fairy from Gen 6).
export function typesForGeneration(p, gen) {
  if (!gen || !p.pastTypes?.length) return p.types
  const applicable = p.pastTypes.find(pt => pt.generation >= gen)
  return applicable ? applicable.types : p.types
}

// Ids (≤809) of Pokémon that can learn a given move, fetched on demand + cached.
const learnerCache = new Map()
export async function fetchMoveLearners(moveName) {
  if (learnerCache.has(moveName)) return learnerCache.get(moveName)
  const query = `query($n: String!) {
    pokemon_v2_pokemonmove(where: {pokemon_v2_move: {name: {_eq: $n}}, pokemon_id: {_lte: 809}}, distinct_on: pokemon_id) { pokemon_id }
  }`
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { n: moveName } }),
  })
  if (!res.ok) throw new Error(`Move learners request failed (${res.status})`)
  const json = await res.json()
  const set = new Set((json.data?.pokemon_v2_pokemonmove || []).map(m => m.pokemon_id))
  learnerCache.set(moveName, set)
  return set
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
