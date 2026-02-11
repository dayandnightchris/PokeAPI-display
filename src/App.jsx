import { useState, useEffect, useRef } from 'react'
import './App.css'
import PokemonCard from './components/PokemonCard'
import PokemonSearch from './components/PokemonSearch'

function App() {
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pokemonList, setPokemonList] = useState([])
  const [requestedForm, setRequestedForm] = useState(null)

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

        const formBase = 'https://pokeapi.co/api/v2/pokemon-form'
        const firstForm = await fetch(formBase).then(r => r.json())
        const allForms = await fetch(`${formBase}?limit=${firstForm.count}`).then(r => r.json())

        const names = new Set([
          ...all.results.map(p => p.name),
          ...allForms.results.map(f => f.name)
        ])

        setPokemonList(Array.from(names).sort())
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
    setRequestedForm(null)

    try {
      let pokemonData = null
      let requestedFormName = null

      const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`, {
        signal: controller.signal,
      })

      if (pokemonResponse.ok) {
        pokemonData = await pokemonResponse.json()
      } else {
        const formResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${query}`, {
          signal: controller.signal,
        })

        if (formResponse.ok) {
          const formData = await formResponse.json()
          requestedFormName = formData?.name || query
          const baseName = formData?.pokemon?.name
          if (baseName) {
            const baseResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${baseName}`, {
              signal: controller.signal,
            })
            if (baseResponse.ok) {
              pokemonData = await baseResponse.json()
            }
          }
        } else {
          const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${query}`, {
            signal: controller.signal,
          })
          if (speciesResponse.ok) {
            const speciesData = await speciesResponse.json()
            const mainVariety = speciesData.varieties?.find(v => v.is_main_variety)
            const varietyName = mainVariety?.pokemon?.name || speciesData.varieties?.[0]?.pokemon?.name
            if (varietyName) {
              const varietyResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${varietyName}`, {
                signal: controller.signal,
              })
              if (varietyResponse.ok) {
                pokemonData = await varietyResponse.json()
              }
            }
          }
        }
      }

      if (!pokemonData) throw new Error('Pokemon not found')

      // Only apply if this is still the latest request
      if (requestIdRef.current === myRequestId) {
        setPokemon(pokemonData)
        setRequestedForm(requestedFormName)
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
      {pokemon && <PokemonCard pokemon={pokemon} onEvolutionClick={fetchPokemon} initialForm={requestedForm} />}
    </div>
  )
}

export default App
