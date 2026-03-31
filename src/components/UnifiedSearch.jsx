import { useState, useRef, useEffect } from 'react'

// Hierarchy: Pokemon > Location > Move > Ability > Item
const CATEGORY_ORDER = ['pokemon', 'locations', 'moves', 'abilities', 'items']

const CATEGORY_META = {
  pokemon:   { label: 'Pokémon',  priority: 1 },
  locations: { label: 'Location', priority: 2 },
  moves:     { label: 'Move',     priority: 3 },
  abilities: { label: 'Ability',  priority: 4 },
  items:     { label: 'Item',     priority: 5 },
}

/**
 * Unified search bar that searches across all categories (Pokemon, moves, abilities, items, locations).
 * Prioritises the current tab's category in results.
 *
 * Props:
 *   lists          – { pokemon, pokemonIdMap, moves, abilities, items, locations }
 *   onNavigate     – (category, name) => void   Navigate to a result in the given category
 *   activeTab      – current tab id (e.g. 'pokemon') to prioritise results
 *   placeholder    – optional placeholder text
 *   initialQuery   – optional initial input value
 *   loading        – optional loading state to disable input
 */
export default function UnifiedSearch({ lists, onNavigate, activeTab, placeholder, initialQuery, loading }) {
  const [input, setInput] = useState(initialQuery || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const containerRef = useRef(null)
  const userIsTypingRef = useRef(false)

  // Sync input when initialQuery changes (e.g. from URL load or evo click)
  useEffect(() => {
    if (initialQuery != null) {
      userIsTypingRef.current = false
      setInput(initialQuery)
    }
  }, [initialQuery])

  // Build suggestions when input changes
  useEffect(() => {
    const cleaned = input.replace(/#/g, '').trim()
    if (!cleaned || !userIsTypingRef.current) {
      if (!cleaned) {
        setSuggestions([])
        setShowSuggestions(false)
      }
      return
    }

    const q = cleaned.toLowerCase().replace(/\s+/g, '-')
    const qNoSep = cleaned.toLowerCase().replace(/[-\s]/g, '')
    const isNumeric = /^\d+$/.test(cleaned)

    const MAX_PER_CATEGORY = 4

    // Helper to score a match within a category — lower is better
    const score = (name) => {
      const nameClean = name.replace(/-/g, '')
      if (name === q) return 0
      if (name.startsWith(q)) return 1
      if (nameClean.startsWith(qNoSep)) return 2
      return 3
    }

    // Collect matches per category
    const perCategory = {}

    // Pokemon — support numeric dex search
    if (lists.pokemon?.length) {
      if (isNumeric && lists.pokemonIdMap) {
        perCategory.pokemon = Object.entries(lists.pokemonIdMap)
          .filter(([id]) => id.startsWith(cleaned))
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .slice(0, MAX_PER_CATEGORY)
          .map(([id, name]) => ({ name, category: 'pokemon', score: score(name), displayId: id }))
      } else {
        perCategory.pokemon = lists.pokemon
          .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
          .slice(0, MAX_PER_CATEGORY)
          .map(name => ({ name, category: 'pokemon', score: score(name) }))
      }
    }

    // Locations
    if (lists.locations?.length) {
      perCategory.locations = lists.locations
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'locations', score: score(name) }))
    }

    // Moves
    if (lists.moves?.length) {
      perCategory.moves = lists.moves
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'moves', score: score(name) }))
    }

    // Abilities
    if (lists.abilities?.length) {
      perCategory.abilities = lists.abilities
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'abilities', score: score(name) }))
    }

    // Items
    if (lists.items?.length) {
      perCategory.items = lists.items
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'items', score: score(name) }))
    }

    // Build grouped list in hierarchy order: Pokemon > Location > Move > Ability > Item
    // Each category's results are sorted by score within the group
    const grouped = []
    for (const cat of CATEGORY_ORDER) {
      const items = perCategory[cat]
      if (items && items.length > 0) {
        items.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
        grouped.push({ type: 'header', category: cat, label: CATEGORY_META[cat].label })
        grouped.push(...items.map(item => ({ ...item, type: 'item' })))
      }
    }

    setSuggestions(grouped)
    setShowSuggestions(grouped.length > 0)
    setActiveSuggestion(grouped.findIndex(s => s.type === 'item'))
  }, [input, lists, activeTab])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const navigateToResult = (suggestion) => {
    const name = typeof suggestion === 'object' ? suggestion.name : suggestion
    const category = typeof suggestion === 'object' ? suggestion.category : activeTab
    userIsTypingRef.current = false
    setInput(name)
    setShowSuggestions(false)
    onNavigate(category, name)
    // Blur input to dismiss mobile keyboard
    if (containerRef.current) {
      const inp = containerRef.current.querySelector('input')
      if (inp) inp.blur()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleaned = input.replace(/#/g, '').trim().toLowerCase().replace(/\s+/g, '-')
    if (!cleaned) return

    // If there's a selected suggestion, use it
    if (suggestions[activeSuggestion]) {
      navigateToResult(suggestions[activeSuggestion])
      return
    }

    // Otherwise, default to the active tab's search
    onNavigate(activeTab, cleaned)
    setInput(cleaned)
    setShowSuggestions(false)
  }

  // Find next/prev selectable item index (skip headers)
  const findNextItem = (from, direction) => {
    let idx = from
    for (let i = 0; i < suggestions.length; i++) {
      idx = (idx + direction + suggestions.length) % suggestions.length
      if (suggestions[idx]?.type === 'item') return idx
    }
    return from
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveSuggestion(prev => findNextItem(prev, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveSuggestion(prev => findNextItem(prev, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (suggestions[activeSuggestion]?.type === 'item') {
          navigateToResult(suggestions[activeSuggestion])
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

  const formatName = (name) => name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="search-container" ref={containerRef}>
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => { userIsTypingRef.current = true; setInput(e.target.value) }}
            onKeyDown={handleKeyDown}
            onFocus={() => input && setShowSuggestions(suggestions.length > 0)}
            placeholder={placeholder || 'Search BlisyDex'}
            disabled={loading}
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            Search
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map((entry, idx) => {
              if (entry.type === 'header') {
                return (
                  <li
                    key={`header-${entry.category}`}
                    className="suggestion-category-header"
                    data-category={entry.category}
                  >
                    {entry.label}
                  </li>
                )
              }
              return (
                <li
                  key={`${entry.category}-${entry.name}`}
                  className={`suggestion-item ${idx === activeSuggestion ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); navigateToResult(entry) }}
                  onTouchEnd={(e) => { e.preventDefault(); navigateToResult(entry) }}
                >
                  {entry.displayId && <span style={{ color: '#888', marginRight: '4px' }}>#{entry.displayId}</span>}
                  <span className="suggestion-name">{formatName(entry.name)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </form>
    </div>
  )
}
