import { useState, useEffect } from 'react'
import './App.css'
import PokemonCard from './components/PokemonCard'
import PokemonSearch from './components/PokemonSearch'

function App() {
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pokemonList, setPokemonList] = useState([])

  // Fetch all Pokemon names for autocomplete on mount
  useEffect(() => {
    const fetchPokemonList = async () => {
      try {
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1000')
        const data = await response.json()
        const names = data.results.map(p => p.name)
        setPokemonList(names)
      } catch (err) {
        console.error('Failed to fetch Pokemon list:', err)
      }
    }
    fetchPokemonList()
  }, [])

  const fetchPokemon = async (nameOrId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId.toLowerCase()}`)
      if (!response.ok) throw new Error('Pokemon not found')
      const data = await response.json()
      setPokemon(data)
    } catch (err) {
      setError(err.message)
      setPokemon(null)
    } finally {
      setLoading(false)
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
