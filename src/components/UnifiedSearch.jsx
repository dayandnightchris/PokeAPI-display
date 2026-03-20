import { useState, useRef, useEffect } from 'react'

const CATEGORY_META = {
  pokemon:   { label: 'Pokémon',  icon: '🐾', priority: 1 },
  moves:     { label: 'Move',     icon: '⚔️', priority: 2 },
  abilities: { label: 'Ability',  icon: '🌟', priority: 3 },
  items:     { label: 'Item',     icon: '🎒', priority: 4 },
  locations: { label: 'Location', icon: '📍', priority: 5 },
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

    const results = []
    const MAX_PER_CATEGORY = 4
    const MAX_TOTAL = 8

    // Helper to score a match — lower is better
    const score = (name, category) => {
      const isActiveTab = category === activeTab
      const nameClean = name.replace(/-/g, '')
      if (name === q) return isActiveTab ? 0 : 1
      if (name.startsWith(q)) return isActiveTab ? 2 : 3
      if (nameClean.startsWith(qNoSep)) return isActiveTab ? 4 : 5
      return isActiveTab ? 6 : 7
    }

    // Pokemon — support numeric dex search
    if (lists.pokemon?.length) {
      if (isNumeric && lists.pokemonIdMap) {
        const matches = Object.entries(lists.pokemonIdMap)
          .filter(([id]) => id.startsWith(cleaned))
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .slice(0, MAX_PER_CATEGORY)
          .map(([id, name]) => ({ name, category: 'pokemon', score: score(name, 'pokemon'), displayId: id }))
        results.push(...matches)
      } else {
        const matches = lists.pokemon
          .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
          .slice(0, MAX_PER_CATEGORY)
          .map(name => ({ name, category: 'pokemon', score: score(name, 'pokemon') }))
        results.push(...matches)
      }
    }

    // Moves
    if (lists.moves?.length) {
      const matches = lists.moves
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'moves', score: score(name, 'moves') }))
      results.push(...matches)
    }

    // Abilities
    if (lists.abilities?.length) {
      const matches = lists.abilities
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'abilities', score: score(name, 'abilities') }))
      results.push(...matches)
    }

    // Items
    if (lists.items?.length) {
      const matches = lists.items
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'items', score: score(name, 'items') }))
      results.push(...matches)
    }

    // Locations
    if (lists.locations?.length) {
      const matches = lists.locations
        .filter(name => name.includes(q) || name.replace(/-/g, '').includes(qNoSep))
        .slice(0, MAX_PER_CATEGORY)
        .map(name => ({ name, category: 'locations', score: score(name, 'locations') }))
      results.push(...matches)
    }

    // Sort by score (active tab first, then exact/prefix/contains), limit total
    results.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    const limited = results.slice(0, MAX_TOTAL)

    setSuggestions(limited)
    setShowSuggestions(limited.length > 0)
    setActiveSuggestion(0)
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
            {suggestions.map((suggestion, idx) => {
              const meta = CATEGORY_META[suggestion.category]
              return (
                <li
                  key={`${suggestion.category}-${suggestion.name}`}
                  className={`suggestion-item ${idx === activeSuggestion ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); navigateToResult(suggestion) }}
                  onTouchEnd={(e) => { e.preventDefault(); navigateToResult(suggestion) }}
                >
                  <span className="suggestion-category-badge" data-category={suggestion.category}>
                    {meta?.icon} {meta?.label}
                  </span>
                  {suggestion.displayId && <span style={{ color: '#888', marginRight: '4px' }}>#{suggestion.displayId}</span>}
                  <span className="suggestion-name">{formatName(suggestion.name)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </form>
    </div>
  )
}
