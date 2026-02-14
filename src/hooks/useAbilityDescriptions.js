import { useState, useEffect } from 'react'

export function useAbilityDescriptions(displayPokemon) {
  const [abilityDescriptions, setAbilityDescriptions] = useState({})

  useEffect(() => {
    if (!displayPokemon?.abilities?.length && !displayPokemon?.past_abilities?.length) return

    let active = true

    const fetchAbilityData = async () => {
      const descriptions = {}
      // Collect all abilities from current and past entries
      const allAbilities = [...(displayPokemon.abilities || [])]
      if (displayPokemon.past_abilities) {
        for (const entry of displayPokemon.past_abilities) {
          if (entry.abilities) allAbilities.push(...entry.abilities)
        }
      }
      // Deduplicate by ability name, skip null entries from past_abilities
      const seen = new Set()
      const uniqueAbilities = allAbilities.filter(a => {
        if (!a.ability) return false
        if (seen.has(a.ability.name)) return false
        seen.add(a.ability.name)
        return true
      })

      for (const ability of uniqueAbilities) {
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
  }, [displayPokemon?.abilities, displayPokemon?.past_abilities])

  return abilityDescriptions
}
