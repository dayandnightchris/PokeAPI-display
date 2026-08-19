import { useState, useEffect } from 'react'
import { versionGeneration, generationVersions, versionDisplayNames, versionHasDayNight, normalizeVersionDetails } from '../utils/versionInfo'
import { formatEvolutionDetails } from './useEvolutionChain'

/**
 * Checks if the current Pokémon can be obtained via evolution in the selected version.
 * Walks up the evolution chain and checks if any pre-evolution has wild encounters.
 *
 * Returns:
 *   - canEvolveFrom: name of pre-evolution with wild encounters in this version, or null
 *   - canTradeAndEvolveFrom: { preEvo, tradeVersions[] } if a pre-evo has encounters
 *     in other same-gen games, or null
 *   - loading: boolean
 */

const encounterCache = new Map()
const speciesResolveCache = new Map()

// For Pokemon with form names (e.g. pumpkaboo → pumpkaboo-average),
// the species name from the evolution chain doesn't match any Pokemon name.
// Resolve through the species endpoint to find the default variety's Pokemon name.
async function resolveDefaultPokemon(speciesName) {
  const key = speciesName.toLowerCase()
  if (speciesResolveCache.has(key)) return speciesResolveCache.get(key)

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${key}`)
    if (!res.ok) {
      speciesResolveCache.set(key, key)
      return key
    }
    const data = await res.json()
    const defaultVariety = data.varieties?.find(v => v.is_default)
    const defaultName = defaultVariety?.pokemon?.name || key
    speciesResolveCache.set(key, defaultName)
    return defaultName
  } catch {
    speciesResolveCache.set(key, key)
    return key
  }
}

// DLC version names (the-isle-of-armor-sword etc.) normalize to the base game
// so version matching works for pre-evos that only spawn in DLC areas.
const normalizeEncounters = (data) => (Array.isArray(data) ? data : []).map(enc => ({
  ...enc,
  version_details: normalizeVersionDetails(enc.version_details),
}))

async function fetchEncounters(pokemonName) {
  const key = pokemonName.toLowerCase()
  if (encounterCache.has(key)) return encounterCache.get(key)

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}/encounters`)
    if (res.ok) {
      const data = normalizeEncounters(await res.json())
      encounterCache.set(key, data)
      return data
    }

    // Species name may not match the default Pokemon name (e.g. "pumpkaboo" vs "pumpkaboo-average").
    // Resolve through the species endpoint and retry.
    const resolved = await resolveDefaultPokemon(key)
    if (resolved !== key) {
      if (encounterCache.has(resolved)) {
        const cached = encounterCache.get(resolved)
        encounterCache.set(key, cached)
        return cached
      }
      const retryRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${resolved}/encounters`)
      if (retryRes.ok) {
        const data = normalizeEncounters(await retryRes.json())
        encounterCache.set(key, data)
        encounterCache.set(resolved, data)
        return data
      }
    }

    encounterCache.set(key, [])
    return []
  } catch {
    return []
  }
}

function hasEncountersInVersion(encounters, version) {
  return encounters.some(enc =>
    enc.version_details?.some(vd =>
      vd.version?.name === version && vd.encounter_details?.length > 0
    )
  )
}

function getEncounterVersions(encounters) {
  const versions = new Set()
  encounters.forEach(enc => {
    enc.version_details?.forEach(vd => {
      if (vd.version?.name && vd.encounter_details?.length > 0) {
        versions.add(vd.version.name)
      }
    })
  })
  return versions
}

// Walk the evolution chain and collect all pre-evolutions of the target species
function getPreEvolutions(chainNode, targetName, path = []) {
  if (!chainNode?.species?.name) return null

  const currentName = chainNode.species.name

  if (currentName === targetName) {
    return path.length > 0 ? [...path] : null
  }

  for (const evo of chainNode.evolves_to || []) {
    const result = getPreEvolutions(evo, targetName, [...path, currentName])
    if (result) return result
  }

  return null
}

// Find the chain of nodes from the root to the target species (inclusive).
function findChainPath(node, targetName, path = []) {
  if (!node?.species?.name) return null
  const newPath = [...path, node]
  if (node.species.name === targetName) return newPath
  for (const evo of node.evolves_to || []) {
    const result = findChainPath(evo, targetName, newPath)
    if (result) return result
  }
  return null
}

// Build the evolution steps needed to get from a catchable pre-evo to the
// target, e.g. [{ to: 'jolteon', method: 'Use thunder stone' }].
function buildEvolveSteps(chainRoot, fromName, targetName, hasDayNight) {
  const fullPath = findChainPath(chainRoot, targetName)
  if (!fullPath) return []
  const startIdx = fullPath.findIndex(n => n.species.name === fromName)
  if (startIdx === -1) return []
  const steps = []
  for (let i = startIdx + 1; i < fullPath.length; i++) {
    steps.push({
      to: fullPath[i].species.name,
      method: formatEvolutionDetails(fullPath[i].evolution_details, hasDayNight),
    })
  }
  return steps
}

// Collect every species name in the evolution chain (all members)
function getAllChainMembers(chainNode) {
  if (!chainNode?.species?.name) return []
  const members = [chainNode.species.name]
  for (const evo of chainNode.evolves_to || []) {
    members.push(...getAllChainMembers(evo))
  }
  return members
}

function hasEncountersInGen(encounters, genVersions) {
  return encounters.some(enc =>
    enc.version_details?.some(vd =>
      genVersions.includes(vd.version?.name) && vd.encounter_details?.length > 0
    )
  )
}

export function usePreEvolutionCheck({ species, selectedVersion }) {
  const [canEvolveFrom, setCanEvolveFrom] = useState(null)
  const [canEvolveFromChain, setCanEvolveFromChain] = useState([])
  const [evolveSteps, setEvolveSteps] = useState([])
  const [canTradeAndEvolveFrom, setCanTradeAndEvolveFrom] = useState(null)
  const [evoFamilyVersions, setEvoFamilyVersions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!species?.evolution_chain?.url || !selectedVersion || !species?.name) {
      setCanEvolveFrom(null)
      setCanEvolveFromChain([])
      setEvolveSteps([])
      setCanTradeAndEvolveFrom(null)
      setEvoFamilyVersions([])
      return
    }

    let active = true
    setLoading(true)

    const run = async () => {
      try {
        const chainRes = await fetch(species.evolution_chain.url)
        if (!chainRes.ok) {
          if (active) { setCanEvolveFrom(null); setCanEvolveFromChain([]); setEvolveSteps([]); setCanTradeAndEvolveFrom(null); setEvoFamilyVersions([]); setLoading(false) }
          return
        }
        const chainData = await chainRes.json()

        // Collect all versions where any evo-family member has encounters
        const currentGen = versionGeneration[selectedVersion]
        const genVersions = currentGen ? (generationVersions[currentGen] || []) : []
        const allMembers = getAllChainMembers(chainData.chain)
        const familyVersions = new Set()
        for (const member of allMembers) {
          const enc = await fetchEncounters(member)
          const memberVersions = getEncounterVersions(enc)
          for (const v of memberVersions) {
            if (genVersions.includes(v)) familyVersions.add(v)
          }
        }
        if (active) setEvoFamilyVersions([...familyVersions])

        const preEvos = getPreEvolutions(chainData.chain, species.name)
        if (!preEvos || preEvos.length === 0) {
          if (active) { setCanEvolveFrom(null); setCanEvolveFromChain([]); setEvolveSteps([]); setCanTradeAndEvolveFrom(null); setLoading(false) }
          return
        }

        // Check pre-evolutions from closest to farthest
        const reversed = [...preEvos].reverse()

        // Priority 1: Collect ALL pre-evos with encounters in the selected version
        const catchable = []
        for (const preEvoName of reversed) {
          const encounters = await fetchEncounters(preEvoName)
          if (hasEncountersInVersion(encounters, selectedVersion)) {
            catchable.push(preEvoName)
          }
        }
        if (catchable.length > 0) {
          // reversed is closest→farthest, so reverse back to earliest-stage-first for display
          const ordered = [...catchable].reverse()
          if (active) {
            setCanEvolveFrom(ordered[0])
            setCanEvolveFromChain(ordered)
            setEvolveSteps(buildEvolveSteps(chainData.chain, ordered[0], species.name, versionHasDayNight(selectedVersion)))
            setCanTradeAndEvolveFrom(null)
            setLoading(false)
          }
          return
        }

        // Priority 2: Does any pre-evo have encounters in another game of the same gen?
        if (currentGen) {
          for (const preEvoName of reversed) {
            const encounters = await fetchEncounters(preEvoName)
            const encounterVersions = getEncounterVersions(encounters)
            const tradeVersions = genVersions.filter(
              v => v !== selectedVersion && encounterVersions.has(v)
            )
            if (tradeVersions.length > 0) {
              if (active) {
                setCanEvolveFrom(null)
                setCanTradeAndEvolveFrom({ preEvo: preEvoName, tradeVersions })
                setLoading(false)
              }
              return
            }
          }
        }

        if (active) { setCanEvolveFrom(null); setCanEvolveFromChain([]); setEvolveSteps([]); setCanTradeAndEvolveFrom(null); setLoading(false) }
      } catch (err) {
        console.error('Pre-evolution check failed:', err)
        if (active) { setCanEvolveFrom(null); setCanEvolveFromChain([]); setEvolveSteps([]); setCanTradeAndEvolveFrom(null); setEvoFamilyVersions([]); setLoading(false) }
      }
    }

    run()
    return () => { active = false }
  }, [species?.evolution_chain?.url, species?.name, selectedVersion])

  return { canEvolveFrom, canEvolveFromChain, evolveSteps, canTradeAndEvolveFrom, evoFamilyVersions, loading }
}
