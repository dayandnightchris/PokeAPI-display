import { useState, useEffect } from 'react'

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

function getAllAvailableVersions(pokemon) {
  const available = new Set()
  // From game_indices (Gen 1-5)
  if (pokemon.game_indices) {
    pokemon.game_indices.forEach(gi => {
      if (gi.version?.name) available.add(gi.version.name)
    })
  }
  // From moves version_group_details (all gens)
  if (pokemon.moves) {
    pokemon.moves.forEach(move => {
      move.version_group_details?.forEach(vgd => {
        const vgName = vgd.version_group?.name
        const versions = versionGroupToVersions[vgName]
        if (versions) versions.forEach(v => available.add(v))
      })
    })
  }
  return available
}

export function usePokemonSpecies(pokemon) {
  const [species, setSpecies] = useState(null)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [allEncounters, setAllEncounters] = useState([])

  useEffect(() => {
    if (!pokemon) return

    let active = true

    // Fetch species data for more info
    fetch(pokemon.species.url)
      .then(res => res.json())
      .then(data => {
        if (active) setSpecies(data)
      })
      .catch(err => console.error('Failed to fetch species:', err))

    // Fetch location areas with version info
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}/encounters`)
      .then(res => res.json())
      .then(data => {
        if (active) setAllEncounters(data)
      })
      .catch(err => {
        console.error('Failed to fetch location areas:', err)
        if (active) setAllEncounters([])
      })

    // Preserve the user's currently selected version when switching Pokémon.
    // If the current selection is not available for the new Pokémon, fall back to the latest.
    const available = getAllAvailableVersions(pokemon)
    if (available.size > 0) {
      if (active) {
        setSelectedVersion(prev => {
          if (prev && available.has(prev)) return prev
          // Fall back to last game_indices entry, or first available version
          const gameIndices = pokemon.game_indices || []
          if (gameIndices.length > 0) return gameIndices[gameIndices.length - 1].version.name
          return Array.from(available)[0]
        })
      }
    } else {
      if (active) setSelectedVersion(null)
    }

    return () => {
      active = false
    }
  }, [pokemon])

  useEffect(() => {
    if (!pokemon || selectedVersion) return
    if (!allEncounters || allEncounters.length === 0) return

    const encounterVersions = new Set()
    allEncounters.forEach(encounter => {
      encounter.version_details?.forEach(detail => {
        const versionName = detail.version?.name
        if (versionName) encounterVersions.add(versionName)
      })
    })

    const versionList = Array.from(encounterVersions)
    if (versionList.length === 0) return

    setSelectedVersion(versionList[0])
  }, [pokemon, selectedVersion, allEncounters])

  return { species, selectedVersion, setSelectedVersion, allEncounters }
}
