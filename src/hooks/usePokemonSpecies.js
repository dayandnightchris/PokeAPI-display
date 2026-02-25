import { useState, useEffect } from 'react'

// Pokedex names that map to specific game versions.
// Used to detect game availability when the API hasn't populated moves/game_indices yet.
const pokedexToVersions = {
  'lumiose-city': ['legends-za'],
}

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
  'the-teal-mask': ['scarlet', 'violet'],
  'the-indigo-disk': ['scarlet', 'violet'],
  'legends-za': ['legends-za'],
  'mega-dimension': ['legends-za'],
  'the-isle-of-armor': ['sword', 'shield'],
  'the-crown-tundra': ['sword', 'shield'],
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

/**
 * For pokemon with empty game_indices and moves (e.g. PLZA megas),
 * check their /pokemon-form/ entries for version_group info.
 */
async function fetchFormVersions(pokemon) {
  const formUrls = (pokemon.forms || []).map(f => f.url).filter(Boolean)
  if (formUrls.length === 0) return new Set()

  const additional = new Set()
  await Promise.all(formUrls.map(async (url) => {
    try {
      const res = await fetch(url)
      if (!res.ok) return
      const formData = await res.json()
      const vgName = formData?.version_group?.name
      if (vgName) {
        const versions = versionGroupToVersions[vgName]
        if (versions) versions.forEach(v => additional.add(v))
      }
    } catch (err) {
      // ignore
    }
  }))
  return additional
}

export function usePokemonSpecies(pokemon) {
  const [species, setSpecies] = useState(null)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [allEncounters, setAllEncounters] = useState([])
  const [availableVersions, setAvailableVersions] = useState(new Set())
  // Versions detected solely from species pokedex membership (e.g. legends-za from lumiose-city).
  // Kept separate so VersionSelector can add these without inflating with all base-pokemon versions.
  const [pokedexVersions, setPokedexVersions] = useState(new Set())

  useEffect(() => {
    if (!pokemon) return

    let active = true

    // Fetch species data for more info
    fetch(pokemon.species.url)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setSpecies(data)

        // Detect game availability from pokedex membership
        // (handles games like PLZA where API hasn't populated moves/game_indices)
        const detectedPokedexVersions = []
        for (const entry of (data.pokedex_numbers || [])) {
          const versions = pokedexToVersions[entry.pokedex?.name]
          if (versions) detectedPokedexVersions.push(...versions)
        }
        if (detectedPokedexVersions.length > 0) {
          const pvSet = new Set(detectedPokedexVersions)
          setPokedexVersions(pvSet)
          setAvailableVersions(prev => {
            const updated = new Set(prev)
            detectedPokedexVersions.forEach(v => updated.add(v))
            return updated
          })
        }
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

    // Reset pokedex versions until species loads for the new pokemon
    setPokedexVersions(new Set())

    // Preserve the user's currently selected version when switching Pokémon.
    // If the current selection is not available for the new Pokémon, fall back to the latest.
    const available = getAllAvailableVersions(pokemon)

    if (available.size > 0) {
      if (active) {
        setAvailableVersions(available)
        setSelectedVersion(prev => {
          if (prev && available.has(prev)) return prev
          // Fall back to last game_indices entry, or first available version
          const gameIndices = pokemon.game_indices || []
          if (gameIndices.length > 0) return gameIndices[gameIndices.length - 1].version.name
          return Array.from(available)[0]
        })
      }
    } else {
      // No versions from game_indices/moves — clear stale version immediately,
      // then try form endpoint for version_group info (e.g. PLZA megas)
      if (active) {
        setAvailableVersions(new Set())
        setSelectedVersion(null)
      }
      fetchFormVersions(pokemon).then(formVersions => {
        if (!active) return
        if (formVersions.size > 0) {
          setAvailableVersions(formVersions)
          setSelectedVersion(Array.from(formVersions)[0])
        }
      })
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

  return { species, selectedVersion, setSelectedVersion, allEncounters, availableVersions, pokedexVersions }
}
