import { useState, useEffect, useRef, useCallback } from 'react'
import { versionDisplayNames, versionGeneration, generationVersionGroups, generationOrder, generationVersions } from '../utils/versionInfo'
import { fetchAbilityCached, fetchPokemonCached } from '../utils/pokeCache'

function formatAbilityName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatPokemonName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Check if a specific Pokémon form is available in the selected version.
 * Filters out megas, primals, gmax, etc. from games that don't support them.
 */
function isFormAvailableInVersion(pokemonName, selectedVersion) {
  const lower = pokemonName.toLowerCase()
  const gen = versionGeneration[selectedVersion]
  if (!gen) return true

  // Mega forms: only in XY, ORAS, SM, USUM, LGPE, and Legends Z-A
  if (lower.includes('-mega')) {
    const megaVersions = new Set([
      'x', 'y', 'omega-ruby', 'alpha-sapphire',
      'sun', 'moon', 'ultra-sun', 'ultra-moon',
      'lets-go-pikachu', 'lets-go-eevee', 'legends-za',
    ])
    return megaVersions.has(selectedVersion)
  }

  // Primal forms: only in ORAS (and later gens that re-introduce them)
  if (lower.includes('-primal')) {
    const primalVersions = new Set([
      'omega-ruby', 'alpha-sapphire',
    ])
    return primalVersions.has(selectedVersion)
  }

  // Gigantamax: Sword/Shield only
  if (lower.includes('-gmax')) {
    return selectedVersion === 'sword' || selectedVersion === 'shield'
  }

  // Totem forms: Gen 7 only
  if (lower.includes('-totem')) {
    return gen === 7
  }

  return true
}

/**
 * Determine if a Pokémon actually has the given ability in the selected generation.
 * Uses the Pokémon's past_abilities data to reconstruct what abilities it had
 * at that point in time, mirroring PokemonCard's getGenerationAbilities logic.
 * Returns { hasAbility, isHidden } or null if the Pokémon doesn't have it.
 */
function pokemonHasAbilityInGen(pokemonData, abilityName, selectedGen) {
  const selectedGenRank = selectedGen

  // Abilities didn't exist before Gen 3
  if (selectedGenRank < 3) return null

  // Build a slot map from current abilities
  const slotMap = new Map()
  for (const ability of (pokemonData.abilities || [])) {
    slotMap.set(ability.slot, ability)
  }

  // Apply past_abilities overrides for the selected generation
  const pastAbilities = pokemonData.past_abilities || []
  for (const pastAbility of pastAbilities) {
    const pastGenRank = pastAbility.generation?.name
      ? generationOrder[pastAbility.generation.name]
      : null

    if (pastGenRank && pastGenRank >= selectedGenRank) {
      for (const entry of pastAbility.abilities) {
        if (entry.ability === null) {
          slotMap.delete(entry.slot)
        } else {
          slotMap.set(entry.slot, entry)
        }
      }
    }
  }

  // Check if the target ability is in any slot
  for (const ability of slotMap.values()) {
    if (ability.ability?.name === abilityName) {
      const isHidden = ability.is_hidden
      // Hidden abilities didn't exist before Gen 5
      if (isHidden && selectedGenRank < 5) continue
      return { hasAbility: true, isHidden }
    }
  }

  return null
}

export default function AbilityPage({ initialAbility, initialVersion, onStateChange, onPokemonClick }) {
  const [abilityList, setAbilityList] = useState([])
  const [searchInput, setSearchInput] = useState(initialAbility || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const containerRef = useRef(null)
  const userIsTypingRef = useRef(false)

  const [abilityData, setAbilityData] = useState(null)
  const [abilityLoading, setAbilityLoading] = useState(false)
  const [abilityError, setAbilityError] = useState(null)

  const [selectedVersion, setSelectedVersion] = useState(initialVersion || null)
  const [availableVersions, setAvailableVersions] = useState([])
  const [pendingInitialVersion, setPendingInitialVersion] = useState(initialVersion || null)

  const [pokemonWithAbility, setPokemonWithAbility] = useState([])
  const [pokemonLoading, setPokemonLoading] = useState(false)
  const [pokemonProgress, setPokemonProgress] = useState({ loaded: 0, total: 0 })
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })

  const abortRef = useRef(null)

  // Auto-load ability from URL on mount
  const hasLoadedFromUrl = useRef(false)
  useEffect(() => {
    if (hasLoadedFromUrl.current || !initialAbility) return
    hasLoadedFromUrl.current = true
    searchAbility(initialAbility)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ability names list for autocomplete (gen 3-7 only, main series only)
  useEffect(() => {
    const fetchAbilityList = async () => {
      try {
        const genPromises = []
        for (let g = 3; g <= 7; g++) {
          genPromises.push(fetch(`https://pokeapi.co/api/v2/generation/${g}/`).then(r => r.json()))
        }
        const genData = await Promise.all(genPromises)
        const names = new Set()
        for (const gen of genData) {
          for (const ability of (gen.abilities || [])) {
            // Filter out non-main-series abilities (IDs >= 10001)
            const idMatch = ability.url?.match(/\/(\d+)\/?$/)
            if (idMatch && Number(idMatch[1]) >= 10001) continue
            names.add(ability.name)
          }
        }
        setAbilityList(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to fetch ability list:', err)
      }
    }
    fetchAbilityList()
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
    const filtered = abilityList.filter(n => n.replace(/-/g, '').includes(q)).slice(0, 8)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setActiveSuggestion(0)
  }, [searchInput, abilityList])

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

  // Compute available versions from ability data
  useEffect(() => {
    if (!abilityData) {
      setAvailableVersions([])
      return
    }

    // Abilities were introduced in Gen 3. Determine the intro generation from
    // the ability's generation field.
    const introGen = abilityData.generation?.name
      ? (generationOrder[abilityData.generation.name] || 3)
      : 3

    // Build a set of all versions from intro gen onward
    const versionSet = new Set()
    for (let gen = introGen; gen <= 9; gen++) {
      const versions = generationVersions[gen] || []
      versions.forEach(v => versionSet.add(v))
    }

    // Build grouped/sorted version options
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
  }, [abilityData])

  // Auto-select latest version when available versions change
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

  // Fetch Pokémon with this ability, filtered by selected version
  useEffect(() => {
    if (!abilityData || !selectedVersion) {
      setPokemonWithAbility([])
      return
    }

    // Abort previous fetch
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const selectedGen = versionGeneration[selectedVersion]
    const currentGenVgs = new Set(generationVersionGroups[selectedGen] || [])
    const pokemonEntries = abilityData.pokemon || []

    setPokemonLoading(true)
    setPokemonProgress({ loaded: 0, total: pokemonEntries.length })
    setPokemonWithAbility([])

    let cancelled = false
    const results = []

    const fetchPokemon = async () => {
      const BATCH_SIZE = 25
      for (let i = 0; i < pokemonEntries.length; i += BATCH_SIZE) {
        if (controller.signal.aborted) return

        const batch = pokemonEntries.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (entry) => {
            try {
              const pokemonName = entry.pokemon?.name
              if (!pokemonName) return null

              const data = await fetchPokemonCached(pokemonName)
              if (!data || controller.signal.aborted) return null

              // Skip form-specific Pokémon not available in selected version
              // (e.g. primals outside ORAS, megas outside XY/ORAS/etc.)
              if (!isFormAvailableInVersion(pokemonName, selectedVersion)) return null

              // Check if the Pokémon exists in the selected generation
              // by verifying it has move data in the current gen's version groups
              const existsInCurrentGen = data.moves?.some(m =>
                m.version_group_details?.some(vgd => currentGenVgs.has(vgd.version_group?.name))
              )
              if (!existsInCurrentGen) return null

              // Check if the Pokémon actually has this ability in the selected
              // generation by reconstructing abilities from past_abilities data
              const abilityCheck = pokemonHasAbilityInGen(data, abilityData.name, selectedGen)
              if (!abilityCheck) return null

              const isHidden = abilityCheck.isHidden
              const slot = entry.slot

              // Use species dex number so forms show the base ID
              const finalSpeciesId = data.species?.url
                ? Number(data.species.url.match(/\/(\d+)\/?$/)?.[1]) || data.id
                : data.id

              return {
                name: data.name,
                id: finalSpeciesId,
                isHidden,
                slot,
              }
            } catch {
              return null
            }
          })
        )

        if (controller.signal.aborted) return

        const valid = batchResults.filter(Boolean)
        results.push(...valid)

        const sorted = [...results].sort((a, b) => a.id - b.id)

        if (!cancelled) {
          setPokemonWithAbility(sorted)
          setPokemonProgress({ loaded: Math.min(i + BATCH_SIZE, pokemonEntries.length), total: pokemonEntries.length })
        }
      }

      if (!cancelled) {
        setPokemonLoading(false)
      }
    }

    fetchPokemon()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [abilityData, selectedVersion])

  // Report state changes to parent for URL sync
  useEffect(() => {
    if (onStateChange && abilityData) {
      onStateChange({ version: selectedVersion, ability: abilityData.name })
    }
  }, [selectedVersion, abilityData, onStateChange])

  const searchAbility = async (name) => {
    const query = String(name).trim().toLowerCase().replace(/\s+/g, '-')
    if (!query) return

    userIsTypingRef.current = false
    setSearchInput(formatAbilityName(query))
    setShowSuggestions(false)
    setAbilityLoading(true)
    setAbilityError(null)
    setAbilityData(null)
    setPokemonWithAbility([])

    try {
      const data = await fetchAbilityCached(query)
      if (!data) throw new Error('Ability not found')
      if (data.is_main_series === false) throw new Error('This ability is from a non-main series game and is not supported.')
      setAbilityData(data)
    } catch (err) {
      setAbilityError(err.message || 'Failed to fetch ability')
    } finally {
      setAbilityLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (searchInput.trim()) searchAbility(searchInput)
  }

  const handleSuggestionClick = (name) => {
    searchAbility(name)
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
    if (!abilityData || !selectedVersion) return null
    const gen = versionGeneration[selectedVersion]

    // Try to find a flavor text from the same generation
    const genVgs = generationVersionGroups[gen] || []
    for (const vg of genVgs) {
      const entry = abilityData.flavor_text_entries?.find(
        fte => fte.language?.name === 'en' && fte.version_group?.name === vg
      )
      if (entry) return entry.flavor_text?.replace(/\n/g, ' ')
    }

    // Fallback: latest English flavor text
    const allEn = abilityData.flavor_text_entries?.filter(fte => fte.language?.name === 'en') || []
    if (allEn.length > 0) return allEn[allEn.length - 1].flavor_text?.replace(/\n/g, ' ')

    return null
  }

  // Get detailed effect text
  const getEffect = () => {
    if (!abilityData) return null
    const effect = abilityData.effect_entries?.find(e => e.language?.name === 'en')
    return effect?.effect || effect?.short_effect || null
  }

  const getShortEffect = () => {
    if (!abilityData) return null
    const effect = abilityData.effect_entries?.find(e => e.language?.name === 'en')
    return effect?.short_effect || null
  }

  const description = getDescription()
  const shortEffect = getShortEffect()

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

  const sortedPokemon = [...pokemonWithAbility].sort((a, b) => {
    let valueA, valueB
    switch (sortConfig.key) {
      case 'id':
        valueA = a.id; valueB = b.id; break
      case 'name':
        valueA = a.name; valueB = b.name; break
      case 'hidden':
        valueA = a.isHidden ? 1 : 0; valueB = b.isHidden ? 1 : 0; break
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
    <div className="ability-page">
      {/* Search + Version row */}
      <div className="page-search-row">
        {abilityData && availableVersions.length > 0 && (
          <div className="page-version-inline">
            <label htmlFor="ability-version-select">Version:</label>
            <select
              id="ability-version-select"
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
        <div className="search-container page-search-inline" ref={containerRef}>
          <form onSubmit={handleSubmit} className="search-form">
            <div className="search-input-wrapper">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => { userIsTypingRef.current = true; setSearchInput(e.target.value) }}
                onKeyDown={handleKeyDown}
                onFocus={() => searchInput && setShowSuggestions(suggestions.length > 0)}
                placeholder="Enter ability name..."
                autoComplete="off"
              />
              <button type="submit" disabled={abilityLoading}>Search</button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((s, idx) => (
                  <li
                    key={s}
                    className={`suggestion-item ${idx === activeSuggestion ? 'active' : ''}`}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {formatAbilityName(s)}
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>
      </div>

      {abilityError && <div className="error">{abilityError}</div>}
      {abilityLoading && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball" /></div>}

      {abilityData && (
        <>
          {/* Ability Details Box */}
          <div className="ability-detail-card">
            <div className="ability-detail-header">
              <h2 className="ability-detail-name">{formatAbilityName(abilityData.name)}</h2>
              <div className="ability-detail-tags">
                <span className="ability-gen-badge">
                  {abilityData.generation?.name
                    ? `Introduced in Generation ${generationOrder[abilityData.generation.name] || '?'}`
                    : ''}
                </span>
                {abilityData.is_main_series === false && (
                  <span className="ability-non-main-badge">Non-Main Series</span>
                )}
              </div>
            </div>

            {description && (
              <div className="ability-detail-description">
                <div className="ability-description-label">In-Game Description</div>
                {description}
              </div>
            )}

            {shortEffect && (
              <div className="ability-detail-effect">
                <div className="ability-description-label">Effect</div>
                {shortEffect}
              </div>
            )}
          </div>

          {/* Pokémon Table */}
          <div className="ability-pokemon-section">
            <div className="ability-pokemon-header">
              <h3>Pokémon with {formatAbilityName(abilityData.name)}</h3>
              {pokemonLoading && (
                <span className="ability-pokemon-progress">
                  <video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball-inline" />
                  {pokemonProgress.loaded}/{pokemonProgress.total}
                </span>
              )}
            </div>

            {pokemonWithAbility.length > 0 ? (
              <div className="ability-pokemon-table-wrapper">
                <table className="ability-pokemon-table">
                  <thead>
                    <tr>
                      <th><button type="button" onClick={() => handleSort('id')}>#{getSortIndicator('id')}</button></th>
                      <th><button type="button" onClick={() => handleSort('name')}>Pokémon{getSortIndicator('name')}</button></th>
                      <th><button type="button" onClick={() => handleSort('hidden')}>Type{getSortIndicator('hidden')}</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPokemon.map(pkmn => (
                      <tr key={pkmn.name}>
                        <td className="learner-id">{pkmn.id}</td>
                        <td className="learner-name">
                          {onPokemonClick
                            ? <button type="button" className="pokemon-name-link" onClick={() => onPokemonClick(pkmn.name, selectedVersion)}>{formatPokemonName(pkmn.name)}</button>
                            : formatPokemonName(pkmn.name)
                          }
                        </td>
                        <td className="ability-type-cell">
                          <span className={`ability-type-badge ${pkmn.isHidden ? 'ability-hidden' : 'ability-regular'}`}>
                            {pkmn.isHidden ? 'Hidden' : 'Regular'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !pokemonLoading && <div className="ability-no-pokemon">No Pokémon have this ability in the selected version.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
