import { useState, useEffect, useMemo, useRef } from 'react'
import UnifiedSearch from './UnifiedSearch'
import { versionDisplayNames, versionGeneration, versionAbbreviations, generationVersions, versionColors, defaultVersionGroups, normalizeVersionDetails, isSupportedVersion, compareVersions } from '../utils/versionInfo'
import { fetchLocationCached, fetchLocationAreaCached } from '../utils/pokeCache'
import { titleCase, formatLocationName } from '../utils/format'
import { formatEncounterCondition } from '../utils/encounterConditions'

function formatName(name) {
  return titleCase(name)
    .replace(/Firered/g, 'Fire Red').replace(/Leafgreen/g, 'Leaf Green')
    .replace(/Heartgold/g, 'Heart Gold').replace(/Soulsilver/g, 'Soul Silver')
}

export default function LocationPage({ initialLocation, initialVersion, onStateChange, onPokemonClick, searchLists, onUnifiedNavigate }) {
  const [locationData, setLocationData] = useState(null)
  const [encounters, setEncounters] = useState([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)

  const [selectedVersion, setSelectedVersion] = useState(initialVersion || null)
  const [availableVersions, setAvailableVersions] = useState([])
  const [pendingInitialVersion, setPendingInitialVersion] = useState(initialVersion || null)

  const [sortConfig, setSortConfig] = useState({ key: 'pokemon', direction: 'asc' })
  const [expandedPokemon, setExpandedPokemon] = useState({})
  const [tableFullyExpanded, setTableFullyExpanded] = useState(false)

  // Auto-load location from URL on mount
  const hasLoadedFromUrl = useRef(false)
  useEffect(() => {
    if (hasLoadedFromUrl.current || !initialLocation) return
    hasLoadedFromUrl.current = true
    searchLocation(initialLocation)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute available versions from encounter data
  useEffect(() => {
    if (encounters.length === 0) {
      setAvailableVersions([])
      return
    }

    const versionSet = new Set()
    encounters.forEach(enc => {
      enc.version_details?.forEach(vd => {
        const vName = vd.version?.name
        // Supported versions only (BDSP/PLA have display names but aren't offered)
        if (vName && isSupportedVersion(vName)) versionSet.add(vName)
      })
    })

    const uniqueVersions = Array.from(versionSet).sort(compareVersions)

    const grouped = new Map()
    uniqueVersions.forEach(v => {
      const gen = versionGeneration[v] || 0
      if (!grouped.has(gen)) grouped.set(gen, [])
      grouped.get(gen).push({ display: versionDisplayNames[v] || v, name: v, gen })
    })

    const options = Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, items]) => items)

    setAvailableVersions(options)
  }, [encounters])

  // Auto-select version when available versions change
  useEffect(() => {
    if (availableVersions.length === 0) return
    const allNames = new Set(availableVersions.flat().map(v => v.name))

    if (pendingInitialVersion && allNames.has(pendingInitialVersion)) {
      setSelectedVersion(pendingInitialVersion)
      setPendingInitialVersion(null)
      return
    }
    setPendingInitialVersion(null)

    if (!selectedVersion || !allNames.has(selectedVersion)) {
      const lastGroup = availableVersions[availableVersions.length - 1]
      const fallback = lastGroup[lastGroup.length - 1]?.name
      if (fallback) setSelectedVersion(fallback)
    }
  }, [availableVersions, selectedVersion, pendingInitialVersion])

  // Report state changes to parent for URL sync
  useEffect(() => {
    if (onStateChange && locationData) {
      onStateChange({ version: selectedVersion, location: locationData.name })
    }
  }, [selectedVersion, locationData, onStateChange])

  // Guards against out-of-order async completions: only the latest search may
  // write state (rapid sub-area clicks during a slow parent load interleave).
  const searchSeqRef = useRef(0)

  const searchLocation = async (name) => {
    const query = String(name).trim().toLowerCase().replace(/\s+/g, '-')
    if (!query) return

    const seq = ++searchSeqRef.current
    const isCurrent = () => seq === searchSeqRef.current

    setLocationLoading(true)
    setLocationError(null)
    setLocationData(null)
    setEncounters([])

    try {
      // Try as sub-area (location-area) first
      const areaData = await fetchLocationAreaCached(query)
      if (!isCurrent()) return
      if (areaData && areaData.pokemon_encounters) {
        setLocationData({
          name: areaData.name,
          region: areaData.location?.region || null,
          parentLocation: areaData.location?.name || null,
        })
        // Each encounter is for this sub-area only (DLC version names
        // normalize to their base game, e.g. the-isle-of-armor-sword → sword)
        const allEncounters = areaData.pokemon_encounters.map(pe => ({
          pokemon: pe.pokemon,
          version_details: normalizeVersionDetails(pe.version_details),
          area: areaData.name,
        }))
        setEncounters(allEncounters)
        setLocationLoading(false)
        return
      }

      // Fallback: try as parent location
      const data = await fetchLocationCached(query)
      if (!isCurrent()) return
      if (!data) throw new Error('Location not found')
      setLocationData(data)

      // Fetch all location areas and aggregate encounters
      const areas = data.areas || []
      const allEncounters = []
      const areaResults = await Promise.all(
        areas.map(area => fetchLocationAreaCached(area.url))
      )
      if (!isCurrent()) return
      areaResults.forEach((areaData, i) => {
        if (!areaData?.pokemon_encounters) return
        const areaName = areas[i].name
        areaData.pokemon_encounters.forEach(pe => {
          allEncounters.push({
            pokemon: pe.pokemon,
            version_details: normalizeVersionDetails(pe.version_details),
            area: areaName,
          })
        })
      })

      // Some PokeAPI locations (e.g. Alola double-dash names like
      // "alola-route-1--hauoli-outskirts") are empty shells with no areas.
      // The actual encounter data lives in a location-area whose name
      // collapses the "--" to "-".  Try that as a fallback.
      if (allEncounters.length === 0 && areas.length === 0 && query.includes('--')) {
        const areaName = query.replace(/--/g, '-')
        const fallbackArea = await fetchLocationAreaCached(areaName)
        if (!isCurrent()) return
        if (fallbackArea && fallbackArea.pokemon_encounters?.length > 0) {
          setLocationData({
            name: fallbackArea.name,
            region: fallbackArea.location?.region || data.region || null,
            parentLocation: fallbackArea.location?.name || null,
          })
          fallbackArea.pokemon_encounters.forEach(pe => {
            allEncounters.push({
              pokemon: pe.pokemon,
              version_details: normalizeVersionDetails(pe.version_details),
              area: fallbackArea.name,
            })
          })
        }
      }

      setEncounters(allEncounters)
    } catch (err) {
      if (isCurrent()) setLocationError(err.message || 'Failed to fetch location')
    } finally {
      if (isCurrent()) setLocationLoading(false)
    }
  }

  // Build grouped encounter data for the selected version. Entries are keyed
  // by sub-area + method + levels + conditions, so slot rates only ever sum
  // within one area's encounter table — summing the same combo across a
  // multi-floor location produced impossible >100% rates.
  const encounterGroups = useMemo(() => {
    if (!selectedVersion || encounters.length === 0) return []

    const selectedGen = versionGeneration[selectedVersion] || 0
    const sameGenVersions = new Set(generationVersions[selectedGen] || [])
    const entryKey = (e) => `${e.area}|${e.method}|${e.minLevel}|${e.maxLevel}|${e.conditions.join(',')}`
    const detailToCandidate = (detail, area) => ({
      area: area || '',
      method: detail.method?.name || 'unknown',
      minLevel: detail.min_level || 0,
      maxLevel: detail.max_level || 0,
      conditions: (detail.condition_values || []).map(cv => cv.name).sort(),
    })

    // Group by pokemon — include ALL entries from same-gen versions
    const byPokemon = {}
    encounters.forEach(enc => {
      const pokeName = enc.pokemon.name

      enc.version_details?.forEach(vd => {
        const vName = vd.version?.name
        if (!vName || !sameGenVersions.has(vName) || !vd.encounter_details?.length) return

        if (!byPokemon[pokeName]) byPokemon[pokeName] = { pokemon: pokeName, entries: [], versions: new Set() }

        vd.encounter_details.forEach(detail => {
          const candidate = detailToCandidate(detail, enc.area)
          const chance = detail.chance || 0
          const existing = byPokemon[pokeName].entries.find(e => entryKey(e) === entryKey(candidate))
          if (existing) {
            // Sum slot rates for the selected version only
            if (vName === selectedVersion) {
              existing.rate = (existing.rate ?? 0) + chance
            }
          } else {
            byPokemon[pokeName].entries.push({
              ...candidate,
              // A sibling version's rate would be misleading here — keep null
              // and render it as "—" until the selected version supplies one.
              rate: vName === selectedVersion ? chance : null,
              versions: new Set(),
            })
          }
        })

        byPokemon[pokeName].versions.add(vName)
      })
    })

    // Determine per-pokemon whether it appears in the selected version at all
    Object.values(byPokemon).forEach(group => {
      if (!group.versions.has(selectedVersion)) {
        group.notInSelectedVersion = true
      }
    })

    // Track which same-gen versions each entry appears in
    // (match by area + method + levels + conditions; rates differ per version)
    encounters.forEach(enc => {
      const pokeName = enc.pokemon.name
      if (!byPokemon[pokeName]) return
      enc.version_details?.forEach(vd => {
        const vName = vd.version?.name
        if (!vName || !sameGenVersions.has(vName) || !versionDisplayNames[vName] || !vd.encounter_details?.length) return

        const combos = new Set()
        vd.encounter_details.forEach(detail => {
          combos.add(entryKey(detailToCandidate(detail, enc.area)))
        })

        byPokemon[pokeName].entries.forEach(entry => {
          if (combos.has(entryKey(entry))) {
            entry.versions.add(vName)
          }
        })
      })
    })

    // Mark entries that don't appear in the selected version, and order the
    // expanded view by floor, then method, then level.
    Object.values(byPokemon).forEach(group => {
      group.entries.forEach(entry => {
        entry.notInSelectedVersion = !entry.versions.has(selectedVersion)
      })
      group.entries.sort((a, b) =>
        a.area.localeCompare(b.area) || a.method.localeCompare(b.method) || a.minLevel - b.minLevel)
    })

    return Object.values(byPokemon)
  }, [encounters, selectedVersion])

  // Whether the *rendered* entries span multiple sub-areas (drives the Area
  // column) — derived from the same-generation groups, not all encounters, so
  // an area populated only in another generation doesn't force the column.
  const multiArea = useMemo(() => {
    const areas = new Set()
    encounterGroups.forEach(g => g.entries.forEach(e => { if (e.area) areas.add(e.area) }))
    return areas.size > 1
  }, [encounterGroups])

  // "mt-coronet-1f-route-207" under location "mt-coronet" → "1f Route 207".
  const shortAreaName = (area) => {
    if (!area) return '—'
    const base = locationData?.name
    if (base && area === base) return 'Main area'
    if (base && area.startsWith(base + '-')) {
      const rest = area.slice(base.length + 1)
      return rest === 'area' ? 'Main area' : formatLocationName(rest)
    }
    return formatLocationName(area)
  }

  // When navigating to a new area while fully expanded, auto-expand the new area's collapsible groups
  useEffect(() => {
    if (!tableFullyExpanded) return
    const collapsible = encounterGroups.filter(g => g.entries.length > 1)
    if (collapsible.length === 0) return
    const expanded = {}
    collapsible.forEach(g => { expanded[g.pokemon] = true })
    setExpandedPokemon(expanded)
  }, [encounters, selectedVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
  }

  const sortedGroups = [...encounterGroups].sort((a, b) => {
    let result = 0
    switch (sortConfig.key) {
      case 'pokemon':
        result = a.pokemon.localeCompare(b.pokemon)
        break
      case 'method':
        result = (a.entries[0]?.method || '').localeCompare(b.entries[0]?.method || '')
        break
      case 'rate': {
        // Groups without any selected-version rate sort last in BOTH directions.
        const maxRateA = Math.max(...a.entries.map(e => e.rate ?? -1))
        const maxRateB = Math.max(...b.entries.map(e => e.rate ?? -1))
        const aRated = maxRateA >= 0
        const bRated = maxRateB >= 0
        if (aRated !== bRated) return aRated ? -1 : 1
        result = maxRateA - maxRateB
        break
      }
      default:
        result = a.pokemon.localeCompare(b.pokemon)
    }
    return sortConfig.direction === 'asc' ? result : -result
  })

  const togglePokemon = (name) => {
    setExpandedPokemon(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Get region name from location data
  const regionName = locationData?.region?.name

  return (
    <div className="location-page">
      {/* Search + Version row */}
      <div className="page-search-row">
        <div className="page-version-inline">
          <label htmlFor="location-version-select">Version:</label>
          <select
            id="location-version-select"
            value={selectedVersion || ''}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="version-dropdown"
          >
            {(availableVersions.length > 0 ? availableVersions : defaultVersionGroups).map((group, idx) => {
              const genLabel = group[0]?.gen ? `Gen ${group[0].gen}` : 'Other'
              return (
                <optgroup key={`${genLabel}-${idx}`} label={genLabel}>
                  {group.map(({ display, name }) => (
                    <option key={name} value={name}>{display}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
        <div className="page-search-inline">
          <UnifiedSearch lists={searchLists} onNavigate={onUnifiedNavigate} activeTab="locations" initialQuery={initialLocation || ''} loading={locationLoading} />
        </div>
      </div>

      {locationError && <div className="error">{locationError}</div>}
      {locationLoading && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted playsInline className="loading-pokeball" /></div>}

      {locationData && (
        <>

          {/* Location Details */}
          <div className="location-detail-card">
            <div className="location-detail-header">
              <h2 className="location-detail-name">{formatLocationName(locationData.name)}</h2>
              {regionName && (
                <span className="location-region-badge">{formatName(regionName)}</span>
              )}
              {/* Show parent location if in a sub-area */}
              {locationData.parentLocation && (
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  Parent location:
                  <button
                    type="button"
                    className="location-parent-link"
                    style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline', marginLeft: '6px' }}
                    onClick={() => searchLocation(locationData.parentLocation)}
                  >
                    {formatLocationName(locationData.parentLocation)}
                  </button>
                </div>
              )}
            </div>
            {/* Sub-areas list */}
            {locationData.areas && locationData.areas.length > 0 && (
              <div className="location-subareas-list" style={{ marginTop: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>Sub-areas:</div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px' }}>
                  {locationData.areas.map(area => (
                    <li key={area.name} style={{ marginBottom: '2px' }}>
                      <button
                        type="button"
                        className="location-subarea-link"
                        style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}
                        onClick={() => searchLocation(area.name)}
                      >
                        {formatLocationName(area.name)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Encounters Table */}
          {encounters.length > 0 && selectedVersion ? (
            sortedGroups.length > 0 ? (
              <div className="location-encounters-section">
                <div className="location-encounters-header">
                  <h3>Pokémon in this area</h3>
                  {sortedGroups.some(g => g.entries.length > 1) && (() => {
                    const allExpanded = sortedGroups.filter(g => g.entries.length > 1).every(g => expandedPokemon[g.pokemon])
                    return (
                      <button
                        type="button"
                        className="expand-toggle"
                        title={allExpanded ? 'Collapse all entries' : 'Expand all entries'}
                        onClick={() => {
                          const collapsible = sortedGroups.filter(g => g.entries.length > 1)
                          if (allExpanded) {
                            setExpandedPokemon({})
                            setTableFullyExpanded(false)
                          } else {
                            const expanded = {}
                            collapsible.forEach(g => { expanded[g.pokemon] = true })
                            setExpandedPokemon(prev => ({ ...prev, ...expanded }))
                            setTableFullyExpanded(true)
                          }
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {allExpanded ? (
                            <line x1="5" y1="12" x2="19" y2="12" />
                          ) : (
                            <>
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </>
                          )}
                        </svg>
                      </button>
                    )
                  })()}
                </div>
                <div className="location-encounters-table-wrapper" style={tableFullyExpanded ? { maxHeight: 'none' } : undefined}>
                  <table className="location-encounters-table">
                    <thead>
                      <tr>
                        <th><button type="button" onClick={() => handleSort('method')}>Method{getSortIndicator('method')}</button></th>
                        <th><button type="button" onClick={() => handleSort('pokemon')}>Pokémon{getSortIndicator('pokemon')}</button></th>
                        {multiArea && <th>Area</th>}
                        <th>Levels</th>
                        <th>Condition(s)</th>
                        <th><button type="button" onClick={() => handleSort('rate')}>Rate{getSortIndicator('rate')}</button></th>
                        <th>Versions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGroups.map(group => {
                        const isCollapsible = group.entries.length > 1
                        const isExpanded = !!expandedPokemon[group.pokemon]
                        const selectedGen = versionGeneration[selectedVersion] || 0
                        const sameGenVersions = new Set(generationVersions[selectedGen] || [])

                        // Helper: render version tags with game-colored abbreviations
                        // When rowGreyed is true, the row already has reduced opacity so skip per-tag dimming and color
                        const renderVersionTags = (versions, rowGreyed) => {
                          const sorted = Array.from(versions)
                            .filter(v => versionAbbreviations[v] && sameGenVersions.has(v))
                            .sort((a, b) => (versionGeneration[a] || 0) - (versionGeneration[b] || 0))
                          return sorted.map((v, i) => {
                            const isNonSelected = v !== selectedVersion
                            const color = versionColors[v]
                            const style = rowGreyed
                              ? undefined
                              : {
                                  color: color || undefined,
                                  opacity: isNonSelected ? 0.4 : undefined,
                                  fontWeight: 600,
                                }
                            return (
                              <span key={v}>
                                {i > 0 && ', '}
                                <span className="version-tag" style={style}>
                                  {versionAbbreviations[v]}
                                </span>
                              </span>
                            )
                          })
                        }

                        if (!isCollapsible) {
                          // Single entry — flat row
                          const entry = group.entries[0]
                          const levelDisplay = entry.minLevel === entry.maxLevel
                            ? `Lv. ${entry.minLevel}`
                            : `Lv. ${entry.minLevel}–${entry.maxLevel}`
                          return (
                            <tr key={group.pokemon} className={group.notInSelectedVersion ? 'location-unavailable-row' : ''}>
                              <td className="location-method-cell">{formatName(entry.method)}</td>
                              <td className="location-pokemon-cell">
                                {onPokemonClick
                                  ? <button type="button" className="pokemon-name-link" onClick={() => onPokemonClick(group.pokemon, selectedVersion)}>{formatName(group.pokemon)}</button>
                                  : formatName(group.pokemon)
                                }
                              </td>
                              {multiArea && <td className="location-area-cell">{shortAreaName(entry.area)}</td>}
                              <td className="location-level-cell">{levelDisplay}</td>
                              <td className="location-conditions-cell">
                                {entry.conditions && entry.conditions.length > 0 ? (
                                  <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                                    {entry.conditions.map(c => formatEncounterCondition(c)).join(', ')}
                                  </span>
                                ) : (
                                  <span style={{ color: '#bbb', fontSize: '11px' }}>—</span>
                                )}
                              </td>
                              <td className="location-rate-cell">{entry.rate != null ? `${entry.rate}%` : '—'}</td>
                              <td className="location-versions-cell">{renderVersionTags(group.versions, !!group.notInSelectedVersion)}</td>
                            </tr>
                          )
                        }

                        // Collapsible pokemon row — summarize instead of dashes.
                        // All four summaries use the SAME entry set (selected-version
                        // entries, whole-gen only when the group is entirely greyed)
                        // so one row never mixes selected-version and whole-gen data.
                        const inVersionEntries = group.entries.filter(e => !e.notInSelectedVersion)
                        const summarySource = inVersionEntries.length ? inVersionEntries : group.entries
                        const methods = [...new Set(summarySource.map(e => e.method))]
                        const methodSummary = methods.length === 1
                          ? formatName(methods[0])
                          : `${methods.length} methods`
                        const groupAreas = [...new Set(summarySource.map(e => e.area))]
                        const areaSummary = groupAreas.length === 1
                          ? shortAreaName(groupAreas[0])
                          : `${groupAreas.length} areas`
                        const minLvl = Math.min(...summarySource.map(e => e.minLevel || Infinity))
                        const maxLvl = Math.max(...summarySource.map(e => e.maxLevel || 0))
                        const levelSummary = Number.isFinite(minLvl) && maxLvl > 0
                          ? (minLvl === maxLvl ? `Lv. ${minLvl}` : `Lv. ${minLvl}–${maxLvl}`)
                          : '—'
                        const ratedEntries = summarySource.filter(e => e.rate != null)
                        const maxRate = ratedEntries.length ? Math.max(...ratedEntries.map(e => e.rate)) : null
                        const distinctRates = new Set(ratedEntries.map(e => e.rate))
                        const rateSummary = maxRate != null
                          ? (distinctRates.size > 1 ? `≤ ${maxRate}%` : `${maxRate}%`)
                          : '—'

                        const rows = []
                        rows.push(
                          <tr
                            key={group.pokemon}
                            className={`location-header-row${group.notInSelectedVersion ? ' location-unavailable-row' : ''}`}
                            onClick={() => togglePokemon(group.pokemon)}
                          >
                            <td className="location-method-cell" style={{ color: 'var(--text-muted)' }}>
                              {methodSummary}
                            </td>
                            <td className="location-pokemon-cell">
                              <span className="location-toggle">{isExpanded ? '▾' : '▸'}</span>
                              {onPokemonClick
                                ? <button type="button" className="pokemon-name-link" onClick={(e) => { e.stopPropagation(); onPokemonClick(group.pokemon, selectedVersion) }}>{formatName(group.pokemon)}</button>
                                : formatName(group.pokemon)
                              }
                            </td>
                            {multiArea && <td className="location-area-cell" style={{ color: 'var(--text-muted)' }}>{areaSummary}</td>}
                            <td className="location-level-cell" style={{ color: 'var(--text-muted)' }}>{levelSummary}</td>
                            <td className="location-conditions-cell" style={{ color: 'var(--text-muted)' }}>—</td>
                            <td className="location-rate-cell" style={{ color: 'var(--text-muted)' }}>{rateSummary}</td>
                            <td className="location-versions-cell">{renderVersionTags(group.versions, !!group.notInSelectedVersion)}</td>
                          </tr>
                        )

                        if (isExpanded) {
                          group.entries.forEach((entry, idx) => {
                            const levelDisplay = entry.minLevel === entry.maxLevel
                              ? `Lv. ${entry.minLevel}`
                              : `Lv. ${entry.minLevel}–${entry.maxLevel}`
                            rows.push(
                              <tr key={`${group.pokemon}-${idx}`} className={`location-detail-row${(entry.notInSelectedVersion || group.notInSelectedVersion) ? ' location-unavailable-row' : ''}`}>
                                <td className="location-method-cell">{formatName(entry.method)}</td>
                                <td className="location-pokemon-cell"></td>
                                {multiArea && <td className="location-area-cell">{shortAreaName(entry.area)}</td>}
                                <td className="location-level-cell">{levelDisplay}</td>
                                <td className="location-conditions-cell">
                                  {entry.conditions && entry.conditions.length > 0 ? (
                                    <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                                    {entry.conditions.map(c => formatEncounterCondition(c)).join(', ')}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#bbb', fontSize: '11px' }}>—</span>
                                  )}
                                </td>
                                <td className="location-rate-cell">{entry.rate != null ? `${entry.rate}%` : '—'}</td>
                                <td className="location-versions-cell">
                                  {renderVersionTags(entry.versions || new Set(), !!(entry.notInSelectedVersion || group.notInSelectedVersion))}
                                </td>
                              </tr>
                            )
                          })
                        }

                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="location-no-encounters">No Pokémon encounters in this version.</div>
            )
          ) : encounters.length > 0 ? (
            <div className="location-no-encounters">Select a version to see encounters.</div>
          ) : (
            <div className="location-no-encounters">No encounter data available for this location.</div>
          )}
        </>
      )}
    </div>
  )
}
