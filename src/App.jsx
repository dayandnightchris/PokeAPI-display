import { useState, useEffect, useRef } from 'react'
import './App.css'
import PokemonCard from './components/PokemonCard'
import PokemonSearch from './components/PokemonSearch'

function App() {
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pokemonList, setPokemonList] = useState([])

  // Track the latest in-flight request
  const abortRef = useRef(null)
  const requestIdRef = useRef(0)

  // Fetch all Pokemon names for autocomplete on mount
  useEffect(() => {
    const fetchPokemonList = async () => {
      try {
        const base = 'https://pokeapi.co/api/v2/pokemon'
        const first = await fetch(base).then(r => r.json())
        const all = await fetch(`${base}?limit=${first.count}`).then(r => r.json())
        setPokemonList(all.results.map(p => p.name))
      } catch (err) {
        console.error('Failed to fetch Pokemon list:', err)
      }
    }
    fetchPokemonList()
  }, [])

  const fetchPokemon = async (nameOrId) => {
    const query = String(nameOrId).trim().toLowerCase()
    if (!query) return

    // Increment request id, abort previous request
    const myRequestId = ++requestIdRef.current
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Pokemon not found')

      const data = await response.json()

      // Only apply if this is still the latest request
      if (requestIdRef.current === myRequestId) {
        setPokemon(data)
      }
    } catch (err) {
      // Ignore abort errors
      if (err?.name === 'AbortError') return

      if (requestIdRef.current === myRequestId) {
        setError(err.message)
        setPokemon(null)
      }
    } finally {
      // Only the latest request should control loading=false
      if (requestIdRef.current === myRequestId) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PokéAPI Display</h1>
        <p>A better way to view Pokemon information</p>
      </header>
      
      <PokemonSearch onSearch={fetchPokemon} loading={loading} pokemonList={pokemonList} />
      
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}
      {pokemon && <PokemonCard pokemon={pokemon} onEvolutionClick={fetchPokemon} />}
    </div>
  )
}

export default App
