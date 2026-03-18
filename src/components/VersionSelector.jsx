import { useState, useEffect } from 'react'

export default function VersionSelector({ pokemon, selectedVersion, onVersionChange, allEncounters, pokedexVersions, formVersionFilter }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)

  // Map individual version names to display names
  const versionDisplayNames = {
    'red': 'Red',
    'blue': 'Blue',
    'yellow': 'Yellow',
    'gold': 'Gold',
    'silver': 'Silver',
    'crystal': 'Crystal',
    'ruby': 'Ruby',
    'sapphire': 'Sapphire',
    'emerald': 'Emerald',
    'firered': 'FireRed',
    'leafgreen': 'LeafGreen',
    'colosseum': 'Colosseum',
    'xd': 'XD',
    'diamond': 'Diamond',
    'pearl': 'Pearl',
    'platinum': 'Platinum',
    'heartgold': 'HeartGold',
    'soulsilver': 'SoulSilver',
    'black': 'Black',
    'white': 'White',
    'black-2': 'Black 2',
    'white-2': 'White 2',
    'x': 'X',
    'y': 'Y',
    'omega-ruby': 'Omega Ruby',
    'alpha-sapphire': 'Alpha Sapphire',
    'sun': 'Sun',
    'moon': 'Moon',
    'ultra-sun': 'Ultra Sun',
    'ultra-moon': 'Ultra Moon',
    'lets-go-pikachu': "Let's Go Pikachu",
    'lets-go-eevee': "Let's Go Eevee",
    'sword': 'Sword',
    'shield': 'Shield',
    'brilliant-diamond': 'Brilliant Diamond',
    'shining-pearl': 'Shining Pearl',
    'legends-arceus': 'Legends: Arceus',
    'scarlet': 'Scarlet',
    'violet': 'Violet',
    'legends-za': 'Legends: Z-A',
  }

  // Map versions to generation number for sorting
  const versionGeneration = {
    'red': 1, 'blue': 1, 'yellow': 1,
    'gold': 2, 'silver': 2, 'crystal': 2,
    'ruby': 3, 'sapphire': 3, 'emerald': 3, 'firered': 3, 'leafgreen': 3,
    'colosseum': 3, 'xd': 3,
    'diamond': 4, 'pearl': 4, 'platinum': 4, 'heartgold': 4, 'soulsilver': 4,
    'black': 5, 'white': 5, 'black-2': 5, 'white-2': 5,
    'x': 6, 'y': 6, 'omega-ruby': 6, 'alpha-sapphire': 6,
    'sun': 7, 'moon': 7, 'ultra-sun': 7, 'ultra-moon': 7,
    'lets-go-pikachu': 7, 'lets-go-eevee': 7,
    'sword': 8, 'shield': 8, 'brilliant-diamond': 8, 'shining-pearl': 8, 'legends-arceus': 8,
    'scarlet': 9, 'violet': 9, 'legends-za': 9,
  }

  // Map version groups to individual version names
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
    'lets-go-pikachu-lets-go-eevee': ['lets-go-pikachu', 'lets-go-eevee'],
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

  useEffect(() => {
    if (!pokemon) return
    
    setLoading(true)
    try {
      // Get all unique versions from game_indices
      const versionSet = new Set()
      
      if (pokemon.game_indices && pokemon.game_indices.length > 0) {
        pokemon.game_indices.forEach(gameIndex => {
          const versionName = gameIndex.version.name
          versionSet.add(versionName)
        })
      }

      if (allEncounters && allEncounters.length > 0) {
        allEncounters.forEach(encounter => {
          encounter.version_details?.forEach(detail => {
            const versionName = detail.version?.name
            if (versionName) versionSet.add(versionName)
          })
        })
      }

      // Also pull version groups from moves data (game_indices stops at Gen 5)
      if (pokemon.moves && pokemon.moves.length > 0) {
        const moveVersionGroups = new Set()
        pokemon.moves.forEach(move => {
          move.version_group_details?.forEach(vgd => {
            const vgName = vgd.version_group?.name
            if (vgName) moveVersionGroups.add(vgName)
          })
        })
        moveVersionGroups.forEach(vg => {
          const versions = versionGroupToVersions[vg]
          if (versions) {
            versions.forEach(v => versionSet.add(v))
          }
        })
      }

      // Include versions detected from species pokedex membership
      // (e.g. legends-za from the lumiose-city pokedex)
      if (pokedexVersions) {
        pokedexVersions.forEach(v => {
          if (versionDisplayNames[v]) versionSet.add(v)
        })
      }

      // If the selected form is version-exclusive, restrict to those versions only
      if (formVersionFilter) {
        const filtered = new Set()
        formVersionFilter.forEach(v => {
          if (versionDisplayNames[v]) filtered.add(v)
        })
        // Replace the computed set entirely
        versionSet.clear()
        filtered.forEach(v => versionSet.add(v))
      }

      // Fallback: if no versions found from pokemon data but parent already
      // resolved a selectedVersion (e.g. via form endpoint), include it
      if (versionSet.size === 0 && selectedVersion && versionDisplayNames[selectedVersion]) {
        versionSet.add(selectedVersion)
      }

      const uniqueVersions = Array.from(versionSet)
        // Only include recognized versions, and temporarily hide Gen 8+ and gen 0 (red-japan, green-japan)
        .filter(v => versionDisplayNames[v] && (versionGeneration[v] || 0) < 8)
        .sort((a, b) => {
        const genA = versionGeneration[a] || 0
        const genB = versionGeneration[b] || 0
        if (genA !== genB) return genA - genB
        return (versionDisplayNames[a] || a).localeCompare(versionDisplayNames[b] || b)
      })

      const grouped = new Map()
      uniqueVersions.forEach(version => {
        const gen = versionGeneration[version] || 0
        if (!grouped.has(gen)) grouped.set(gen, [])
        grouped.get(gen).push({
          display: versionDisplayNames[version] || version,
          name: version,
          gen
        })
      })

      const versionOptions = Array.from(grouped.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, items]) => items)

      setVersions(versionOptions)
    } catch (err) {
      console.error('Failed to extract versions:', err)
    } finally {
      setLoading(false)
    }
  }, [pokemon, allEncounters, selectedVersion, pokedexVersions, formVersionFilter])

  useEffect(() => {
    if (versions.length === 0) return

    // Build a flat set of all available version names
    const allVersionNames = new Set(versions.flat().map(v => v.name))

    if (!selectedVersion || !allVersionNames.has(selectedVersion)) {
      // Current selection is missing or not in the new list — pick the latest available
      const lastGroup = versions[versions.length - 1]
      const fallback = lastGroup[lastGroup.length - 1]?.name || versions[0][0]?.name
      if (fallback) onVersionChange(fallback)
    }
  }, [selectedVersion, versions, onVersionChange])

  const handleVersionChange = (e) => {
    const version = e.target.value
    onVersionChange(version)
  }

  if (loading) {
    return (
      <div className="version-selector">
        <label>Version:</label>
        <div className="version-loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball-inline" /></div>
      </div>
    )
  }

  if (versions.length === 0) {
    return null
  }

  return (
    <div className="version-selector">
      <label htmlFor="version-select">Version:</label>
      <select
        id="version-select"
        value={selectedVersion || ''}
        onChange={handleVersionChange}
        className="version-dropdown"
      >
        {versions.map((group, idx) => {
          const genLabel = group[0]?.gen ? `Gen ${group[0].gen}` : 'Other'
          return (
            <optgroup key={`${genLabel}-${idx}`} label={genLabel}>
              {group.map(({ display, name }) => (
                <option key={name} value={name}>
                  {display}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </div>
  )
}
