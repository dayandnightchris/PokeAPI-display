import { useState, useRef, useEffect } from 'react'

export default function PokemonSearch({ onSearch, loading, pokemonList, initialQuery }) {
  const [input, setInput] = useState(initialQuery || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const containerRef = useRef(null)
  // True only when the user is actively typing; false for programmatic input changes
  const userIsTypingRef = useRef(false)

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Only show suggestions when the user is actively typing
    if (!userIsTypingRef.current) {
      return
    }

    // Filter Pokemon list for autocomplete
    const q = input.toLowerCase()
    const filtered = pokemonList
      .filter(name => name.includes(q))
      .slice(0, 8) //limit to 8 suggestions

    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setActiveSuggestion(0)
  }, [input, pokemonList])

  // Sync input when initialQuery changes (e.g. from URL load or evo click)
  useEffect(() => {
    if (initialQuery) {
      userIsTypingRef.current = false
      setInput(initialQuery)
    }
  }, [initialQuery])

  // Close suggestions when clicking/tapping outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSearch(input)
      setInput(input.trim().toLowerCase())
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion) => {
    onSearch(suggestion)
    userIsTypingRef.current = false
    setInput(suggestion)
    setShowSuggestions(false)
    // Blur input to dismiss mobile keyboard
    if (containerRef.current) {
      const inp = containerRef.current.querySelector('input')
      if (inp) inp.blur()
    }
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
            placeholder="Enter Pokemon name or dex number..."
            disabled={loading}
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            Search
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map((suggestion, idx) => (
              <li
                key={suggestion}
                className={`suggestion-item ${idx === activeSuggestion ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(suggestion) }}
                onTouchEnd={(e) => { e.preventDefault(); handleSuggestionClick(suggestion) }}
              >
                {suggestion.charAt(0).toUpperCase() + suggestion.slice(1)}
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  )
}

