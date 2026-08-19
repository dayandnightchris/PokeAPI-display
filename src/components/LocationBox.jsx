import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { versionDisplayNames, versionGeneration, generationVersions, canTradeBetween, versionGroupForVersion, getTransferSourceVersionGroups } from '../utils/versionInfo'
import { titleCase, formatLocationName } from '../utils/format'
import { formatEncounterCondition } from '../utils/encounterConditions'

// A hover/tap tooltip rendered into a body-level portal so it escapes the
// Location box's overflow clipping (the encounter table needs to scroll, which
// would otherwise crop or scroll this tooltip). Positioned with `fixed` from
// the trigger's bounding rect.
function PortalTooltip({ label, className, children }) {
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)

  const open = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 6, left: r.left + r.width / 2 })
  }
  const close = () => setCoords(null)

  // A fixed-positioned tooltip would detach from the trigger on scroll/resize.
  useEffect(() => {
    if (!coords) return
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [coords])

  return (
    <span
      ref={triggerRef}
      className="tooltip-trigger"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') open() }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') close() }}
      onClick={() => (coords ? close() : open())}
    >
      {label}
      {coords && createPortal(
        <span className={`portal-tooltip ${className || ''}`} style={{ top: coords.top, left: coords.left }}>
          {children}
        </span>,
        document.body
      )}
    </span>
  )
}

export default function LocationBox({
  selectedVersion,
  allEncounters,
  expandedLocations,
  setExpandedLocations,
  onLocationClick,
  species,
  canEvolveFrom,
  canEvolveFromChain,
  evolveSteps,
  canTradeAndEvolveFrom,
  evoFamilyVersions,
}) {
  // "Catch X and evolve" — with the evolution method(s) shown on hover over
  // "evolve" (reusing the evolution-line details), e.g. "Jolteon: Use thunder stone".
  const renderCatchAndEvolve = () => {
    const catchText = canEvolveFromChain.length > 1
      ? canEvolveFromChain.map(titleCase).join(' or ')
      : titleCase(canEvolveFrom)
    const hasSteps = evolveSteps && evolveSteps.length > 0
    return (
      <p style={{ margin: '0' }}>
        Catch {catchText} and{' '}
        {hasSteps ? (
          <PortalTooltip label="evolve" className="evolve-method-tooltip">
            {evolveSteps.map((s, i) => (
              <span key={i} className="evolve-method-row">
                <strong>{titleCase(s.to)}</strong>: {s.method}
              </span>
            ))}
          </PortalTooltip>
        ) : 'evolve'}.
      </p>
    )
  }

  return (
          <div className="info-box location-box">
            <div className="box-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Location</span>
              {(() => {
                if (!selectedVersion || allEncounters.length === 0) return null
                const locCounts = {}
                allEncounters.forEach(enc => {
                  const vd = enc.version_details?.find(v => v.version.name === selectedVersion)
                  if (vd?.encounter_details?.length > 0) {
                    const loc = enc.location_area.name
                    locCounts[loc] = (locCounts[loc] || 0) + vd.encounter_details.length
                  }
                })
                const collapsible = Object.entries(locCounts).filter(([, count]) => count > 1)
                if (collapsible.length === 0) return null
                const allExp = collapsible.every(([loc]) => expandedLocations[loc])
                return (
                  <button
                    type="button"
                    className="expand-toggle"
                    title={allExp ? 'Collapse all entries' : 'Expand all entries'}
                    onClick={() => {
                      if (allExp) {
                        setExpandedLocations({})
                      } else {
                        const expanded = {}
                        collapsible.forEach(([loc]) => { expanded[loc] = true })
                        setExpandedLocations(prev => ({ ...prev, ...expanded }))
                      }
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {allExp ? (
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
            <div className="box-content" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {selectedVersion && allEncounters.length > 0 ? (
                (() => {
                  const encountersByLocation = {}
                  allEncounters.forEach(enc => {
                    const versionDetail = enc.version_details?.find(vd => vd.version.name === selectedVersion)
                    if (versionDetail && versionDetail.encounter_details?.length > 0) {
                      const locationName = enc.location_area.name
                      if (!encountersByLocation[locationName]) {
                        encountersByLocation[locationName] = []
                      }
                      versionDetail.encounter_details.forEach(detail => {
                        const methodName = detail.method?.name || 'unknown'
                        const conditions = (detail.condition_values || []).map(cv => cv.name).sort()
                        encountersByLocation[locationName].push({
                          method: methodName,
                          rate: detail.chance || 0,
                          minLevel: detail.min_level,
                          maxLevel: detail.max_level,
                          conditions
                        })
                      })
                    }
                  })

                  const hasEncounters = Object.keys(encountersByLocation).length > 0
                  if (hasEncounters) {
                    const toggleLocation = (loc) => {
                      setExpandedLocations(prev => ({ ...prev, [loc]: !prev[loc] }))
                    }
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Location</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Method</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center' }}><span className="hide-mobile">Level</span><span className="show-mobile">Lvl</span></th>
                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(encountersByLocation).map(([location, entryList]) => {
                            const isCollapsible = entryList.length > 1
                            const isExpanded = !!expandedLocations[location]

                            if (!isCollapsible) {
                              // Single entry — flat row
                              const entry = entryList[0]
                              const methodDisplay = titleCase(entry.method)
                              const levelDisplay = entry.minLevel === entry.maxLevel
                                ? `${entry.minLevel}`
                                : `${entry.minLevel}–${entry.maxLevel}`
                              return (
                                <tr key={location} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '6px 8px' }}>
                                    {onLocationClick
                                      ? <button type="button" className="pokemon-name-link" onClick={() => onLocationClick(location)}>{formatLocationName(location)}</button>
                                      : formatLocationName(location)
                                    }
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {methodDisplay}
                                    {entry.conditions.length > 0 && (
                                      <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                                        {entry.conditions.map(formatEncounterCondition).join(', ')}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{levelDisplay}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{entry.rate}%</td>
                                </tr>
                              )
                            }

                            // Collapsible location — multiple entries
                            const rows = []
                            rows.push(
                              <tr
                                key={location}
                                className="location-header-row"
                                style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                                onClick={() => toggleLocation(location)}
                              >
                                <td style={{ padding: '6px 8px' }}>
                                  <span className="location-toggle">{isExpanded ? '▾' : '▸'}</span>
                                  {onLocationClick
                                    ? <button type="button" className="pokemon-name-link" onClick={(e) => { e.stopPropagation(); onLocationClick(location) }}>{formatLocationName(location)}</button>
                                    : formatLocationName(location)
                                  }
                                </td>
                                <td style={{ padding: '6px 8px', color: '#888' }}>
                                  {entryList.length} entries
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#888' }}>—</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#888' }}>—</td>
                              </tr>
                            )

                            if (isExpanded) {
                              entryList.forEach((entry, idx) => {
                                const methodDisplay = titleCase(entry.method)
                                const levelDisplay = entry.minLevel === entry.maxLevel
                                  ? `${entry.minLevel}`
                                  : `${entry.minLevel}–${entry.maxLevel}`
                                return rows.push(
                                  <tr
                                    key={`${location}-${idx}`}
                                    className="location-detail-row"
                                    style={{ borderBottom: '1px solid #eee' }}
                                  >
                                    <td style={{ padding: '4px 8px 4px 24px' }}>
                                      {entry.conditions.length > 0 && (
                                        <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                                          {entry.conditions.map(formatEncounterCondition).join(', ')}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      {methodDisplay}
                                    </td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{levelDisplay}</td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{entry.rate}%</td>
                                  </tr>
                                )
                              })
                            }

                            return rows
                          })}
                        </tbody>
                      </table>
                    )
                  }

                  // --- No wild encounters for this version: priority fallback ---
                  // Priority 1: Can it evolve from a pre-evolution available in this game?
                  if (canEvolveFrom) {
                    return renderCatchAndEvolve()
                  }

                  // Priority 1b: Breeding (available in all games except RBY, Colosseum, XD, LGPE, Legends Arceus, Legends Z-A)
                  // Only suggest breeding if some member of the evo family has encounters in this version
                  const NO_BREEDING_VERSIONS = new Set(['red', 'blue', 'yellow', 'colosseum', 'xd', 'lets-go-pikachu', 'lets-go-eevee', 'legends-arceus', 'legends-za'])
                  const breedingAvailable = !NO_BREEDING_VERSIONS.has(selectedVersion)
                  const hasEvoFamilyInVersion = evoFamilyVersions.includes(selectedVersion)
                  const isBreedable = !species?.egg_groups?.every(g => g.name === 'no-eggs') || species?.is_baby
                  const canBreed = breedingAvailable && hasEvoFamilyInVersion && isBreedable
                  if (canBreed) {
                    return <p style={{ margin: '0' }}>Obtain through breeding.</p>
                  }

                  // Priority 1c: Trade for a bred Pokémon — evo family exists in other same-gen games
                  // (that can actually trade with this one — LGPE is isolated)
                  if (breedingAvailable && isBreedable && evoFamilyVersions.length > 0) {
                    const tradeBreedVersions = evoFamilyVersions.filter(v => v !== selectedVersion && canTradeBetween(selectedVersion, v))
                    if (tradeBreedVersions.length > 0) {
                      const tradeNames = tradeBreedVersions.map(v => versionDisplayNames[v] || v).join(', ')
                      return <p style={{ margin: '0' }}>Trade from {tradeNames}.</p>
                    }
                  }

                  // Priority 2: Can it be traded from another game in this gen?
                  const currentGen = versionGeneration[selectedVersion]
                  if (currentGen) {
                    const genVersions = generationVersions[currentGen] || []
                    // Only consider versions where the Pokémon has actual wild encounters
                    const versionsWithEncounters = new Set()
                    allEncounters.forEach(enc => {
                      enc.version_details?.forEach(vd => {
                        if (vd.version?.name && vd.encounter_details?.length > 0) {
                          versionsWithEncounters.add(vd.version.name)
                        }
                      })
                    })
                    const otherGenVersions = genVersions.filter(
                      v => v !== selectedVersion && versionsWithEncounters.has(v) && canTradeBetween(selectedVersion, v)
                    )
                    if (otherGenVersions.length > 0) {
                      const tradeNames = otherGenVersions.map(v => versionDisplayNames[v] || v).join(', ')
                      return <p style={{ margin: '0' }}>Trade from {tradeNames}.</p>
                    }
                  }

                  // Priority 2b: Can a pre-evolution be traded from another game and then evolved?
                  if (canTradeAndEvolveFrom) {
                    const tradableFrom = canTradeAndEvolveFrom.tradeVersions.filter(v => canTradeBetween(selectedVersion, v))
                    if (tradableFrom.length > 0) {
                      const tradeNames = tradableFrom.map(v => versionDisplayNames[v] || v).join(', ')
                      const preEvoName = titleCase(canTradeAndEvolveFrom.preEvo)
                      return <p style={{ margin: '0' }}>Trade from {tradeNames} and/or evolve from {preEvoName}.</p>
                    }
                  }

                  // Priority 3: Transfer — only if this version can actually receive transfers
                  // (Gen 3 cannot; LGPE only receives from Pokémon GO — Meltan's sole source).
                  const vgForTransfer = versionGroupForVersion(selectedVersion)
                  if (vgForTransfer === 'lets-go-pikachu-lets-go-eevee') {
                    return <p style={{ margin: '0' }}>Transfer from Pokémon GO.</p>
                  }
                  const transferSources = getTransferSourceVersionGroups(selectedVersion, vgForTransfer)
                  return <p style={{ margin: '0' }}>{transferSources ? 'Transfer only.' : 'Not obtainable in this version.'}</p>
                })()
              ) : allEncounters.length === 0 && selectedVersion ? (
                (() => {
                  // No encounter data at all from the API — same priority fallback
                  if (canEvolveFrom) {
                    return renderCatchAndEvolve()
                  }

                  // Priority 1b: Breeding — even though this Pokémon has no encounters,
                  // an evo-family member might exist in this version (e.g. Magby via Magmar in LeafGreen)
                  const NO_BREEDING_VERSIONS2 = new Set(['red', 'blue', 'yellow', 'colosseum', 'xd', 'lets-go-pikachu', 'lets-go-eevee', 'legends-arceus', 'legends-za'])
                  const breedingAvailable2 = !NO_BREEDING_VERSIONS2.has(selectedVersion)
                  const hasEvoFamilyInVersion2 = evoFamilyVersions.includes(selectedVersion)
                  const isBreedable2 = !species?.egg_groups?.every(g => g.name === 'no-eggs') || species?.is_baby
                  const canBreed2 = breedingAvailable2 && hasEvoFamilyInVersion2 && isBreedable2
                  if (canBreed2) {
                    return <p style={{ margin: '0' }}>Obtain through breeding.</p>
                  }

                  // Priority 1c: Trade for a bred Pokémon — evo family exists in other same-gen games
                  // (that can actually trade with this one — LGPE is isolated)
                  if (breedingAvailable2 && isBreedable2 && evoFamilyVersions.length > 0) {
                    const tradeBreedVersions = evoFamilyVersions.filter(v => v !== selectedVersion && canTradeBetween(selectedVersion, v))
                    if (tradeBreedVersions.length > 0) {
                      const tradeNames = tradeBreedVersions.map(v => versionDisplayNames[v] || v).join(', ')
                      return <p style={{ margin: '0' }}>Trade from {tradeNames}.</p>
                    }
                  }

                  // Check if a pre-evo can be traded from another same-gen game and evolved
                  if (canTradeAndEvolveFrom) {
                    const tradableFrom = canTradeAndEvolveFrom.tradeVersions.filter(v => canTradeBetween(selectedVersion, v))
                    if (tradableFrom.length > 0) {
                      const tradeNames = tradableFrom.map(v => versionDisplayNames[v] || v).join(', ')
                      const preEvoName = titleCase(canTradeAndEvolveFrom.preEvo)
                      return <p style={{ margin: '0' }}>Trade from {tradeNames} and/or evolve from {preEvoName}.</p>
                    }
                  }

                  // No wild encounters exist in any version — transfer only if this
                  // version can actually receive transfers (Gen 3 cannot; LGPE only
                  // receives from Pokémon GO — Meltan's sole source).
                  const vgForTransfer2 = versionGroupForVersion(selectedVersion)
                  if (vgForTransfer2 === 'lets-go-pikachu-lets-go-eevee') {
                    return <p style={{ margin: '0' }}>Transfer from Pokémon GO.</p>
                  }
                  const transferSources2 = getTransferSourceVersionGroups(selectedVersion, vgForTransfer2)
                  return <p style={{ margin: '0' }}>{transferSources2 ? 'Transfer only.' : 'Not obtainable in this version.'}</p>
                })()
              ) : allEncounters.length === 0 ? (
                <p style={{ margin: '0' }}>No location data available.</p>
              ) : (
                <p style={{ margin: '0' }}>Select a version to see locations.</p>
              )}
            </div>
          </div>
  )
}
