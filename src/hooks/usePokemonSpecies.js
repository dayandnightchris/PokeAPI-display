import { useState, useEffect } from 'react'

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
    const gameIndices = pokemon.game_indices || []
    if (gameIndices.length > 0) {
      const available = new Set(gameIndices.map(gi => gi.version?.name).filter(Boolean))
      const latestVersion = gameIndices[gameIndices.length - 1].version.name

      if (active) {
        setSelectedVersion(prev => {
          if (prev && available.has(prev)) return prev
          return latestVersion
        })
      }
    } else {
      if (active) setSelectedVersion(null)
    }

    return () => {
      active = false
    }
  }, [pokemon])

  return { species, selectedVersion, setSelectedVersion, allEncounters }
}
