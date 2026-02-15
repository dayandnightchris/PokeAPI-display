import { useState, useEffect } from 'react'
import { fetchPokemonCached } from '../utils/pokeCache'

const speciesCache = new Map()

async function fetchSpeciesByName(speciesName) {
  if (speciesCache.has(speciesName)) return speciesCache.get(speciesName)
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesName}/`)
    if (!res.ok) return null
    const data = await res.json()
    speciesCache.set(speciesName, data)
    return data
  } catch (err) {
    console.error('Failed to fetch species:', speciesName, err)
    return null
  }
}

function formatEvolutionDetail(detail) {
  if (!detail?.trigger?.name) return 'Unknown'

  const parts = []
  const trigger = detail.trigger.name

  if (trigger === 'level-up') {
    parts.push('Level up')
    if (detail.min_level) parts.push(`L${detail.min_level}`)
    if (detail.time_of_day) parts.push(`(${detail.time_of_day})`)
    if (detail.held_item?.name) parts.push(`holding ${detail.held_item.name.replace(/-/g, ' ')}`)
    if (detail.known_move?.name) parts.push(`knowing ${detail.known_move.name.replace(/-/g, ' ')}`)
    if (detail.known_move_type?.name) parts.push(`knowing a ${detail.known_move_type.name} move`)
    if (detail.location?.name) parts.push(`at ${detail.location.name.replace(/-/g, ' ')}`)
    if (detail.min_happiness) parts.push(`happiness ${detail.min_happiness}`)
    if (detail.min_affection) parts.push(`affection ${detail.min_affection}`)
    if (detail.min_beauty) parts.push(`beauty ${detail.min_beauty}`)
    if (detail.party_species?.name) parts.push(`with ${detail.party_species.name} in party`)
    if (detail.party_type?.name) parts.push(`with ${detail.party_type.name} type in party`)
    if (detail.needs_overworld_rain) parts.push(`(raining)`)
    if (detail.turn_upside_down) parts.push(`(turn device upside down)`)
    if (detail.gender === 1) parts.push(`(female)`)
    if (detail.gender === 2) parts.push(`(male)`)
    if (typeof detail.relative_physical_stats === 'number') {
      const rps = detail.relative_physical_stats
      if (rps === 1) parts.push('(Atk > Def)')
      if (rps === 0) parts.push('(Atk = Def)')
      if (rps === -1) parts.push('(Atk < Def)')
    }
    return parts.join(' ')
  }

  if (trigger === 'use-item') {
    parts.push('Use')
    if (detail.item?.name) parts.push(detail.item.name.replace(/-/g, ' '))
    if (detail.time_of_day) parts.push(`(${detail.time_of_day})`)
    return parts.join(' ')
  }

  if (trigger === 'trade') {
    parts.push('Trade')
    if (detail.held_item?.name) parts.push(`holding ${detail.held_item.name.replace(/-/g, ' ')}`)
    if (detail.trade_species?.name) parts.push(`for ${detail.trade_species.name}`)
    return parts.join(' ')
  }

  if (trigger === 'shed') return 'Shed'
  if (trigger === 'other') return 'Special'

  return trigger.replace(/-/g, ' ')
}

function formatEvolutionDetails(details) {
  if (!Array.isArray(details) || details.length === 0) return 'Unknown'
  return details.map(formatEvolutionDetail).join(' OR ')
}

// Map version groups to individual version names (for Gen 6+ where game_indices is empty)
const versionGroupToVersions = {
  'red-blue': ['red', 'blue'],
  'yellow': ['yellow'],
  'gold-silver': ['gold', 'silver'],
  'crystal': ['crystal'],
  'ruby-sapphire': ['ruby', 'sapphire'],
  'emerald': ['emerald'],
  'firered-leafgreen': ['firered', 'leafgreen'],
  'colosseum': ['colosseum'],
  'xd': ['xd'],
  'diamond-pearl': ['diamond', 'pearl'],
  'platinum': ['platinum'],
  'heartgold-soulsilver': ['heartgold', 'soulsilver'],
  'black-white': ['black', 'white'],
  'black-2-white-2': ['black-2', 'white-2'],
  'x-y': ['x', 'y'],
  'omega-ruby-alpha-sapphire': ['omega-ruby', 'alpha-sapphire'],
  'sun-moon': ['sun', 'moon'],
  'ultra-sun-ultra-moon': ['ultra-sun', 'ultra-moon'],
  'lets-go-pikachu-lets-go-eevee': [],
  'sword-shield': ['sword', 'shield'],
  'brilliant-diamond-shining-pearl': ['brilliant-diamond', 'shining-pearl'],
  'legends-arceus': ['legends-arceus'],
  'scarlet-violet': ['scarlet', 'violet'],
}

function pokemonAvailableInVersion(pokemonData, version) {
  if (!pokemonData || !version) return false
  // Check game_indices (works for Gen 1-5)
  if (pokemonData.game_indices?.some(gi => gi.version?.name === version)) return true
  // Check moves version_group_details (works for all gens)
  if (pokemonData.moves) {
    for (const move of pokemonData.moves) {
      for (const vgd of (move.version_group_details || [])) {
        const vgName = vgd.version_group?.name
        const versions = versionGroupToVersions[vgName]
        if (versions?.includes(version)) return true
      }
    }
  }
  return false
}

export function useEvolutionChain({ species, selectedVersion }) {
  const [tree, setTree] = useState([])

  useEffect(() => {
    if (!species?.evolution_chain?.url) return
    let active = true

    const checkSpeciesAvailableInVersion = async (speciesName) => {
      if (!selectedVersion) return true

      const sp = await fetchSpeciesByName(speciesName)
      if (!sp?.varieties?.length) return true

      const varieties = sp.varieties.map(v => v.pokemon?.name).filter(Boolean)

      const results = await Promise.all(
        varieties.map(async (vname) => {
          const p = await fetchPokemonCached(vname)
          if (!p) return false
          return pokemonAvailableInVersion(p, selectedVersion)
        })
      )

      return results.some(Boolean)
    }

    const buildNodes = async (chainNode) => {
      if (!active || !chainNode?.species?.name) return []

      const name = chainNode.species.name

      const childEdges = []
      for (const evo of chainNode.evolves_to || []) {
        const childRoots = await buildNodes(evo)
        for (const child of childRoots) {
          childEdges.push({
            triggerText: formatEvolutionDetails(evo.evolution_details),
            node: child
          })
        }
      }

      const ok = await checkSpeciesAvailableInVersion(name)
      if (!ok) {
        return childEdges.map(edge => edge.node)
      }

      return [{ name, url: chainNode.species.url, children: childEdges }]
    }

    const run = async () => {
      try {
        const res = await fetch(species.evolution_chain.url)
        const data = await res.json()
        const built = await buildNodes(data.chain)
        if (active) setTree(built)
      } catch (e) {
        console.error('Failed to fetch evolution chain:', e)
        if (active) setTree([])
      }
    }

    run()
    return () => { active = false }
  }, [species?.evolution_chain?.url, selectedVersion])

  return tree
}
