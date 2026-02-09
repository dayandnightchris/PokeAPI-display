import { useState, useEffect } from 'react'

export default function VersionSelector({ pokemon, selectedVersion, onVersionChange }) {
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
    'sword': 'Sword',
    'shield': 'Shield',
    'brilliant-diamond': 'Brilliant Diamond',
    'shining-pearl': 'Shining Pearl',
    'legends-arceus': 'Legends: Arceus',
    'scarlet': 'Scarlet',
    'violet': 'Violet',
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
    'sword': 8, 'shield': 8, 'brilliant-diamond': 8, 'shining-pearl': 8, 'legends-arceus': 8,
    'scarlet': 9, 'violet': 9,
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

      const uniqueVersions = Array.from(versionSet).sort((a, b) => {
        const genA = versionGeneration[a] || 0
        const genB = versionGeneration[b] || 0
        if (genA !== genB) return genA - genB
        return a.localeCompare(b)
      })

      // Build version options
      const versionOptions = uniqueVersions.map(version => ({
        display: versionDisplayNames[version] || version,
        name: version
      }))

      setVersions(versionOptions)
    } catch (err) {
      console.error('Failed to extract versions:', err)
    } finally {
      setLoading(false)
    }
  }, [pokemon])

  const handleVersionChange = (e) => {
    const version = e.target.value
    onVersionChange(version)
  }

  if (loading) {
    return (
      <div className="version-selector">
        <label>Game Version:</label>
        <div className="version-loading">Loading versions...</div>
      </div>
    )
  }

  if (versions.length === 0) {
    return null
  }

  return (
    <div className="version-selector">
      <label htmlFor="version-select">Game Version:</label>
      <select
        id="version-select"
        value={selectedVersion || ''}
        onChange={handleVersionChange}
        className="version-dropdown"
      >
        {versions.map(({ display, name }) => (
          <option key={name} value={name}>
            {display}
          </option>
        ))}
      </select>
    </div>
  )
}
