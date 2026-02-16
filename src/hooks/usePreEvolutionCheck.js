import { useState, useEffect } from 'react'

/**
 * Checks if the current Pokémon can be obtained via evolution in the selected version.
 * Walks up the evolution chain and checks if any pre-evolution has wild encounters.
 *
 * Returns: { canEvolveFrom: string|null, loading: boolean }
 *   - canEvolveFrom: the name of the immediate pre-evolution that has wild encounters, or null
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!species?.evolution_chain?.url || !selectedVersion || !species?.name) {
      setCanEvolveFrom(null)
      return
    }

    let active = true
    setLoading(true)

    const run = async () => {
      try {
        const chainRes = await fetch(species.evolution_chain.url)
        if (!chainRes.ok) { if (active) { setCanEvolveFrom(null); setLoading(false) }; return }
        const chainData = await chainRes.json()

        const preEvos = getPreEvolutions(chainData.chain, species.name)
        if (!preEvos || preEvos.length === 0) {
          if (active) { setCanEvolveFrom(null); setLoading(false) }
          return
        }

        // Check pre-evolutions from closest to farthest
        // (e.g. for Feraligatr: check Croconaw first, then Totodile)
        const reversed = [...preEvos].reverse()
        for (const preEvoName of reversed) {
          const encounters = await fetchEncounters(preEvoName)
          if (hasEncountersInVersion(encounters, selectedVersion)) {
            if (active) { setCanEvolveFrom(preEvoName); setLoading(false) }
            return
          }
        }

        // No pre-evolution has wild encounters — check if any pre-evo at least
        // exists in the game (has encounters in ANY version of the same gen).
        // If so, it could itself be obtained via trade/transfer and evolved.
        // For simplicity, just check if the immediate pre-evo has ANY encounters at all
        // in the game — which we handle at a higher level.
        // For now, report no evolution path found.
        if (active) { setCanEvolveFrom(null); setLoading(false) }
      } catch (err) {
        console.error('Pre-evolution check failed:', err)
        if (active) { setCanEvolveFrom(null); setLoading(false) }
      }
    }

    run()
    return () => { active = false }
  }, [species?.evolution_chain?.url, species?.name, selectedVersion])

  return { canEvolveFrom, loading }
}
