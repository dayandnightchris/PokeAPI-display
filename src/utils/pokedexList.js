// Bulk Pokédex data for the landing-page list. One GraphQL request fetches
// every Gen 1–7 species' types, base stats, and abilities (instead of ~800
// REST calls), cached in localStorage + an in-memory memo so it loads once.
// Past types/stats/abilities ride along in the same request so the list can
// re-render for any selected generation without refetching.

const GRAPHQL_URL = 'https://graphql.pokeapi.co/v1beta2'
const CACHE_KEY = 'pokedexList-v3'
// Pre-v1beta2 cache entries have the old shape — drop them on load.
const STALE_CACHE_KEYS = ['pokedexList-v2']

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
  pokemon(where: {id: {_lte: 809}}, order_by: {name: asc}) {
    id
    name
    pokemontypes { type { name } }
    pokemontypepasts { generation_id type { name } }
    pokemonstats { base_stat stat { name } }
    pokemonstatpasts { generation_id base_stat stat { name } }
    pokemonabilities { is_hidden slot ability { name } }
    pokemonabilitypasts { generation_id is_hidden slot ability { name } }
  }
}`

function normalize(raw) {
  return raw.map(p => {
    const stats = {}
    for (const s of p.pokemonstats || []) {
      stats[s.stat?.name] = s.base_stat
    }
    // Group past-type rows (one row per type per generation) by generation.
    const pastByGen = {}
    for (const pt of p.pokemontypepasts || []) {
      const g = pt.generation_id
      const name = pt.type?.name
      if (g != null && name) (pastByGen[g] ||= []).push(name)
    }
    const pastTypes = Object.entries(pastByGen)
      .map(([generation, types]) => ({ generation: Number(generation), types }))
      .sort((a, b) => a.generation - b.generation)

    return {
      id: p.id,
      name: p.name,
      types: (p.pokemontypes || []).map(t => t.type?.name).filter(Boolean),
      pastTypes,
      // One row per stat per boundary generation (the LAST gen the value applied).
      pastStats: (p.pokemonstatpasts || [])
        .filter(ps => ps.generation_id != null && ps.stat?.name)
        .map(ps => ({ generation: ps.generation_id, name: ps.stat.name, base: ps.base_stat })),
      abilities: (p.pokemonabilities || [])
        .map(a => ({ name: a.ability?.name, isHidden: a.is_hidden, slot: a.slot }))
        .filter(a => a.name),
      // One row per slot per boundary generation; name null = slot was empty then.
      pastAbilities: (p.pokemonabilitypasts || [])
        .filter(pa => pa.generation_id != null && pa.slot != null)
        .map(pa => ({ generation: pa.generation_id, slot: pa.slot, name: pa.ability?.name ?? null, isHidden: pa.is_hidden })),
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

// The base stats a Pokémon had in a given generation, keyed by stat name.
// Same boundary convention as past types: a past row's generation is the LAST
// gen its value applied, so per stat we take the override with the smallest
// boundary >= gen (e.g. Pikachu: Def 30 through Gen 5, 40 from Gen 6).
// Gen 1 collapses SpA/SpD into the single 'special' stat the past rows supply.
export function statsForGeneration(p, gen) {
  if (!gen) return p.stats
  const out = { ...p.stats }
  const byStat = {}
  for (const ps of p.pastStats || []) {
    if (ps.generation >= gen && (!byStat[ps.name] || ps.generation < byStat[ps.name].generation)) {
      byStat[ps.name] = ps
    }
  }
  for (const name in byStat) out[name] = byStat[name].base
  if (gen === 1) {
    // Fallback for any mon missing a gen-i 'special' row: SpA matches Gen 1
    // Special far more often than SpD does.
    out['special'] ??= out['special-attack']
    delete out['special-attack']
    delete out['special-defense']
  } else {
    delete out['special']
  }
  return out
}

// The abilities a Pokémon had in a given generation. Past rows override the
// matching slot (name null = the slot didn't exist yet, e.g. hidden abilities
// that were added in a later game — Pikachu has no hidden slot through Gen 4).
// No abilities at all before Gen 3; the hidden slot is Gen 5+.
export function abilitiesForGeneration(p, gen) {
  if (!gen) return p.abilities
  if (gen <= 2) return []
  let abilities = p.abilities
  const bySlot = {}
  for (const pa of p.pastAbilities || []) {
    if (pa.generation >= gen && (!bySlot[pa.slot] || pa.generation < bySlot[pa.slot].generation)) {
      bySlot[pa.slot] = pa
    }
  }
  if (Object.keys(bySlot).length) {
    abilities = abilities
      .map(a => {
        const past = bySlot[a.slot]
        if (past === undefined) return a
        return past.name ? { name: past.name, isHidden: past.isHidden, slot: a.slot } : null
      })
      .filter(Boolean)
  }
  if (gen <= 4) abilities = abilities.filter(a => !a.isHidden)
  return abilities
}

// Ids (≤809) of Pokémon that can learn a given move, fetched on demand + cached.
const learnerCache = new Map()
export async function fetchMoveLearners(moveName) {
  if (learnerCache.has(moveName)) return learnerCache.get(moveName)
  const query = `query($n: String!) {
    pokemonmove(where: {move: {name: {_eq: $n}}, pokemon_id: {_lte: 809}}, distinct_on: pokemon_id) { pokemon_id }
  }`
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { n: moveName } }),
  })
  if (!res.ok) throw new Error(`Move learners request failed (${res.status})`)
  const json = await res.json()
  const set = new Set((json.data?.pokemonmove || []).map(m => m.pokemon_id))
  learnerCache.set(moveName, set)
  return set
}

let memo = null

export async function fetchPokedexList() {
  if (memo) return memo

  // localStorage cache
  try {
    for (const k of STALE_CACHE_KEYS) localStorage.removeItem(k)
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

  const list = normalize(json.data?.pokemon || [])
  memo = list
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)) } catch { /* storage full/unavailable */ }
  return list
}
