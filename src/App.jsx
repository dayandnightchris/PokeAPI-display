import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import PokemonCard from './components/PokemonCard'
import PokemonSearch from './components/PokemonSearch'

/**
 * Read URL path parameters on load.
 * Expected format: /pokemon/[version]/[form]  or  /pokemon/[form]
 */
function getUrlParams() {
  const segments = window.location.pathname.split('/').filter(Boolean)
  if (segments[0] === 'pokemon') {
    if (segments.length >= 3) {
      return { version: segments[1], form: segments[2] }
    }
    if (segments.length === 2) {
      return { version: null, form: segments[1] }
    }
  }
  return { version: null, form: null }
}

/**
 * Update the URL path without triggering a page reload.
 * Produces paths like /pokemon/[version]/[form] or /pokemon/[form].
 */
function updateUrl({ version, form }) {
  let path = '/'
  if (form) {
    path = version ? `/pokemon/${version}/${form}` : `/pokemon/${form}`
  }
  window.history.replaceState(null, '', path)
}

const TABS = [
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'moves', label: 'Moves' },
  { id: 'items', label: 'Items' },
]

function App() {
  const [activeTab, setActiveTab] = useState('pokemon')
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pokemonList, setPokemonList] = useState([])
  const [requestedForm, setRequestedForm] = useState(null)
  const [initialVersion, setInitialVersion] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Track current URL state so we can update it incrementally
  const urlStateRef = useRef({ version: null, form: null })

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

        // Remove superfluous cosmetic forms from autocomplete
        for (const name of names) {
          // Pikachu cap forms
          if (name.startsWith('pikachu-') && name.endsWith('-cap')) names.delete(name)
          // Alcremie cosmetic variants (63 cream/swirl+sweet combos)
          if (name.startsWith('alcremie-') && name !== 'alcremie-gmax') names.delete(name)
        }

        setPokemonList(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to fetch Pokemon list:', err)
      }
    }
    fetchPokemonList()
  }, [])

  // Auto-load Pokémon from URL params on mount
  const hasLoadedFromUrl = useRef(false)
  useEffect(() => {
    if (hasLoadedFromUrl.current) return
    const { version: urlVersion, form: urlForm } = getUrlParams()
    if (urlForm) {
      hasLoadedFromUrl.current = true
      if (urlVersion) setInitialVersion(urlVersion)
      fetchPokemon(urlForm)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Callback for PokemonCard to report version/form changes.
   * Updates the URL to keep it in sync with the displayed state.
   */
  const handleStateChange = useCallback(({ version, form }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (form !== undefined) current.form = form
    updateUrl(current)
  }, [])

  const fetchPokemon = async (nameOrId) => {
    const query = String(nameOrId).trim().toLowerCase()
    if (!query) return

    // Update search bar to reflect what's being loaded
    setSearchQuery(query)

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

        // Always track the requested form name so the form selector knows which
        // form to select — even for default forms. This ensures clicking base
        // "raichu" in the evo tree while viewing "raichu-alola" properly resets
        // the form selector to the base form.
        requestedFormName = pokemonData.name

        // If this is a non-default form (e.g. raichu-mega-x, avalugg-hisui),
        // load the base species' default pokemon and track this as a form request.
        if (pokemonData && pokemonData.is_default === false) {
          try {
            const speciesUrl = pokemonData.species?.url
            if (speciesUrl) {
              const speciesRes = await fetch(speciesUrl, { signal: controller.signal })
              if (speciesRes.ok) {
                const speciesData = await speciesRes.json()
                const defaultVariety = speciesData.varieties?.find(v => v.is_default)
                  || speciesData.varieties?.[0]
                const baseName = defaultVariety?.pokemon?.name
                if (baseName && baseName !== pokemonData.name) {
                  const baseRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${baseName}`, {
                    signal: controller.signal,
                  })
                  if (baseRes.ok) {
                    pokemonData = await baseRes.json()
                  }
                }
              }
            }
          } catch (err) {
            if (err?.name === 'AbortError') throw err
            // Fall through with original pokemonData
          }
        }
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

        // Update URL with the form name (or base pokemon name as fallback).
        // Keep the current version — PokemonCard will update it via
        // onStateChange if it actually changes.
        urlStateRef.current.form = requestedFormName || pokemonData.name
        updateUrl(urlStateRef.current)
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

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-button${activeTab === tab.id ? ' tab-button--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'pokemon' && (
        <>
          <PokemonSearch onSearch={fetchPokemon} loading={loading} pokemonList={pokemonList} initialQuery={searchQuery} />
          
          {error && <div className="error">{error}</div>}
          {loading && <div className="loading">Loading...</div>}
          {pokemon && <PokemonCard pokemon={pokemon} onEvolutionClick={fetchPokemon} initialForm={requestedForm} initialVersion={initialVersion} onStateChange={handleStateChange} />}
        </>
      )}

      {activeTab === 'abilities' && (
        <div className="tab-placeholder">Abilities page coming soon.</div>
      )}

      {activeTab === 'moves' && (
        <div className="tab-placeholder">Moves page coming soon.</div>
      )}

      {activeTab === 'items' && (
        <div className="tab-placeholder">Items page coming soon.</div>
      )}
    </div>
  )
}

export default App
