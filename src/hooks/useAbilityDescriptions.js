import { useState, useEffect, useMemo } from 'react'
import { abilityEffectForVersion } from '../utils/abilityRules'

export function useAbilityDescriptions(displayPokemon, selectedVersion) {
  const [abilityData, setAbilityData] = useState({})

  useEffect(() => {
    if (!displayPokemon?.abilities?.length && !displayPokemon?.past_abilities?.length) return

    let active = true

    const fetchAbilityData = async () => {
      const fetched = {}
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
          fetched[ability.ability.name] = await res.json()
        } catch (err) {
          console.error('Failed to fetch ability:', ability.ability.name)
          fetched[ability.ability.name] = null
        }
      }
      if (active) {
        setAbilityData(fetched)
      }
    }

    fetchAbilityData()

    return () => {
      active = false
    }
  }, [displayPokemon?.abilities, displayPokemon?.past_abilities])

  // Resolve each ability's effect text for the selected version
  return useMemo(() => {
    const descriptions = {}
    for (const [name, data] of Object.entries(abilityData)) {
      descriptions[name] = {
        description: abilityEffectForVersion(data, selectedVersion) || 'No description available.',
        generation: data?.generation?.name || null,
      }
    }
    return descriptions
  }, [abilityData, selectedVersion])
}
