import { useState, useEffect, useRef } from 'react'
import { versionDisplayNames, versionGeneration, generationOrder, generationVersions } from '../utils/versionInfo'
import { fetchItemCached, fetchMachineCached } from '../utils/pokeCache'

function formatItemName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatPokemonName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Map version names used by PokeAPI held_by_pokemon to our version names
// (The API uses individual version names like "ruby", "sapphire", etc.)
function normalizeVersionName(apiVersion) {
  return apiVersion // The API version names match our versionGeneration keys
}

// Map individual version name → version group name
const versionToVg = {
  'red': 'red-blue', 'blue': 'red-blue', 'yellow': 'yellow',
  'gold': 'gold-silver', 'silver': 'gold-silver', 'crystal': 'crystal',
  'ruby': 'ruby-sapphire', 'sapphire': 'ruby-sapphire', 'emerald': 'emerald',
  'firered': 'firered-leafgreen', 'leafgreen': 'firered-leafgreen',
  'colosseum': 'colosseum', 'xd': 'xd',
  'diamond': 'diamond-pearl', 'pearl': 'diamond-pearl', 'platinum': 'platinum',
  'heartgold': 'heartgold-soulsilver', 'soulsilver': 'heartgold-soulsilver',
  'black': 'black-white', 'white': 'black-white',
  'black-2': 'black-2-white-2', 'white-2': 'black-2-white-2',
  'x': 'x-y', 'y': 'x-y',
  'omega-ruby': 'omega-ruby-alpha-sapphire', 'alpha-sapphire': 'omega-ruby-alpha-sapphire',
  'sun': 'sun-moon', 'moon': 'sun-moon',
  'ultra-sun': 'ultra-sun-ultra-moon', 'ultra-moon': 'ultra-sun-ultra-moon',
  'lets-go-pikachu': 'lets-go-pikachu-lets-go-eevee', 'lets-go-eevee': 'lets-go-pikachu-lets-go-eevee',
  'sword': 'sword-shield', 'shield': 'sword-shield',
  'brilliant-diamond': 'brilliant-diamond-and-shining-pearl', 'shining-pearl': 'brilliant-diamond-and-shining-pearl',
  'legends-arceus': 'legends-arceus',
  'scarlet': 'scarlet-violet', 'violet': 'scarlet-violet',
  'legends-za': 'legends-za',
}

export default function ItemPage({ initialItem, initialVersion, onStateChange, onPokemonClick, onMoveClick }) {
  const [itemList, setItemList] = useState([])
  const [searchInput, setSearchInput] = useState(initialItem || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const containerRef = useRef(null)
  const userIsTypingRef = useRef(false)

  const [itemData, setItemData] = useState(null)
  const [itemLoading, setItemLoading] = useState(false)
  const [itemError, setItemError] = useState(null)

  const [selectedVersion, setSelectedVersion] = useState(initialVersion || null)
  const [availableVersions, setAvailableVersions] = useState([])
  const [pendingInitialVersion, setPendingInitialVersion] = useState(initialVersion || null)

  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })
  const [machineMove, setMachineMove] = useState(null) // { name, url } for TM/HM items

  // Auto-load item from URL on mount
  const hasLoadedFromUrl = useRef(false)
  useEffect(() => {
    if (hasLoadedFromUrl.current || !initialItem) return
    hasLoadedFromUrl.current = true
    searchItem(initialItem)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch item names list for autocomplete
  useEffect(() => {
    const fetchItemList = async () => {
      try {
        const first = await fetch('https://pokeapi.co/api/v2/item/').then(r => r.json())
        const all = await fetch(`https://pokeapi.co/api/v2/item/?limit=${first.count}`).then(r => r.json())
        setItemList(all.results.map(i => i.name).sort())
      } catch (err) {
        console.error('Failed to fetch item list:', err)
      }
    }
    fetchItemList()
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
    const filtered = itemList.filter(n => n.replace(/-/g, '').includes(q)).slice(0, 8)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setActiveSuggestion(0)
  }, [searchInput, itemList])

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

  // Compute available versions from item data
  useEffect(() => {
    if (!itemData) {
      setAvailableVersions([])
      return
    }

    // Determine the intro generation from the item data
    // Items have game_indices with generation info, or we can use the category
    // Held items started in Gen 2. Use flavor_text_entries version groups to determine availability.
    const versionSet = new Set()

    // Collect versions from flavor_text_entries
    itemData.flavor_text_entries?.forEach(fte => {
      const vgName = fte.version_group?.name
      if (!vgName) return
      // Map version group to versions
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
      const versions = vgToVersions[vgName]
      if (versions) versions.forEach(v => versionSet.add(v))
    })

    // Also collect from held_by_pokemon version_details
    itemData.held_by_pokemon?.forEach(entry => {
      entry.version_details?.forEach(vd => {
        const vName = vd.version?.name
        if (vName) versionSet.add(vName)
      })
    })

    // Also check game_indices
    itemData.game_indices?.forEach(gi => {
      const genName = gi.generation?.name
      if (genName) {
        const genNum = generationOrder[genName]
        if (genNum) {
          const versions = generationVersions[genNum] || []
          versions.forEach(v => versionSet.add(v))
        }
      }
    })

    // Build grouped/sorted version options (filter out gen 8/9)
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
  }, [itemData])

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

  // Report state changes to parent for URL sync
  useEffect(() => {
    if (onStateChange && itemData) {
      onStateChange({ version: selectedVersion, item: itemData.name })
    }
  }, [selectedVersion, itemData, onStateChange])

  const searchItem = async (name) => {
    const query = String(name).trim().toLowerCase().replace(/\s+/g, '-')
    if (!query) return

    userIsTypingRef.current = false
    setSearchInput(formatItemName(query))
    setShowSuggestions(false)
    setItemLoading(true)
    setItemError(null)
    setItemData(null)

    try {
      const data = await fetchItemCached(query)
      if (!data) throw new Error('Item not found')
      setItemData(data)
    } catch (err) {
      setItemError(err.message || 'Failed to fetch item')
    } finally {
      setItemLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (searchInput.trim()) searchItem(searchInput)
  }

  const handleSuggestionClick = (name) => {
    searchItem(name)
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

  // Resolve the move taught by this TM/HM/TR for the selected version
  useEffect(() => {
    if (!itemData?.machines?.length || !selectedVersion) {
      setMachineMove(null)
      return
    }

    // Only relevant for TM/HM/TR items (category: all-machines or similar)
    const isMachineItem = /^(tm|hm|tr)\d+$/i.test(itemData.name)
    if (!isMachineItem) {
      setMachineMove(null)
      return
    }

    let active = true
    const vg = versionToVg[selectedVersion]
    const genNum = versionGeneration[selectedVersion]
    const sameGenVgs = new Set()
    if (genNum) {
      for (const [gen, vgs] of Object.entries(generationVersions)) {
        // generationVersions uses gen numbers as keys; match via versionToVg values
      }
    }

    // Prefer exact version group match, then any from the same gen
    const machineEntry = itemData.machines.find(m => m.version_group?.name === vg)
      || itemData.machines.find(m => {
        const mVg = m.version_group?.name
        if (!mVg) return false
        // Check if this machine's version group is in the same generation
        // by seeing if any version in our gen maps to this vg
        return Object.entries(versionToVg).some(([ver, verVg]) =>
          verVg === mVg && versionGeneration[ver] === genNum
        )
      })

    if (!machineEntry?.machine?.url) {
      setMachineMove(null)
      return
    }

    const fetchMachineMove = async () => {
      const data = await fetchMachineCached(machineEntry.machine.url)
      if (!active) return
      if (data?.move?.name) {
        setMachineMove({ name: data.move.name })
      } else {
        setMachineMove(null)
      }
    }
    fetchMachineMove()

    return () => { active = false }
  }, [itemData, selectedVersion])

  // Get description for selected version
  const getDescription = () => {
    if (!itemData || !selectedVersion) return null
    const gen = versionGeneration[selectedVersion]

    const vg = versionToVg[selectedVersion]
    if (vg) {
      const entry = itemData.flavor_text_entries?.find(
        fte => fte.language?.name === 'en' && fte.version_group?.name === vg
      )
      if (entry) return entry.text?.replace(/\n/g, ' ')
    }

    // Fallback: latest English flavor text
    const allEn = itemData.flavor_text_entries?.filter(fte => fte.language?.name === 'en') || []
    if (allEn.length > 0) return allEn[allEn.length - 1].text?.replace(/\n/g, ' ')

    return null
  }

  // Get effect text
  const getEffect = () => {
    if (!itemData) return null
    const effect = itemData.effect_entries?.find(e => e.language?.name === 'en')
    return effect?.short_effect || null
  }

  // Get category display name
  const getCategoryDisplay = () => {
    if (!itemData?.category?.name) return null
    return itemData.category.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // Get Pokémon that hold this item in the selected version
  const getHolders = () => {
    if (!itemData?.held_by_pokemon || !selectedVersion) return []

    return itemData.held_by_pokemon
      .map(entry => {
        const pokemonName = entry.pokemon?.name
        if (!pokemonName) return null

        // Find the version detail matching the selected version
        const versionDetail = entry.version_details?.find(
          vd => vd.version?.name === selectedVersion
        )
        if (!versionDetail) return null

        // Extract species ID from pokemon URL
        // Note: held_by_pokemon uses pokemon URLs, not species URLs
        const pokemonId = entry.pokemon?.url
          ? Number(entry.pokemon.url.match(/\/(\d+)\/?$/)?.[1]) || 0
          : 0

        return {
          name: pokemonName,
          id: pokemonId,
          rarity: versionDetail.rarity || 0,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.id - b.id)
  }

  const description = getDescription()
  const effect = getEffect()
  const category = getCategoryDisplay()
  const holders = getHolders()

  // Get the item's intro generation
  // Note: PokeAPI game_indices for items only starts at Gen 3, so Gen 1/2
  // items incorrectly report Gen 3 as earliest. We flag this uncertainty.
  const getIntroGen = () => {
    if (!itemData?.game_indices?.length) return null
    let earliest = 99
    for (const gi of itemData.game_indices) {
      const genNum = generationOrder[gi.generation?.name]
      if (genNum && genNum < earliest) earliest = genNum
    }
    return earliest < 99 ? earliest : null
  }

  const introGen = getIntroGen()
  // API doesn't have Gen 1/2 item indices, so Gen 3 = "3 or earlier"
  const introGenUncertain = introGen === 3

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

  const sortedHolders = [...holders].sort((a, b) => {
    let valueA, valueB
    switch (sortConfig.key) {
      case 'id':
        valueA = a.id; valueB = b.id; break
      case 'name':
        valueA = a.name; valueB = b.name; break
      case 'rarity':
        valueA = a.rarity; valueB = b.rarity; break
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

  // Get the item sprite URL
  const spriteUrl = itemData?.sprites?.default || null

  return (
    <div className="item-page">
      {/* Search + Version row */}
      <div className="page-search-row">
        {itemData && availableVersions.length > 0 && (
          <div className="page-version-inline">
            <label htmlFor="item-version-select">Version:</label>
            <select
              id="item-version-select"
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
                placeholder="Enter item name..."
                autoComplete="off"
              />
              <button type="submit" disabled={itemLoading}>Search</button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((s, idx) => (
                  <li
                    key={s}
                    className={`suggestion-item ${idx === activeSuggestion ? 'active' : ''}`}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {formatItemName(s)}
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>
      </div>

      {itemError && <div className="error">{itemError}</div>}
      {itemLoading && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball" /></div>}

      {itemData && (
        <>
          {/* Item Details Box */}
          <div className="item-detail-card">
            <div className="item-detail-header">
              <div className="item-detail-title-row">
                {spriteUrl && (
                  <img src={spriteUrl} alt={itemData.name} className="item-detail-sprite" />
                )}
                <h2 className="item-detail-name">{formatItemName(itemData.name)}</h2>
              </div>
              <div className="item-detail-tags">
                {introGen && (
                  <span className="item-gen-badge">
                    {introGenUncertain
                      ? 'Introduced in Gen 3 or earlier'
                      : `Introduced in Generation ${introGen}`
                    }
                  </span>
                )}
                {category && (
                  <span className="item-category-badge">
                    {category}
                  </span>
                )}
                {itemData.cost > 0 && (
                  <span className="item-cost-badge">
                    ₽{itemData.cost.toLocaleString()}
                  </span>
                )}
                {itemData.fling_power != null && itemData.fling_power > 0 && (
                  <span className="item-fling-badge">
                    Fling: {itemData.fling_power}
                  </span>
                )}
              </div>
            </div>

            {description && (
              <div className="item-detail-description">
                <div className="item-description-label">In-Game Description</div>
                {description}
              </div>
            )}

            {machineMove && (
              <div className="item-detail-effect">
                <div className="item-description-label">Teaches Move</div>
                {onMoveClick
                  ? <button type="button" className="move-name-link" onClick={() => onMoveClick(machineMove.name)}>{formatItemName(machineMove.name)}</button>
                  : formatItemName(machineMove.name)
                }
              </div>
            )}

            {effect && !machineMove && (
              <div className="item-detail-effect">
                <div className="item-description-label">Effect</div>
                {effect}
              </div>
            )}
          </div>

          {/* Pokémon Holders Table */}
          {itemData.held_by_pokemon?.length > 0 && (
            <div className="item-holders-section">
              <div className="item-holders-header">
                <h3>Wild Pokémon holding {formatItemName(itemData.name)}</h3>
              </div>

              {sortedHolders.length > 0 ? (
                <div className="item-holders-table-wrapper">
                  <table className="item-holders-table">
                    <thead>
                      <tr>
                        <th><button type="button" onClick={() => handleSort('id')}>#{getSortIndicator('id')}</button></th>
                        <th><button type="button" onClick={() => handleSort('name')}>Pokémon{getSortIndicator('name')}</button></th>
                        <th><button type="button" onClick={() => handleSort('rarity')}>Chance{getSortIndicator('rarity')}</button></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedHolders.map(holder => (
                        <tr key={holder.name}>
                          <td className="learner-id">{holder.id}</td>
                          <td className="learner-name">
                            {onPokemonClick
                              ? <button type="button" className="pokemon-name-link" onClick={() => onPokemonClick(holder.name, selectedVersion)}>{formatPokemonName(holder.name)}</button>
                              : formatPokemonName(holder.name)
                            }
                          </td>
                          <td className="item-rarity-cell">
                            <span className="item-rarity-badge">
                              {holder.rarity}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="item-no-holders">No Pokémon hold this item in the selected version.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
