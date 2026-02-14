import { useState, useEffect } from 'react'

export function useAbilityDescriptions(displayPokemon) {
  const [abilityDescriptions, setAbilityDescriptions] = useState({})

  useEffect(() => {
    if (!displayPokemon?.abilities?.length) return

    let active = true

    const fetchAbilityData = async () => {
      const descriptions = {}
      for (const ability of displayPokemon.abilities) {
        try {
          const res = await fetch(ability.ability.url)
          const data = await res.json()
          const desc = data.effect_entries?.find(e => e.language.name === 'en')?.effect || 'No description available.'
          const generation = data.generation?.name || null
          descriptions[ability.ability.name] = { description: desc, generation }
        } catch (err) {
          console.error('Failed to fetch ability:', ability.ability.name)
          descriptions[ability.ability.name] = { description: 'No description available.', generation: null }
        }
      }
      if (active) {
        setAbilityDescriptions(descriptions)
      }
    }

    fetchAbilityData()

    return () => {
      active = false
    }
  }, [displayPokemon?.abilities])

  return abilityDescriptions
}
