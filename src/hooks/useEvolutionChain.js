import { useState, useEffect } from 'react'
import { fetchPokemonCached } from '../utils/pokeCache'

const getTriggerText = (trigger) => {
  if (trigger.trigger.name === 'level-up') {
    if (trigger.min_level) {
      return `L${trigger.min_level}`
    }
    // Check for other level-up conditions
    if (trigger.min_happiness) {
      return `Happiness ${trigger.min_happiness}`
    }
    if (trigger.min_affection) {
      return `Affection ${trigger.min_affection}`
    }
    if (trigger.min_beauty) {
      return `Beauty ${trigger.min_beauty}`
    }
    if (trigger.known_move) {
      return `Learn ${trigger.known_move.name}`
    }
    if (trigger.time_of_day) {
      return `Level up (${trigger.time_of_day})`
    }
    if (trigger.location) {
      return `Level up at ${trigger.location.name}`
    }
    return 'Level up'
  } else if (trigger.trigger.name === 'trade') {
    if (trigger.held_item) {
      return `Trade (${trigger.held_item.name.replace(/-/g, ' ')})`
    }
    if (trigger.trade_species) {
      return `Trade for ${trigger.trade_species.name}`
    }
    return 'Trade'
  } else if (trigger.trigger.name === 'use-item') {
    return `Use ${trigger.item?.name.replace(/-/g, ' ') || 'Item'}`
  } else if (trigger.trigger.name === 'shed') {
    return 'Shed'
  } else if (trigger.trigger.name === 'other') {
    return 'Special'
  }
  return trigger.trigger.name.replace(/-/g, ' ')
}

export function useEvolutionChain({ species, selectedVersion }) {
  const [evolutions, setEvolutions] = useState([])

  useEffect(() => {
    if (!species?.evolution_chain?.url) return

    let active = true

    const checkVersionAvailability = async (speciesName) => {
      try {
        const data = await fetchPokemonCached(speciesName)
        if (!data) return false
        // If no version selected, show all. Otherwise check if species exists in version
        if (!selectedVersion) return true
        return data.game_indices?.some(gi => gi.version.name === selectedVersion) || false
      } catch (err) {
        console.error('Failed to check version availability:', speciesName, err)
        return false
      }
    }

    const fetchEvolutionChain = async () => {
      try {
        const res = await fetch(species.evolution_chain.url)
        const data = await res.json()
        const evolutionList = []
        const seen = new Set()

        const traverse = async (chain) => {
          if (!active) return

          // Add current species if not seen and available in version
          if (chain.species && !seen.has(chain.species.name)) {
            const isAvailable = await checkVersionAvailability(chain.species.name)
            if (isAvailable) {
              evolutionList.push({
                name: chain.species.name,
                url: chain.species.url
              })
              seen.add(chain.species.name)
            }
          }

          // Process evolutions
          if (chain.evolves_to?.length > 0) {
            for (const evo of chain.evolves_to) {
              if (!active) return

              const isEvoAvailable = await checkVersionAvailability(evo.species.name)
              if (isEvoAvailable) {
                // Add trigger between current and next evolution
                const trigger = evo.evolution_details?.[0]
                const triggerText = trigger ? getTriggerText(trigger) : 'Unknown'
                evolutionList.push({
                  isTrigger: true,
                  text: triggerText
                })

                // Add evolved species and continue recursion
                if (!seen.has(evo.species.name)) {
                  evolutionList.push({
                    name: evo.species.name,
                    url: evo.species.url
                  })
                  seen.add(evo.species.name)

                  // Continue traversal from this species
                  await traverse(evo)
                }
              }
            }
          }
        }

        await traverse(data.chain)
        
        if (active) {
          setEvolutions(evolutionList)
        }
      } catch (err) {
        console.error('Failed to fetch evolution chain:', err)
      }
    }

    fetchEvolutionChain()

    return () => {
      active = false
    }
  }, [species?.evolution_chain?.url, selectedVersion])

  return evolutions
}
