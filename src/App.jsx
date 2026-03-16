import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import PokemonCard from './components/PokemonCard'
import PokemonSearch from './components/PokemonSearch'
import MovePage from './components/MovePage'
import AbilityPage from './components/AbilityPage'
import ItemPage from './components/ItemPage'

/**
 * Read URL path parameters on load.
 * Supported formats:
 *   /pokemon/[version]/[form]  or  /pokemon/[form]
 *   /moves/[version]/[name]    or  /moves/[name]
 */
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '') // e.g. '/PokeAPI-display'

function getUrlParams() {
  // Strip the base path prefix so routing works on GitHub Pages
  let pathname = window.location.pathname
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    pathname = pathname.slice(BASE_PATH.length)
  }
  const segments = pathname.split('/').filter(Boolean)
  const tab = segments[0] || null

  if (tab === 'pokemon' || tab === 'moves' || tab === 'abilities' || tab === 'items') {
    if (segments.length >= 3) {
      return { tab, version: segments[1], name: segments[2] }
    }
    if (segments.length === 2) {
      return { tab, version: null, name: segments[1] }
    }
    return { tab, version: null, name: null }
  }
  return { tab: null, version: null, name: null }
}

/**
 * Update the URL path without triggering a page reload.
 * Produces paths like /PokeAPI-display/pokemon/[version]/[form], etc.
 */
function updateUrl(tab, { version, name }) {
  let path = BASE_PATH + '/'
  if (name && tab) {
    path = version
      ? `${BASE_PATH}/${tab}/${version}/${name}`
      : `${BASE_PATH}/${tab}/${name}`
  }
  window.history.replaceState(null, '', path)
}

const TABS = [
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'moves', label: 'Moves' },
  { id: 'items', label: 'Items' },
]

const SOLROCK_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/338.png'
const LUNATONE_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/337.png'

function App() {
  const urlParams = getUrlParams()
  const [activeTab, setActiveTab] = useState(urlParams.tab || 'pokemon')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pokemonList, setPokemonList] = useState([])
  const [pokemonIdMap, setPokemonIdMap] = useState({})
  const [requestedForm, setRequestedForm] = useState(null)
  const [initialVersion, setInitialVersion] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* storage full or unavailable */ }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  // Cross-tab navigation state
  const [movePageInit, setMovePageInit] = useState({
    move: urlParams.tab === 'moves' ? urlParams.name : null,
    version: urlParams.tab === 'moves' ? urlParams.version : null,
    key: 0,
  })
  const [pokemonPageInit, setPokemonPageInit] = useState({
    name: urlParams.tab === 'pokemon' ? urlParams.name : null,
    version: urlParams.tab === 'pokemon' ? urlParams.version : null,
    key: 0,
  })
  const [abilityPageInit, setAbilityPageInit] = useState({
    ability: urlParams.tab === 'abilities' ? urlParams.name : null,
    version: urlParams.tab === 'abilities' ? urlParams.version : null,
    key: 0,
  })
  const [itemPageInit, setItemPageInit] = useState({
    item: urlParams.tab === 'items' ? urlParams.name : null,
    version: urlParams.tab === 'items' ? urlParams.version : null,
    key: 0,
  })

  // Track current URL state so we can update it incrementally
  const urlStateRef = useRef({ version: null, name: null })

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

        // Build id-to-name map from the pokemon list (extract id from URL)
        const idMap = {}
        all.results.forEach(p => {
          const id = p.url.match(/\/pokemon\/(\d+)\//)?.[1]
          if (id) idMap[id] = p.name
        })
        setPokemonIdMap(idMap)
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
    if (urlParams.tab === 'pokemon' && urlParams.name) {
      hasLoadedFromUrl.current = true
      if (urlParams.version) setInitialVersion(urlParams.version)
      fetchPokemon(urlParams.name)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Callback for PokemonCard to report version/form changes.
   * Updates the URL to keep it in sync with the displayed state.
   */
  const handleStateChange = useCallback(({ version, form }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (form !== undefined) current.name = form
    updateUrl('pokemon', current)
  }, [])

  const handleMoveStateChange = useCallback(({ version, move }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (move !== undefined) current.name = move
    updateUrl('moves', current)
  }, [])

  const handleAbilityStateChange = useCallback(({ version, ability }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (ability !== undefined) current.name = ability
    updateUrl('abilities', current)
  }, [])

  const handleItemStateChange = useCallback(({ version, item }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (item !== undefined) current.name = item
    updateUrl('items', current)
  }, [])

  // Navigate from PokemonCard → MovePage
  const navigateToMove = useCallback((moveName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: moveName }
    updateUrl('moves', urlStateRef.current)
    setMovePageInit(prev => ({ move: moveName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('moves')
  }, [])

  // Navigate from PokemonCard → AbilityPage
  const navigateToAbility = useCallback((abilityName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: abilityName }
    updateUrl('abilities', urlStateRef.current)
    setAbilityPageInit(prev => ({ ability: abilityName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('abilities')
  }, [])

  // Navigate from PokemonCard → ItemPage
  const navigateToItem = useCallback((itemName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: itemName }
    updateUrl('items', urlStateRef.current)
    setItemPageInit(prev => ({ item: itemName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('items')
  }, [])

  // Navigate from MovePage → PokemonCard
  const navigateToPokemon = useCallback((pokemonName, version) => {
    urlStateRef.current = { version: version || null, name: pokemonName }
    updateUrl('pokemon', urlStateRef.current)
    if (version) setInitialVersion(version)
    setPokemonPageInit(prev => ({ name: pokemonName, version: version || null, key: prev.key + 1 }))
    setActiveTab('pokemon')
    fetchPokemon(pokemonName)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        urlStateRef.current.name = requestedFormName || pokemonData.name
        updateUrl('pokemon', urlStateRef.current)
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

  // Switch tabs, carrying the most recently set game version to the destination tab
  const handleTabSwitch = useCallback((tabId) => {
    const currentVersion = urlStateRef.current.version
    if (tabId === 'pokemon') {
      setInitialVersion(currentVersion)
    } else if (tabId === 'moves') {
      setMovePageInit(prev => ({ ...prev, version: currentVersion }))
    } else if (tabId === 'abilities') {
      setAbilityPageInit(prev => ({ ...prev, version: currentVersion }))
    } else if (tabId === 'items') {
      setItemPageInit(prev => ({ ...prev, version: currentVersion }))
    }
    setActiveTab(tabId)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>BlisyDex</h1>
        <p>A better way to view Pokemon information</p>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <img
            src={theme === 'light' ? LUNATONE_SPRITE : SOLROCK_SPRITE}
            alt={theme === 'light' ? 'Lunatone - Dark mode' : 'Solrock - Light mode'}
            className="theme-toggle-sprite"
          />
        </button>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-button${activeTab === tab.id ? ' tab-button--active' : ''}`}
            onClick={() => handleTabSwitch(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'pokemon' && (
        <>
          <PokemonSearch onSearch={fetchPokemon} loading={loading} pokemonList={pokemonList} pokemonIdMap={pokemonIdMap} initialQuery={searchQuery} />
          
          {error && <div className="error">{error}</div>}
          {loading && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball" /></div>}
          {pokemon && <PokemonCard pokemon={pokemon} onEvolutionClick={fetchPokemon} onMoveClick={navigateToMove} onAbilityClick={navigateToAbility} onItemClick={navigateToItem} initialForm={requestedForm} initialVersion={initialVersion} onStateChange={handleStateChange} />}
        </>
      )}

      {activeTab === 'abilities' && (
        <AbilityPage
          key={abilityPageInit.key}
          initialAbility={abilityPageInit.ability}
          initialVersion={abilityPageInit.version}
          onStateChange={handleAbilityStateChange}
          onPokemonClick={navigateToPokemon}
        />
      )}

      {activeTab === 'moves' && (
        <MovePage
          key={movePageInit.key}
          initialMove={movePageInit.move}
          initialVersion={movePageInit.version}
          onStateChange={handleMoveStateChange}
          onPokemonClick={navigateToPokemon}
        />
      )}

      {activeTab === 'items' && (
        <ItemPage
          key={itemPageInit.key}
          initialItem={itemPageInit.item}
          initialVersion={itemPageInit.version}
          onStateChange={handleItemStateChange}
          onPokemonClick={navigateToPokemon}
        />
      )}

      <footer className="app-footer">
        <div className="footer-disclaimer">
          Pokémon and all related names, characters, and imagery are trademarks and © of Nintendo, Game Freak, and The Pokémon Company. This is an unofficial project and is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.
        </div>
        <div className="footer-api-credit">
          <a href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">
            <img src="/pokeapi_logo.png" alt="PokéAPI" className="footer-api-logo" />
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
