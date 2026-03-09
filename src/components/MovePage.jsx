import { useState, useEffect, useRef, useCallback } from 'react'
import { versionDisplayNames, versionGeneration, versionGroupDisplayNames, generationVersionGroups, generationOrder, versionGroupOrder, getTransferSourceVersionGroups } from '../utils/versionInfo'
import { fetchPokemonCached, fetchMoveCached, fetchSpeciesCached } from '../utils/pokeCache'

// Map individual version names to the version groups that cover them
const versionToVersionGroups = {
  'red': ['red-blue'], 'blue': ['red-blue'], 'yellow': ['yellow'],
  'gold': ['gold-silver'], 'silver': ['gold-silver'], 'crystal': ['crystal'],
  'ruby': ['ruby-sapphire'], 'sapphire': ['ruby-sapphire'], 'emerald': ['emerald'],
  'firered': ['firered-leafgreen'], 'leafgreen': ['firered-leafgreen'],
  'colosseum': ['colosseum'], 'xd': ['xd'],
  'diamond': ['diamond-pearl'], 'pearl': ['diamond-pearl'], 'platinum': ['platinum'],
  'heartgold': ['heartgold-soulsilver'], 'soulsilver': ['heartgold-soulsilver'],
  'black': ['black-white'], 'white': ['black-white'],
  'black-2': ['black-2-white-2'], 'white-2': ['black-2-white-2'],
  'x': ['x-y'], 'y': ['x-y'],
  'omega-ruby': ['omega-ruby-alpha-sapphire'], 'alpha-sapphire': ['omega-ruby-alpha-sapphire'],
  'sun': ['sun-moon'], 'moon': ['sun-moon'],
  'ultra-sun': ['ultra-sun-ultra-moon'], 'ultra-moon': ['ultra-sun-ultra-moon'],
  'lets-go-pikachu': ['lets-go-pikachu-lets-go-eevee'], 'lets-go-eevee': ['lets-go-pikachu-lets-go-eevee'],
  'sword': ['sword-shield', 'the-isle-of-armor', 'the-crown-tundra'],
  'shield': ['sword-shield', 'the-isle-of-armor', 'the-crown-tundra'],
  'brilliant-diamond': ['brilliant-diamond-and-shining-pearl'],
  'shining-pearl': ['brilliant-diamond-and-shining-pearl'],
  'legends-arceus': ['legends-arceus'],
  'scarlet': ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk'],
  'violet': ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk'],
  'legends-za': ['legends-za', 'mega-dimension'],
}

// Map version group → its generation number
const versionGroupGeneration = {}
for (const [gen, groups] of Object.entries(generationVersionGroups)) {
  for (const vg of groups) {
    versionGroupGeneration[vg] = Number(gen)
  }
}

// Learn method priority (lower = easier/preferred)
const LEARN_METHOD_PRIORITY = {
  'level-up': 1,
  'machine': 2,
  'egg': 3,
  'tutor': 4,
  'form-change': 5,
  'light-ball-egg': 5,
  'stadium-surfing-pikachu': 5,
  'colosseum-purification': 5,
  'xd-shadow': 5,
  'xd-purification': 5,
  'transfer': 6,
  'inherited': 7,
}

const LEARN_METHOD_LABELS = {
  'level-up': 'Level',
  'machine': 'TM',
  'egg': 'Egg',
  'tutor': 'Tutor',
  'form-change': 'Special',
  'light-ball-egg': 'Special',
  'stadium-surfing-pikachu': 'Special',
  'colosseum-purification': 'Special',
  'xd-shadow': 'Special',
  'xd-purification': 'Special',
  'transfer': 'Transfer',
  'inherited': 'Inherited',
}

const typeColors = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC',
}

const categoryIcons = {
  physical: '⚔️',
  special: '🔮',
  status: '📊',
}

function formatMoveName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatPokemonName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Learn methods that are "special" — shown regardless of version group
const SPECIAL_METHODS = new Set([
  'form-change', 'light-ball-egg', 'stadium-surfing-pikachu',
  'colosseum-purification', 'xd-shadow', 'xd-purification', 'zygarde-cube',
])

/**
 * Get the best learn method for a Pokémon learning a given move in the selected version groups.
 * Returns { method, label, level } for the highest-priority learn method.
 * Special methods (xd-purification, colosseum-purification, etc.) are included
 * regardless of version group, matching the Pokemon page's behavior.
 */
function getBestLearnMethod(pokemonData, moveName, selectedVersionGroups) {
  const moveEntry = pokemonData.moves?.find(m => m.move.name === moveName)
  if (!moveEntry) return null

  let best = null
  for (const vgd of moveEntry.version_group_details) {
    const vgName = vgd.version_group?.name
    const method = vgd.move_learn_method?.name

    // Allow special methods from any version group; others must match selected
    if (!SPECIAL_METHODS.has(method) && !selectedVersionGroups.has(vgName)) continue

    const priority = LEARN_METHOD_PRIORITY[method] ?? 99
    const level = vgd.level_learned_at || 0

    if (!best || priority < best.priority) {
      best = {
        priority,
        method,
        label: LEARN_METHOD_LABELS[method] || method,
        level,
      }
    }
  }
  return best
}

/**
 * Get the move stats for the selected version, accounting for past_values.
 */
function getMoveStatsForVersion(moveData, selectedVersion) {
  const gen = versionGeneration[selectedVersion] || 99

  let power = moveData.power
  let pp = moveData.pp
  let accuracy = moveData.accuracy
  let type = moveData.type?.name
  let effectChance = moveData.effect_chance

  // past_values is ordered oldest → newest; apply all patches whose generation
  // is >= the selected gen (meaning the current values hadn't taken effect yet)
  if (moveData.past_values) {
    // Sort past_values by generation order descending so we find the
    // closest applicable past snapshot
    const sorted = [...moveData.past_values].sort((a, b) => {
      const genA = a.version_group?.name ? (versionGroupOrder[a.version_group.name] || 0) : 0
      const genB = b.version_group?.name ? (versionGroupOrder[b.version_group.name] || 0) : 0
      return genB - genA
    })

    for (const pv of sorted) {
      const pvGen = versionGroupGeneration[pv.version_group?.name] || 99
      // This past_values entry covers all versions UP TO AND INCLUDING this version group
      if (gen <= pvGen) {
        if (pv.power !== null && pv.power !== undefined) power = pv.power
        if (pv.pp !== null && pv.pp !== undefined) pp = pv.pp
        if (pv.accuracy !== null && pv.accuracy !== undefined) accuracy = pv.accuracy
        if (pv.type) type = pv.type.name
        if (pv.effect_chance !== null && pv.effect_chance !== undefined) effectChance = pv.effect_chance
        break // closest applicable snapshot found
      }
    }
  }

  return { power, pp, accuracy, type, effectChance }
}

export default function MovePage({ initialMove, initialVersion, onStateChange }) {
  const [moveList, setMoveList] = useState([])
  const [searchInput, setSearchInput] = useState(initialMove || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const containerRef = useRef(null)
  const userIsTypingRef = useRef(false)

  const [moveData, setMoveData] = useState(null)
  const [moveLoading, setMoveLoading] = useState(false)
  const [moveError, setMoveError] = useState(null)

  const [selectedVersion, setSelectedVersion] = useState(initialVersion || null)
  const [availableVersions, setAvailableVersions] = useState([]) // grouped
  const [pendingInitialVersion, setPendingInitialVersion] = useState(initialVersion || null)

  const [learners, setLearners] = useState([]) // { name, spriteUrl, method, label, level, id }
  const [learnersLoading, setLearnersLoading] = useState(false)
  const [learnersProgress, setLearnersProgress] = useState({ loaded: 0, total: 0 })
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })

  const abortRef = useRef(null)

  // Auto-load move from URL on mount
  const hasLoadedFromUrl = useRef(false)
  useEffect(() => {
    if (hasLoadedFromUrl.current || !initialMove) return
    hasLoadedFromUrl.current = true
    searchMove(initialMove)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch move names list for autocomplete
  useEffect(() => {
    const fetchMoveList = async () => {
      try {
        const first = await fetch('https://pokeapi.co/api/v2/move/').then(r => r.json())
        const all = await fetch(`https://pokeapi.co/api/v2/move/?limit=${first.count}`).then(r => r.json())
        setMoveList(all.results.map(m => m.name).sort())
      } catch (err) {
        console.error('Failed to fetch move list:', err)
      }
    }
    fetchMoveList()
  }, [])

  // Autocomplete logic
  useEffect(() => {
    if (!searchInput.trim() || !userIsTypingRef.current) {
      if (!searchInput.trim()) {
        setSuggestions([])
        setShowSuggestions(false)
      }
      return
    }
    const q = searchInput.toLowerCase().replace(/[-\s]/g, '')
    const filtered = moveList.filter(n => n.replace(/-/g, '').includes(q)).slice(0, 8)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setActiveSuggestion(0)
  }, [searchInput, moveList])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Compute available versions from move data
  useEffect(() => {
    if (!moveData) {
      setAvailableVersions([])
      return
    }

    // Collect version groups from flavor_text_entries (all languages, not just
    // English — Gen 1 moves often lack English flavor texts for red-blue/yellow)
    const vgSet = new Set()
    moveData.flavor_text_entries?.forEach(fte => {
      const vgName = fte.version_group?.name
      if (vgName) vgSet.add(vgName)
    })

    // Also collect from machines and past_values
    moveData.machines?.forEach(m => {
      const vgName = m.version_group?.name
      if (vgName) vgSet.add(vgName)
    })
    moveData.past_values?.forEach(pv => {
      const vgName = pv.version_group?.name
      if (vgName) vgSet.add(vgName)
    })

    // Use the move's generation field to ensure the intro generation's VGs
    // are included (the API has no flavor texts for Gen 1 or Colosseum/XD)
    if (moveData.generation?.name) {
      const introGen = generationOrder[moveData.generation.name]
      if (introGen) {
        const introVgs = generationVersionGroups[introGen] || []
        introVgs.forEach(vg => vgSet.add(vg))
      }
    }

    // Fill in ALL version groups for each generation that has at least one
    // entry (e.g. if ruby-sapphire is present, also add colosseum, xd, etc.)
    const presentGens = new Set()
    vgSet.forEach(vg => {
      for (const [gen, groups] of Object.entries(generationVersionGroups)) {
        if (groups.includes(vg)) presentGens.add(Number(gen))
      }
    })
    presentGens.forEach(gen => {
      (generationVersionGroups[gen] || []).forEach(vg => vgSet.add(vg))
    })

    // Build version list from version groups
    const versionSet = new Set()
    const vgToVersions = {
      'red-blue': ['red', 'blue'], 'yellow': ['yellow'],
      'gold-silver': ['gold', 'silver'], 'crystal': ['crystal'],
      'ruby-sapphire': ['ruby', 'sapphire'], 'emerald': ['emerald'],
      'firered-leafgreen': ['firered', 'leafgreen'],
      'colosseum': ['colosseum'], 'xd': ['xd'],
      'diamond-pearl': ['diamond', 'pearl'], 'platinum': ['platinum'],
      'heartgold-soulsilver': ['heartgold', 'soulsilver'],
      'black-white': ['black', 'white'], 'black-2-white-2': ['black-2', 'white-2'],
      'x-y': ['x', 'y'], 'omega-ruby-alpha-sapphire': ['omega-ruby', 'alpha-sapphire'],
      'sun-moon': ['sun', 'moon'], 'ultra-sun-ultra-moon': ['ultra-sun', 'ultra-moon'],
      'lets-go-pikachu-lets-go-eevee': ['lets-go-pikachu', 'lets-go-eevee'],
      'sword-shield': ['sword', 'shield'],
      'the-isle-of-armor': ['sword', 'shield'],
      'the-crown-tundra': ['sword', 'shield'],
      'brilliant-diamond-and-shining-pearl': ['brilliant-diamond', 'shining-pearl'],
      'legends-arceus': ['legends-arceus'],
      'scarlet-violet': ['scarlet', 'violet'],
      'the-teal-mask': ['scarlet', 'violet'],
      'the-indigo-disk': ['scarlet', 'violet'],
      'legends-za': ['legends-za'],
      'mega-dimension': ['legends-za'],
    }

    vgSet.forEach(vg => {
      const versions = vgToVersions[vg]
      if (versions) versions.forEach(v => versionSet.add(v))
    })

    // Build grouped/sorted version options (same pattern as VersionSelector)
    const uniqueVersions = Array.from(versionSet)
      .filter(v => versionDisplayNames[v] && (versionGeneration[v] || 0) < 8)
      .sort((a, b) => {
        const genA = versionGeneration[a] || 0
        const genB = versionGeneration[b] || 0
        if (genA !== genB) return genA - genB
        return (versionDisplayNames[a] || a).localeCompare(versionDisplayNames[b] || b)
      })

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
  }, [moveData])

  // Auto-select latest version when available versions change
  useEffect(() => {
    if (availableVersions.length === 0) return
    const allNames = new Set(availableVersions.flat().map(v => v.name))

    // If there's a pending initial version from the URL, try to use it
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

  // Fetch learner Pokémon when move or version changes
  useEffect(() => {
    if (!moveData || !selectedVersion) {
      setLearners([])
      return
    }

    // Abort previous learner fetch
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const selectedVersionGroups = new Set(versionToVersionGroups[selectedVersion] || [])
    const primaryVersionGroup = (versionToVersionGroups[selectedVersion] || [])[0]
    const transferSourceVgs = getTransferSourceVersionGroups(selectedVersion, primaryVersionGroup)
    const selectedGen = versionGeneration[selectedVersion]
    const currentGenVgs = new Set(generationVersionGroups[selectedGen] || [])
    const pokemonEntries = moveData.learned_by_pokemon || []

    setLearnersLoading(true)
    setLearnersProgress({ loaded: 0, total: pokemonEntries.length })
    setLearners([])

    let cancelled = false
    const results = []

    const fetchLearners = async () => {
      // Fetch in batches of 25
      const BATCH_SIZE = 25
      for (let i = 0; i < pokemonEntries.length; i += BATCH_SIZE) {
        if (controller.signal.aborted) return

        const batch = pokemonEntries.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (entry) => {
            try {
              const data = await fetchPokemonCached(entry.name)
              if (!data || controller.signal.aborted) return null

              // 1. Try direct learn method in current gen
              let best = getBestLearnMethod(data, moveData.name, selectedVersionGroups)

              // Before transfer/inheritance, verify the Pokémon actually exists
              // in the selected generation (has any move data in current gen VGs).
              // This prevents e.g. Marill (Gen 2) from showing in Blue (Gen 1).
              const existsInCurrentGen = !best && data.moves?.some(m =>
                m.version_group_details?.some(vgd => currentGenVgs.has(vgd.version_group?.name))
              )

              // 2. Try transfer from prior gens
              if (!best && existsInCurrentGen && transferSourceVgs) {
                const moveEntry = data.moves?.find(m => m.move.name === moveData.name)
                const hasInTransferSource = moveEntry?.version_group_details?.some(
                  vgd => transferSourceVgs.has(vgd.version_group?.name)
                )
                if (hasInTransferSource) {
                  best = { priority: 6, method: 'transfer', label: 'Transfer', level: 0 }
                }
              }

              // 3. Try inheritance from pre-evolution chain
              if (!best && existsInCurrentGen) {
                const speciesName = data.species?.name
                if (speciesName) {
                  const species = await fetchSpeciesCached(speciesName)
                  let currentSpecies = species
                  while (currentSpecies?.evolves_from_species && !best) {
                    if (controller.signal.aborted) return null
                    const preEvoName = currentSpecies.evolves_from_species.name
                    const preEvoPokemon = await fetchPokemonCached(preEvoName)
                    if (!preEvoPokemon) break

                    // Check if pre-evo learns the move in current gen
                    const preEvoDirect = getBestLearnMethod(preEvoPokemon, moveData.name, selectedVersionGroups)
                    if (preEvoDirect) {
                      best = { priority: 7, method: 'inherited', label: 'Inherited', level: 0 }
                      break
                    }

                    // Check if pre-evo has the move via transfer
                    if (transferSourceVgs) {
                      const preEvoMoveEntry = preEvoPokemon.moves?.find(m => m.move.name === moveData.name)
                      const preEvoHasTransfer = preEvoMoveEntry?.version_group_details?.some(
                        vgd => transferSourceVgs.has(vgd.version_group?.name)
                      )
                      if (preEvoHasTransfer) {
                        best = { priority: 7, method: 'inherited', label: 'Inherited', level: 0 }
                        break
                      }
                    }

                    // Walk further up the chain
                    currentSpecies = await fetchSpeciesCached(preEvoName)
                  }
                }
              }

              if (!best) return null

              // Use species dex number so forms show the base ID (e.g. Mega Gyarados → 130)
              const speciesId = data.species?.url
                ? Number(data.species.url.match(/\/(\d+)\/?$/)?.[1]) || data.id
                : data.id

              return {
                name: data.name,
                id: speciesId,
                method: best.method,
                label: best.label,
                level: best.level,
              }
            } catch {
              return null
            }
          })
        )

        if (controller.signal.aborted) return

        const valid = batchResults.filter(Boolean)
        results.push(...valid)

        // Sort results by dex number
        const sorted = [...results].sort((a, b) => a.id - b.id)

        if (!cancelled) {
          setLearners(sorted)
          setLearnersProgress({ loaded: Math.min(i + BATCH_SIZE, pokemonEntries.length), total: pokemonEntries.length })
        }
      }

      if (!cancelled) {
        setLearnersLoading(false)
      }
    }

    fetchLearners()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [moveData, selectedVersion])

  // Report state changes to parent for URL sync
  useEffect(() => {
    if (onStateChange && moveData) {
      onStateChange({ version: selectedVersion, move: moveData.name })
    }
  }, [selectedVersion, moveData, onStateChange])

  const searchMove = async (name) => {
    const query = String(name).trim().toLowerCase()
    if (!query) return

    userIsTypingRef.current = false
    setSearchInput(formatMoveName(query))
    setShowSuggestions(false)
    setMoveLoading(true)
    setMoveError(null)
    setMoveData(null)
    setLearners([])

    try {
      const data = await fetchMoveCached(query)
      if (!data) throw new Error('Move not found')
      setMoveData(data)
    } catch (err) {
      setMoveError(err.message || 'Failed to fetch move')
    } finally {
      setMoveLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (searchInput.trim()) searchMove(searchInput)
  }

  const handleSuggestionClick = (name) => {
    searchMove(name)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveSuggestion(prev => (prev + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length)
        break
      case 'Enter':
        e.preventDefault()
        if (suggestions[activeSuggestion]) {
          handleSuggestionClick(suggestions[activeSuggestion])
        } else {
          handleSubmit(e)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
      default:
        break
    }
  }

  // Get description for selected version
  const getDescription = () => {
    if (!moveData || !selectedVersion) return null
    const vgs = versionToVersionGroups[selectedVersion] || []

    // Try to find a flavor text for the selected version group(s)
    for (const vg of vgs) {
      const entry = moveData.flavor_text_entries?.find(
        fte => fte.language?.name === 'en' && fte.version_group?.name === vg
      )
      if (entry) return entry.flavor_text?.replace(/\n/g, ' ')
    }

    // Fallback: latest English flavor text
    const allEn = moveData.flavor_text_entries?.filter(fte => fte.language?.name === 'en') || []
    if (allEn.length > 0) return allEn[allEn.length - 1].flavor_text?.replace(/\n/g, ' ')

    // Fallback: effect entry
    const effect = moveData.effect_entries?.find(e => e.language?.name === 'en')
    return effect?.short_effect || null
  }

  const moveStats = moveData && selectedVersion ? getMoveStatsForVersion(moveData, selectedVersion) : null
  const description = getDescription()

  const getLearnDisplay = (learner) => {
    if (learner.label === 'Level') {
      return `Lv. ${learner.level}`
    }
    return learner.label
  }

  const LEARN_METHOD_SORT_ORDER = {
    'level-up': 1, 'machine': 2, 'egg': 3, 'tutor': 4,
    'form-change': 5, 'light-ball-egg': 5, 'stadium-surfing-pikachu': 5,
    'colosseum-purification': 5, 'xd-shadow': 5, 'xd-purification': 5,
    'transfer': 6, 'inherited': 7,
  }

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

  const sortedLearners = [...learners].sort((a, b) => {
    let valueA, valueB
    switch (sortConfig.key) {
      case 'id':
        valueA = a.id; valueB = b.id; break
      case 'name':
        valueA = a.name; valueB = b.name; break
      case 'method': {
        const orderA = LEARN_METHOD_SORT_ORDER[a.method] ?? 99
        const orderB = LEARN_METHOD_SORT_ORDER[b.method] ?? 99
        if (orderA !== orderB) { valueA = orderA; valueB = orderB; break }
        // Within same method, sort by level for level-up
        valueA = a.level || 0; valueB = b.level || 0; break
      }
      default:
        valueA = a.id; valueB = b.id
    }

    if (valueA == null && valueB == null) return 0
    if (valueA == null) return 1
    if (valueB == null) return -1

    let result = 0
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      result = valueA - valueB
    } else {
      result = String(valueA).localeCompare(String(valueB))
    }
    return sortConfig.direction === 'asc' ? result : -result
  })

  return (
    <div className="move-page">
      {/* Search */}
      <div className="search-container" ref={containerRef}>
        <form onSubmit={handleSubmit} className="search-form">
          <div className="search-input-wrapper">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { userIsTypingRef.current = true; setSearchInput(e.target.value) }}
              onKeyDown={handleKeyDown}
              onFocus={() => searchInput && setShowSuggestions(suggestions.length > 0)}
              placeholder="Enter move name..."
              autoComplete="off"
            />
            <button type="submit" disabled={moveLoading}>Search</button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="suggestions-list">
              {suggestions.map((s, idx) => (
                <li
                  key={s}
                  className={`suggestion-item ${idx === activeSuggestion ? 'active' : ''}`}
                  onClick={() => handleSuggestionClick(s)}
                >
                  {formatMoveName(s)}
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>

      {moveError && <div className="error">{moveError}</div>}
      {moveLoading && <div className="loading">Loading...</div>}

      {moveData && moveStats && (
        <>
          {/* Version Selector */}
          {availableVersions.length > 0 && (
            <div className="version-selector-wrapper">
              <div className="version-selector">
                <label htmlFor="move-version-select">Game Version:</label>
                <select
                  id="move-version-select"
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
            </div>
          )}

          {/* Move Details Box */}
          <div className="move-detail-card">
            <div className="move-detail-header">
              <h2 className="move-detail-name">{formatMoveName(moveData.name)}</h2>
              <div className="move-detail-tags">
                <span
                  className="type-badge-small"
                  style={{ backgroundColor: typeColors[moveStats.type] || '#999' }}
                >
                  {moveStats.type}
                </span>
                <span className="move-category-badge" data-category={moveData.damage_class?.name}>
                  {categoryIcons[moveData.damage_class?.name] || ''} {moveData.damage_class?.name}
                </span>
              </div>
            </div>

            <div className="move-detail-stats">
              <div className="move-stat-item">
                <span className="move-stat-label">Power</span>
                <span className="move-stat-value">{moveStats.power ?? '—'}</span>
              </div>
              <div className="move-stat-item">
                <span className="move-stat-label">PP</span>
                <span className="move-stat-value">{moveStats.pp ?? '—'}</span>
              </div>
              <div className="move-stat-item">
                <span className="move-stat-label">Accuracy</span>
                <span className="move-stat-value">{moveStats.accuracy != null ? `${moveStats.accuracy}%` : '—'}</span>
              </div>
              <div className="move-stat-item">
                <span className="move-stat-label">Priority</span>
                <span className="move-stat-value">{moveData.priority != null ? (moveData.priority > 0 ? `+${moveData.priority}` : moveData.priority) : '—'}</span>
              </div>
            </div>

            {description && (
              <div className="move-detail-description">
                {description}
              </div>
            )}
          </div>

          {/* Learners Table */}
          <div className="move-learners-section">
            <div className="move-learners-header">
              <h3>Pokémon that learn {formatMoveName(moveData.name)}</h3>
              {learnersLoading && (
                <span className="move-learners-progress">
                  Loading… {learnersProgress.loaded}/{learnersProgress.total}
                </span>
              )}
            </div>

            {learners.length > 0 ? (
              <div className="move-learners-table-wrapper">
                <table className="move-learners-table">
                  <thead>
                    <tr>
                      <th><button type="button" onClick={() => handleSort('id')}>#{ getSortIndicator('id')}</button></th>
                      <th><button type="button" onClick={() => handleSort('name')}>Pokémon{getSortIndicator('name')}</button></th>
                      <th><button type="button" onClick={() => handleSort('method')}>Method{getSortIndicator('method')}</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLearners.map(learner => (
                      <tr key={learner.name}>
                        <td className="learner-id">{learner.id}</td>
                        <td className="learner-name">{formatPokemonName(learner.name)}</td>
                        <td className="learner-method">
                          <span className={`method-badge method-${learner.method}`}>
                            {getLearnDisplay(learner)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !learnersLoading && <div className="move-no-learners">No Pokémon learn this move in the selected version.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
