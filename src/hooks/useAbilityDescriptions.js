import { useState, useEffect } from 'react'

export function useAbilityDescriptions(displayPokemon) {
  const [abilityDescriptions, setAbilityDescriptions] = useState({})

  useEffect(() => {
    if (!displayPokemon?.abilities?.length) return

    const fetchAbilityData = async () => {
      const descriptions = {}
      for (const ability of displayPokemon.abilities) {
        try {
          const res = await fetch(ability.ability.url)
          const data = await res.json()
          const desc = data.effect_entries?.find(e => e.language.name === 'en')?.effect || 'No description available.'
          descriptions[ability.ability.name] = desc
        } catch (err) {
          console.error('Failed to fetch ability:', ability.ability.name)
          descriptions[ability.ability.name] = 'No description available.'
        }
      }
      setAbilityDescriptions(descriptions)
    }

    fetchAbilityData()
  }, [displayPokemon?.abilities])

  return abilityDescriptions
}
