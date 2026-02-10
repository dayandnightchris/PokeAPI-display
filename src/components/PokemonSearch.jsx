import { useState, useRef, useEffect } from 'react'

export default function PokemonSearch({ onSearch, loading, pokemonList }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
    setInput(suggestion)
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => input && setShowSuggestions(suggestions.length > 0)}
            placeholder="Enter Pokemon name or ID..."
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
                onClick={() => handleSuggestionClick(suggestion)}
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

