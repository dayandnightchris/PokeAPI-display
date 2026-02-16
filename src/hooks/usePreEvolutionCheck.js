import { useState, useEffect } from 'react'
import { versionGeneration, generationVersions, versionDisplayNames } from '../utils/versionInfo'

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

async function fetchEncounters(pokemonName) {
  const key = pokemonName.toLowerCase()
  if (encounterCache.has(key)) return encounterCache.get(key)

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}/encounters`)
    if (!res.ok) return []
    const data = await res.json()
    encounterCache.set(key, data)
    return data
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

export function usePreEvolutionCheck({ species, selectedVersion }) {
  const [canEvolveFrom, setCanEvolveFrom] = useState(null)
  const [canTradeAndEvolveFrom, setCanTradeAndEvolveFrom] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!species?.evolution_chain?.url || !selectedVersion || !species?.name) {
      setCanEvolveFrom(null)
      setCanTradeAndEvolveFrom(null)
      return
    }

    let active = true
    setLoading(true)

    const run = async () => {
      try {
        const chainRes = await fetch(species.evolution_chain.url)
        if (!chainRes.ok) {
          if (active) { setCanEvolveFrom(null); setCanTradeAndEvolveFrom(null); setLoading(false) }
          return
        }
        const chainData = await chainRes.json()

        const preEvos = getPreEvolutions(chainData.chain, species.name)
        if (!preEvos || preEvos.length === 0) {
          if (active) { setCanEvolveFrom(null); setCanTradeAndEvolveFrom(null); setLoading(false) }
          return
        }

        // Check pre-evolutions from closest to farthest
        const reversed = [...preEvos].reverse()

        // Priority 1: Does any pre-evo have encounters in the selected version?
        for (const preEvoName of reversed) {
          const encounters = await fetchEncounters(preEvoName)
          if (hasEncountersInVersion(encounters, selectedVersion)) {
            if (active) { setCanEvolveFrom(preEvoName); setCanTradeAndEvolveFrom(null); setLoading(false) }
            return
          }
        }

        // Priority 2: Does any pre-evo have encounters in another game of the same gen?
        const currentGen = versionGeneration[selectedVersion]
        if (currentGen) {
          const genVersions = generationVersions[currentGen] || []
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

        if (active) { setCanEvolveFrom(null); setCanTradeAndEvolveFrom(null); setLoading(false) }
      } catch (err) {
        console.error('Pre-evolution check failed:', err)
        if (active) { setCanEvolveFrom(null); setCanTradeAndEvolveFrom(null); setLoading(false) }
      }
    }

    run()
    return () => { active = false }
  }, [species?.evolution_chain?.url, species?.name, selectedVersion])

  return { canEvolveFrom, canTradeAndEvolveFrom, loading }
}
