import { useState, useEffect } from 'react'
import { versionDisplayNames, versionGeneration, versionGroupToVersions, isSupportedVersion, compareVersions } from '../utils/versionInfo'

export default function VersionSelector({ pokemon, selectedVersion, onVersionChange, allEncounters, pokedexVersions, formVersionFilter }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)

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
        // Only supported versions (Gens 1-8 SWSH; hides BDSP/PLA/Gen 9 and
        // unrecognized names like red-japan)
        .filter(v => isSupportedVersion(v))
        .sort(compareVersions)

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
        <div className="version-loading"><video src="/simple_pokeball.webm" autoPlay loop muted playsInline className="loading-pokeball-inline" /></div>
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
