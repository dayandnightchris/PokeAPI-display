import { useState, useEffect } from 'react'
import { fetchPokemonCached } from '../utils/pokeCache'
import { buildEvolutionTree, evolvableElsewhere } from '../utils/evolutionTree'

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

// The evolution tree for the Pokémon being viewed, as it works in the selected
// game. The rules live in utils/evolutionTree.
// The previous tree stays up while the next one is built; `ready` says whether
// `tree` is the one for the current Pokémon, form and game.
export function useEvolutionChain({ species, selectedVersion, selectedForm }) {
  const [state, setState] = useState({ tree: [], builtFor: null })
  const wanted = `${species?.name}|${selectedVersion}|${selectedForm || ''}`

  useEffect(() => {
    if (!species?.evolution_chain?.url) return
    let active = true

    const run = async () => {
      try {
        const res = await fetch(species.evolution_chain.url)
        const data = await res.json()
        const built = await buildEvolutionTree({
          chain: data.chain,
          selectedVersion,
          viewedSpecies: species.name,
          viewedPokemon: selectedForm,
          getSpecies: fetchSpeciesByName,
          getPokemon: fetchPokemonCached,
        })
        if (active) setState({ tree: built, builtFor: wanted })
      } catch (e) {
        console.error('Failed to fetch evolution chain:', e)
        if (active) setState({ tree: [], builtFor: wanted })
      }
    }

    run()
    return () => { active = false }
  }, [species?.evolution_chain?.url, species?.name, selectedVersion, selectedForm]) // eslint-disable-line react-hooks/exhaustive-deps

  return { tree: state.tree, ready: state.builtFor === wanted }
}

const NOWHERE = { versions: [], steps: [] }

// When the evolution from `fromSpecies` can't be done in the selected game
// (`enabled`): the games it can trade with where it can, and how it works
// there. `ready` is false while that is being worked out.
export function useEvolvableElsewhere({ species, selectedVersion, selectedForm, fromSpecies, enabled }) {
  const [state, setState] = useState({ ...NOWHERE, builtFor: null })
  const wanted = enabled && fromSpecies
    ? `${species?.name}|${selectedVersion}|${selectedForm || ''}|${fromSpecies}`
    : null

  useEffect(() => {
    if (!wanted || !species?.evolution_chain?.url) return
    let active = true

    const run = async () => {
      try {
        const res = await fetch(species.evolution_chain.url)
        const data = await res.json()
        const found = await evolvableElsewhere({
          chain: data.chain,
          selectedVersion,
          fromSpecies,
          viewedSpecies: species.name,
          viewedPokemon: selectedForm,
          getSpecies: fetchSpeciesByName,
          getPokemon: fetchPokemonCached,
        })
        if (active) setState({ ...found, builtFor: wanted })
      } catch (e) {
        console.error('Failed to check where the evolution works:', e)
        if (active) setState({ ...NOWHERE, builtFor: wanted })
      }
    }

    run()
    return () => { active = false }
  }, [wanted, species?.evolution_chain?.url]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!wanted) return { ...NOWHERE, ready: true }
  if (state.builtFor !== wanted) return { ...NOWHERE, ready: false }
  return { versions: state.versions, steps: state.steps, ready: true }
}
