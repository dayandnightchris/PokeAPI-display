import { useState, useEffect } from 'react'

export function usePokemonSpecies(pokemon) {
  const [species, setSpecies] = useState(null)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [allEncounters, setAllEncounters] = useState([])

  useEffect(() => {
    if (!pokemon) return

    // Fetch species data for more info
    fetch(pokemon.species.url)
      .then(res => res.json())
      .then(data => setSpecies(data))
      .catch(err => console.error('Failed to fetch species:', err))

    // Fetch location areas with version info
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}/encounters`)
      .then(res => res.json())
      .then(data => setAllEncounters(data))
      .catch(err => {
        console.error('Failed to fetch location areas:', err)
        setAllEncounters([])
      })

    // Auto-select the latest version
    if (pokemon.game_indices && pokemon.game_indices.length > 0) {
      const latestVersion = pokemon.game_indices[pokemon.game_indices.length - 1].version.name
      setSelectedVersion(latestVersion)
    }
  }, [pokemon])

  return { species, selectedVersion, setSelectedVersion, allEncounters }
}
