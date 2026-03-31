import { useState, useEffect, useRef, useCallback } from 'react'
import UnifiedSearch from './UnifiedSearch'
import { fetchPokemonCached, fetchMoveCached, fetchSpeciesCached, preloadPokemonCache } from '../utils/pokeCache'
import {
  versionGeneration, generationVersionGroups, versionGroupOrder,
  versionGroupDisplayNames, versionDisplayNames,
} from '../utils/versionInfo'

function formatName(name) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const typeColors = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC', unknown: '#4D7A70',
}
const getTypeColor = (t) => typeColors[t?.toLowerCase()] || '#999'
const getTypeTextColor = (t) => {
  const hex = getTypeColor(t)
  const r = parseInt(hex.slice(1,3), 16) / 255
  const g = parseInt(hex.slice(3,5), 16) / 255
  const b = parseInt(hex.slice(5,7), 16) / 255
  const lum = 0.2126 * (r <= 0.03928 ? r/12.92 : ((r+0.055)/1.055)**2.4)
            + 0.7152 * (g <= 0.03928 ? g/12.92 : ((g+0.055)/1.055)**2.4)
            + 0.0722 * (b <= 0.03928 ? b/12.92 : ((b+0.055)/1.055)**2.4)
  return lum > 0.35 ? '#333' : '#fff'
}

// Map version group name → Set of individual version names
const versionGroupToVersions = {
  'red-blue': ['red', 'blue'], 'yellow': ['yellow'],
  'gold-silver': ['gold', 'silver'], 'crystal': ['crystal'],
  'ruby-sapphire': ['ruby', 'sapphire'], 'emerald': ['emerald'],
  'firered-leafgreen': ['firered', 'leafgreen'], 'colosseum': ['colosseum'], 'xd': ['xd'],
  'diamond-pearl': ['diamond', 'pearl'], 'platinum': ['platinum'], 'heartgold-soulsilver': ['heartgold', 'soulsilver'],
  'black-white': ['black', 'white'], 'black-2-white-2': ['black-2', 'white-2'],
  'x-y': ['x', 'y'], 'omega-ruby-alpha-sapphire': ['omega-ruby', 'alpha-sapphire'],
  'sun-moon': ['sun', 'moon'], 'ultra-sun-ultra-moon': ['ultra-sun', 'ultra-moon'],
  'lets-go-pikachu-lets-go-eevee': ['lets-go-pikachu', 'lets-go-eevee'],
  'sword-shield': ['sword', 'shield'], 'the-isle-of-armor': ['sword', 'shield'],
  'the-crown-tundra': ['sword', 'shield'],
  'brilliant-diamond-and-shining-pearl': ['brilliant-diamond', 'shining-pearl'],
  'legends-arceus': ['legends-arceus'],
  'scarlet-violet': ['scarlet', 'violet'], 'the-teal-mask': ['scarlet', 'violet'],
  'the-indigo-disk': ['scarlet', 'violet'],
  'legends-za': ['legends-za'], 'mega-dimension': ['scarlet', 'violet'],
}

// No breeding in these version groups
const NO_BREEDING_VGS = new Set([
  'red-blue', 'yellow',
  'colosseum', 'xd',
  'lets-go-pikachu-lets-go-eevee',
  'legends-arceus', 'legends-za',
])

export default function EggMoveTab({
  initialPokemon, initialVersion, onStateChange, onPokemonClick,
  searchLists, onUnifiedNavigate, onMoveClick,
}) {
  const [pokemonName, setPokemonName] = useState(initialPokemon || null)
  const [pokemonData, setPokemonData] = useState(null)
  const [speciesData, setSpeciesData] = useState(null)
  const [eggMoves, setEggMoves] = useState([]) // [{name, versionGroups: Set}]
  const [parentsByMove, setParentsByMove] = useState({}) // moveName → [{name, sprite, methods: [{method, versionGroups}]}]
  const [expandedMoves, setExpandedMoves] = useState({})
  const [tableFullyExpanded, setTableFullyExpanded] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(initialVersion || null)
  const [availableVersions, setAvailableVersions] = useState([])
  const [loadingPokemon, setLoadingPokemon] = useState(false)
  const [loadingParents, setLoadingParents] = useState({}) // moveName → bool
  const [error, setError] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'move', direction: 'asc' })

  const requestIdRef = useRef(0)

  // Compute available versions from egg move data
  useEffect(() => {
    if (!eggMoves || eggMoves.length === 0) {
      setAvailableVersions([])
      return
    }

    // Collect all version groups that have egg moves
    const allVgs = new Set()
    eggMoves.forEach(m => {
      m.versionGroups.forEach(vg => {
        if (!NO_BREEDING_VGS.has(vg)) allVgs.add(vg)
      })
    })

    // Map to individual versions, grouped by generation
    const versionSet = new Set()
    allVgs.forEach(vg => {
      const versions = versionGroupToVersions[vg]
      if (versions) versions.forEach(v => versionSet.add(v))
    })

    // Remove versions from no-breeding games
    const noBreeders = new Set(['red', 'blue', 'yellow', 'colosseum', 'xd', 'lets-go-pikachu', 'lets-go-eevee', 'legends-arceus', 'legends-za'])
    noBreeders.forEach(v => versionSet.delete(v))

    // Group by generation (exclude Gen 8+)
    const grouped = {}
    versionSet.forEach(v => {
      const gen = versionGeneration[v]
      if (!gen || gen >= 8) return
      if (!grouped[gen]) grouped[gen] = []
      grouped[gen].push({ name: v, display: versionDisplayNames[v] || formatName(v), gen })
    })

    // Sort and build groups array
    const groups = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(gen => grouped[gen].sort((a, b) => a.display.localeCompare(b.display)))

    setAvailableVersions(groups)

    // Auto-select version
    if (selectedVersion && versionSet.has(selectedVersion)) return
    if (groups.length > 0) {
      const lastGen = groups[groups.length - 1]
      setSelectedVersion(lastGen[0]?.name || null)
    }
  }, [eggMoves]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ version: selectedVersion, eggmoves: pokemonName })
    }
  }, [selectedVersion, pokemonName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load a Pokémon and extract its egg moves
  const loadPokemon = useCallback(async (name) => {
    if (!name) return
    const cleanName = String(name).trim().toLowerCase()
    const myReq = ++requestIdRef.current

    setPokemonName(cleanName)
    setLoadingPokemon(true)
    setError(null)
    setEggMoves([])
    setParentsByMove({})
    setExpandedMoves({})
    setTableFullyExpanded(false)

    try {
      const pData = await fetchPokemonCached(cleanName)
      if (!pData) throw new Error('Pokémon not found')
      if (requestIdRef.current !== myReq) return

      // If this is a non-default form, load base species
      let speciesName = pData.species?.name || cleanName
      const sData = await fetchSpeciesCached(speciesName)
      if (requestIdRef.current !== myReq) return

      setPokemonData(pData)
      setSpeciesData(sData)

      // Extract egg moves with version group info
      const eggs = []
      const seen = new Set()
      pData.moves.forEach(moveData => {
        const moveName = moveData.move.name
        const vgs = new Set()
        ;(moveData.version_group_details || []).forEach(vgd => {
          if (vgd.move_learn_method?.name === 'egg') {
            const vgName = vgd.version_group?.name
            if (vgName) vgs.add(vgName)
          }
        })
        if (vgs.size > 0 && !seen.has(moveName)) {
          seen.add(moveName)
          eggs.push({ name: moveName, versionGroups: vgs })
        }
      })

      setEggMoves(eggs)

      if (eggs.length === 0) {
        setError(`${formatName(cleanName)} has no egg moves.`)
      }
    } catch (err) {
      if (requestIdRef.current === myReq) {
        setError(err.message || 'Failed to load Pokémon')
      }
    } finally {
      if (requestIdRef.current === myReq) {
        setLoadingPokemon(false)
      }
    }
  }, [])

  // Auto-load from URL params
  useEffect(() => {
    if (initialPokemon) loadPokemon(initialPokemon)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch parents for a specific egg move when expanded
  const fetchParentsForMove = useCallback(async (moveName) => {
    if (parentsByMove[moveName]) return // Already loaded

    setLoadingParents(prev => ({ ...prev, [moveName]: true }))

    try {
      // Fetch the move to get learned_by_pokemon
      const moveData = await fetchMoveCached(moveName)
      if (!moveData || !moveData.learned_by_pokemon) {
        setParentsByMove(prev => ({ ...prev, [moveName]: [] }))
        return
      }

      // Get target Pokémon's egg groups
      const targetEggGroups = new Set(
        (speciesData?.egg_groups || []).map(g => g.name)
      )

      // If target is in "no-eggs" group (Undiscovered), show all learners
      const isUndiscovered = targetEggGroups.has('no-eggs')

      // Collect all learner names
      const learnerNames = moveData.learned_by_pokemon.map(p => p.name)

      // Filter out Gen 8+ pokemon (id >= 810)
      const filteredLearners = moveData.learned_by_pokemon.filter(p => {
        const idMatch = p.url?.match(/\/pokemon\/(\d+)\/?$/)
        if (idMatch && Number(idMatch[1]) >= 810) return false
        return true
      })

      // Preload pokemon cache for batch IDB load
      await preloadPokemonCache(filteredLearners.map(p => p.name))

      // For each learner, check if they share an egg group with the target
      // and determine how they learn the move
      const parents = []
      const BATCH_SIZE = 20
      for (let i = 0; i < filteredLearners.length; i += BATCH_SIZE) {
        const batch = filteredLearners.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(batch.map(async (learner) => {
          try {
            const learnerPoke = await fetchPokemonCached(learner.name)
            if (!learnerPoke) return null

            const learnerSpeciesName = learnerPoke.species?.name || learner.name
            const learnerSpecies = await fetchSpeciesCached(learnerSpeciesName)
            if (!learnerSpecies) return null

            // Check egg group compatibility
            const learnerGroups = new Set((learnerSpecies.egg_groups || []).map(g => g.name))

            // Skip if no shared egg group (unless target is undiscovered)
            if (!isUndiscovered) {
              const shared = [...targetEggGroups].some(g => learnerGroups.has(g))
              if (!shared) return null
            }

            // Skip if learner is also in "no-eggs" group (can't breed)
            if (learnerGroups.has('no-eggs')) return null

            // Determine how this parent learns the move and in which version groups
            const moveEntry = learnerPoke.moves.find(m => m.move.name === moveName)
            if (!moveEntry) return null

            const methods = []
            const methodMap = new Map() // method → Set of version groups
            ;(moveEntry.version_group_details || []).forEach(vgd => {
              const method = vgd.move_learn_method?.name
              const vg = vgd.version_group?.name
              const level = vgd.level_learned_at
              if (!method || !vg) return

              const key = method === 'level-up' ? `level-up:${level}` : method
              if (!methodMap.has(key)) methodMap.set(key, { method, level: level || null, vgs: new Set() })
              methodMap.get(key).vgs.add(vg)
            })

            methodMap.forEach(({ method, level, vgs }) => {
              methods.push({ method, level, versionGroups: vgs })
            })

            if (methods.length === 0) return null

            return {
              name: learner.name,
              speciesName: learnerSpeciesName,
              methods,
              id: learnerPoke.id,
            }
          } catch {
            return null
          }
        }))

        results.forEach(r => { if (r) parents.push(r) })
      }

      // Sort parents: by Pokedex number
      parents.sort((a, b) => (a.id || 999) - (b.id || 999))

      setParentsByMove(prev => ({ ...prev, [moveName]: parents }))
    } catch (err) {
      console.error('Failed to fetch parents for', moveName, err)
      setParentsByMove(prev => ({ ...prev, [moveName]: [] }))
    } finally {
      setLoadingParents(prev => ({ ...prev, [moveName]: false }))
    }
  }, [speciesData, parentsByMove])

  // Toggle egg move expansion
  const toggleMove = useCallback((moveName) => {
    setExpandedMoves(prev => {
      const next = { ...prev, [moveName]: !prev[moveName] }
      // Fetch parents when expanding for the first time
      if (next[moveName]) fetchParentsForMove(moveName)
      return next
    })
  }, [fetchParentsForMove])

  // Filter egg moves to the selected version
  const getFilteredEggMoves = () => {
    if (!selectedVersion || eggMoves.length === 0) return []

    const gen = versionGeneration[selectedVersion]
    const genVgs = new Set(generationVersionGroups[gen] || [])

    return eggMoves.filter(m => {
      return [...m.versionGroups].some(vg => genVgs.has(vg))
    })
  }

  const filteredMoves = getFilteredEggMoves()

  // Filter parents for selected version
  const getFilteredParents = (moveName) => {
    const parents = parentsByMove[moveName]
    if (!parents || parents.length === 0) return []

    const gen = versionGeneration[selectedVersion]
    const genVgs = new Set(generationVersionGroups[gen] || [])

    return parents
      .map(parent => {
        // Filter methods to those available in the selected gen
        const filteredMethods = parent.methods
          .filter(m => [...m.versionGroups].some(vg => genVgs.has(vg)))
          // Exclude egg method (we want parents who learn it naturally, not by egg themselves)
          .filter(m => m.method !== 'egg')

        if (filteredMethods.length === 0) return null
        return { ...parent, methods: filteredMethods }
      })
      .filter(Boolean)
  }

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

  const sortedMoves = [...filteredMoves].sort((a, b) => {
    let result = 0
    switch (sortConfig.key) {
      case 'move':
        result = a.name.localeCompare(b.name)
        break
      case 'parents': {
        const aParents = getFilteredParents(a.name)
        const bParents = getFilteredParents(b.name)
        result = (aParents.length || 0) - (bParents.length || 0)
        break
      }
      default:
        result = a.name.localeCompare(b.name)
    }
    return sortConfig.direction === 'asc' ? result : -result
  })

  // Expand/collapse all
  const handleExpandAll = () => {
    const allExpanded = sortedMoves.every(m => expandedMoves[m.name])
    if (allExpanded) {
      setExpandedMoves({})
      setTableFullyExpanded(false)
    } else {
      const expanded = {}
      sortedMoves.forEach(m => {
        expanded[m.name] = true
        if (!parentsByMove[m.name]) fetchParentsForMove(m.name)
      })
      setExpandedMoves(expanded)
      setTableFullyExpanded(true)
    }
  }

  // Format method for display
  const formatMethod = (method, level) => {
    if (method === 'level-up' && level != null) return `Level ${level}`
    if (method === 'level-up') return 'Level Up'
    if (method === 'machine') return 'TM/HM'
    if (method === 'tutor') return 'Tutor'
    return formatName(method)
  }

  // Get version group tags for a method's versionGroups
  const renderMethodVgs = (vgs) => {
    const gen = versionGeneration[selectedVersion]
    const genVgs = new Set(generationVersionGroups[gen] || [])
    const filtered = [...vgs].filter(vg => genVgs.has(vg)).sort((a, b) => (versionGroupOrder[a] || 0) - (versionGroupOrder[b] || 0))
    if (filtered.length === genVgs.size) return null // All version groups — don't show tags
    return filtered.map(vg => versionGroupDisplayNames[vg] || vg).join(', ')
  }

  const handleSearchNavigate = useCallback((category, name) => {
    if (category === 'pokemon') {
      loadPokemon(name)
    } else if (onUnifiedNavigate) {
      onUnifiedNavigate(category, name)
    }
  }, [loadPokemon, onUnifiedNavigate])

  return (
    <div className="location-page egg-move-page">
      {/* Search + Version row */}
      <div className="page-search-row">
        {pokemonData && availableVersions.length > 0 && (
          <div className="page-version-inline">
            <label htmlFor="eggmove-version-select">Version:</label>
            <select
              id="eggmove-version-select"
              value={selectedVersion || ''}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="version-dropdown"
            >
              {availableVersions.map((group, idx) => {
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
        )}
        <div className="search-container page-search-inline">
          <UnifiedSearch
            lists={searchLists}
            onNavigate={handleSearchNavigate}
            activeTab="eggmoves"
            initialQuery={initialPokemon || ''}
            loading={loadingPokemon}
          />
        </div>
      </div>

      {error && !loadingPokemon && eggMoves.length === 0 && <div className="error">{error}</div>}
      {loadingPokemon && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball" /></div>}

      {pokemonData && eggMoves.length > 0 && (
        <>
          {/* Pokemon info header */}
          <div className="location-detail-card">
            <div className="location-detail-header">
              <h2 className="location-detail-name">{formatName(pokemonData.name)}</h2>
              {speciesData?.egg_groups && (
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Egg Groups: {speciesData.egg_groups.map(g => formatName(g.name)).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Egg Moves Table */}
          {selectedVersion ? (
            sortedMoves.length > 0 ? (
              <div className="location-encounters-section">
                <div className="location-encounters-header">
                  <h3>Egg Moves ({sortedMoves.length})</h3>
                  {sortedMoves.length > 1 && (
                    <button
                      type="button"
                      className="expand-toggle"
                      title={sortedMoves.every(m => expandedMoves[m.name]) ? 'Collapse all' : 'Expand all'}
                      onClick={handleExpandAll}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {sortedMoves.every(m => expandedMoves[m.name]) ? (
                          <line x1="5" y1="12" x2="19" y2="12" />
                        ) : (
                          <>
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </>
                        )}
                      </svg>
                    </button>
                  )}
                </div>
                <div className="location-encounters-table-wrapper" style={tableFullyExpanded ? { maxHeight: 'none' } : undefined}>
                  <table className="location-encounters-table egg-move-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>
                          <button type="button" onClick={() => handleSort('move')}>
                            Egg Move{getSortIndicator('move')}
                          </button>
                        </th>
                        <th style={{ width: '20%' }}>Type</th>
                        <th style={{ width: '15%' }}>Power</th>
                        <th style={{ width: '25%' }}>
                          <button type="button" onClick={() => handleSort('parents')}>
                            Parents{getSortIndicator('parents')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMoves.map(eggMove => {
                        const isExpanded = !!expandedMoves[eggMove.name]
                        const parents = getFilteredParents(eggMove.name)
                        const isLoadingParents = !!loadingParents[eggMove.name]
                        const rows = []

                        // Header row for the egg move
                        rows.push(
                          <tr
                            key={eggMove.name}
                            className="location-header-row"
                            onClick={() => toggleMove(eggMove.name)}
                          >
                            <td className="location-pokemon-cell">
                              <span className="location-toggle">{isExpanded ? '▾' : '▸'}</span>
                              {onMoveClick ? (
                                <button
                                  type="button"
                                  className="pokemon-name-link"
                                  onClick={(e) => { e.stopPropagation(); onMoveClick(eggMove.name) }}
                                >
                                  {formatName(eggMove.name)}
                                </button>
                              ) : (
                                formatName(eggMove.name)
                              )}
                            </td>
                            <td className="egg-move-type-cell">
                              <MoveTypeCell moveName={eggMove.name} />
                            </td>
                            <td className="egg-move-power-cell">
                              <MovePowerCell moveName={eggMove.name} />
                            </td>
                            <td className="location-method-cell" style={{ color: 'var(--text-muted)' }}>
                              {parentsByMove[eggMove.name]
                                ? `${parents.length} parent${parents.length !== 1 ? 's' : ''}`
                                : '—'
                              }
                            </td>
                          </tr>
                        )

                        // Expanded parent rows
                        if (isExpanded) {
                          if (isLoadingParents) {
                            rows.push(
                              <tr key={`${eggMove.name}-loading`} className="location-detail-row">
                                <td colSpan="4" style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>
                                  Loading parents…
                                </td>
                              </tr>
                            )
                          } else if (parents.length === 0 && parentsByMove[eggMove.name]) {
                            rows.push(
                              <tr key={`${eggMove.name}-none`} className="location-detail-row">
                                <td colSpan="4" style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>
                                  No compatible parents in this version
                                </td>
                              </tr>
                            )
                          } else {
                            parents.forEach((parent, idx) => {
                              const methodLabels = parent.methods.map(m => {
                                const label = formatMethod(m.method, m.level)
                                const vgLabel = renderMethodVgs(m.versionGroups)
                                return vgLabel ? `${label} (${vgLabel})` : label
                              })

                              rows.push(
                                <tr key={`${eggMove.name}-${parent.name}-${idx}`} className="location-detail-row">
                                  <td className="location-pokemon-cell egg-parent-cell">
                                    {onPokemonClick ? (
                                      <button
                                        type="button"
                                        className="pokemon-name-link"
                                        onClick={() => onPokemonClick(parent.name, selectedVersion)}
                                      >
                                        {formatName(parent.name)}
                                      </button>
                                    ) : (
                                      formatName(parent.name)
                                    )}
                                  </td>
                                  <td colSpan="2" className="egg-parent-method-cell">
                                    {methodLabels.join(', ')}
                                  </td>
                                  <td></td>
                                </tr>
                              )
                            })
                          }
                        }

                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="location-no-encounters">No egg moves available in this version.</div>
            )
          ) : (
            <div className="location-no-encounters">Select a version to see egg moves.</div>
          )}
        </>
      )}
    </div>
  )
}

// Small helper components that lazy-fetch move data for type/power display
function MoveTypeCell({ moveName }) {
  const [type, setType] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchMoveCached(moveName).then(data => {
      if (!cancelled && data) setType(data.type?.name || null)
    })
    return () => { cancelled = true }
  }, [moveName])
  if (!type) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{
      backgroundColor: getTypeColor(type),
      color: getTypeTextColor(type),
      padding: '1px 6px',
      borderRadius: '3px',
      fontSize: 'inherit',
      fontWeight: 600,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
      opacity: 0.85,
      display: 'inline-block',
      textAlign: 'center',
      width: '62px',
      overflow: 'hidden',
    }}>
      {formatName(type)}
    </span>
  )
}

function MovePowerCell({ moveName }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchMoveCached(moveName).then(data => {
      if (!cancelled && data) setInfo({ power: data.power, category: data.damage_class?.name })
    })
    return () => { cancelled = true }
  }, [moveName])
  if (!info) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <span>{info.power || '—'}</span>
}
