import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import PokemonCard from './components/PokemonCard'
import UnifiedSearch from './components/UnifiedSearch'
import MovePage from './components/MovePage'
import AbilityPage from './components/AbilityPage'
import ItemPage from './components/ItemPage'
import LocationPage from './components/LocationPage'
import { defaultVersionGroups } from './utils/versionInfo'
import EggMoveTab from './components/EggMoveTab'
import PokemonListLanding from './components/PokemonListLanding'

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

  if (tab === 'pokemon' || tab === 'moves' || tab === 'abilities' || tab === 'items' || tab === 'locations' || tab === 'eggmoves') {
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
 * @param {boolean} push - If true, creates a new history entry (pushState);
 *                         if false (default), replaces the current entry (replaceState).
 */
function updateUrl(tab, { version, name }, push = false) {
  let path = BASE_PATH + '/'
  if (name && tab) {
    path = version
      ? `${BASE_PATH}/${tab}/${version}/${name}`
      : `${BASE_PATH}/${tab}/${name}`
  }
  if (push) {
    window.history.pushState({ tab, version, name }, '', path)
  } else {
    window.history.replaceState({ tab, version, name }, '', path)
  }
}

const TABS = [
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'moves', label: 'Moves' },
  { id: 'items', label: 'Items' },
  { id: 'locations', label: 'Locations' },
  { id: 'eggmoves', label: 'Egg Moves' },
]

const SOLROCK_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/338.png'
const LUNATONE_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/337.png'

function App() {
  const urlParams = getUrlParams()
  const [activeTab, setActiveTab] = useState(urlParams.tab || 'pokemon')
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark') return stored
    } catch { /* storage unavailable */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pokemonList, setPokemonList] = useState([])
  const [pokemonIdMap, setPokemonIdMap] = useState({})
  const [moveList, setMoveList] = useState([])
  const [abilityList, setAbilityList] = useState([])
  const [itemList, setItemList] = useState([])
  const [locationList, setLocationList] = useState([])
  const [requestedForm, setRequestedForm] = useState(null)
  const [initialVersion, setInitialVersion] = useState(urlParams.version || 'moon')
  const [searchQuery, setSearchQuery] = useState('')

  // Apply theme to document. Only an explicit toggle is persisted — the
  // OS-derived default stays unsaved so the app keeps following the OS
  // preference until the user chooses a theme themselves.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      try { localStorage.setItem('theme', next) } catch { /* storage full or unavailable */ }
      return next
    })
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
  const [locationPageInit, setLocationPageInit] = useState({
    location: urlParams.tab === 'locations' ? urlParams.name : null,
    version: urlParams.tab === 'locations' ? urlParams.version : null,
    key: 0,
  })
  const [eggMovePageInit, setEggMovePageInit] = useState({
    pokemon: urlParams.tab === 'eggmoves' ? urlParams.name : null,
    version: urlParams.tab === 'eggmoves' ? urlParams.version : null,
    key: 0,
  })

  // Track current URL state so we can update it incrementally
  const urlStateRef = useRef({ version: null, name: null })

  // Track the latest in-flight request
  const abortRef = useRef(null)
  const requestIdRef = useRef(0)

  // Inject AdSense only after first search result — keeps the landing page ad-free
  useEffect(() => {
    if (!pokemon) return
    if (document.querySelector('script[src*="adsbygoogle"]')) return
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3943102684396180'
    script.crossOrigin = 'anonymous'
    document.head.appendChild(script)
  }, [pokemon])

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

        // Build id-to-name map and identify Gen 8+ pokemon (id >= 810)
        const idMap = {}
        const gen8PlusNames = new Set()
        all.results.forEach(p => {
          const id = p.url.match(/\/pokemon\/(\d+)\//)?.[1]
          if (id) {
            const numId = Number(id)
            idMap[id] = p.name
            if (numId >= 810) gen8PlusNames.add(p.name)
          }
        })

        // Filter out Gen 8+ pokemon and their forms from autocomplete
        for (const name of names) {
          if (gen8PlusNames.has(name)) {
            names.delete(name)
            continue
          }
          // Forms: check if the base species name (before the first hyphen suffix) is Gen 8+
          // e.g. "urshifu-rapid-strike" → base "urshifu"
          const baseName = [...gen8PlusNames].find(g8 => name.startsWith(g8 + '-'))
          if (baseName) names.delete(name)
        }

        // Also filter Gen 8+ from the id map
        for (const id of Object.keys(idMap)) {
          if (Number(id) >= 810) delete idMap[id]
        }

        // Collapse gendered variety names to the base species in autocomplete
        // (pyroar-male/-female → pyroar, meowstic-male/-female → meowstic). The
        // gender is reached via the form selector / female toggle once opened.
        // Runs last so Gen 8+ gendered forms have already been filtered out.
        // Note: Nidoran ("nidoran-f"/"nidoran-m") uses different suffixes and is
        // intentionally NOT collapsed — those are genuinely separate species.
        for (const name of names) {
          const m = name.match(/^(.+)-(male|female)$/)
          if (m) {
            names.delete(name)
            names.add(m[1])
          }
        }

        setPokemonIdMap(idMap)
        setPokemonList(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to fetch Pokemon list:', err)
      }
    }
    fetchPokemonList()
  }, [])

  // Fetch move names for unified search autocomplete
  useEffect(() => {
    const fetchMoves = async () => {
      try {
        const genPromises = []
        for (let g = 1; g <= 7; g++) {
          genPromises.push(fetch(`https://pokeapi.co/api/v2/generation/${g}/`).then(r => r.json()))
        }
        const genData = await Promise.all(genPromises)
        const names = new Set()
        for (const gen of genData) {
          for (const move of (gen.moves || [])) {
            const idMatch = move.url?.match(/\/(\d+)\/?$/)
            if (idMatch && Number(idMatch[1]) >= 10001) continue
            names.add(move.name)
          }
        }
        setMoveList(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to fetch move list:', err)
      }
    }
    fetchMoves()
  }, [])

  // Fetch ability names for unified search autocomplete
  useEffect(() => {
    const fetchAbilities = async () => {
      try {
        const genPromises = []
        for (let g = 3; g <= 7; g++) {
          genPromises.push(fetch(`https://pokeapi.co/api/v2/generation/${g}/`).then(r => r.json()))
        }
        const genData = await Promise.all(genPromises)
        const names = new Set()
        for (const gen of genData) {
          for (const ability of (gen.abilities || [])) {
            const idMatch = ability.url?.match(/\/(\d+)\/?$/)
            if (idMatch && Number(idMatch[1]) >= 10001) continue
            names.add(ability.name)
          }
        }
        setAbilityList(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to fetch ability list:', err)
      }
    }
    fetchAbilities()
  }, [])

  // Fetch item names for unified search autocomplete
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const first = await fetch('https://pokeapi.co/api/v2/item/').then(r => r.json())
        const all = await fetch(`https://pokeapi.co/api/v2/item/?limit=${first.count}`).then(r => r.json())
        setItemList(all.results.map(i => i.name).sort())
      } catch (err) {
        console.error('Failed to fetch item list:', err)
      }
    }
    fetchItems()
  }, [])

  // Fetch location names for unified search autocomplete
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const first = await fetch('https://pokeapi.co/api/v2/location/').then(r => r.json())
        const all = await fetch(`https://pokeapi.co/api/v2/location/?limit=${first.count}`).then(r => r.json())
        setLocationList(all.results.map(l => l.name).sort())
      } catch (err) {
        console.error('Failed to fetch location list:', err)
      }
    }
    fetchLocations()
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

  const handleLocationStateChange = useCallback(({ version, location }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (location !== undefined) current.name = location
    updateUrl('locations', current)
  }, [])

  const handleEggMoveStateChange = useCallback(({ version, eggmoves }) => {
    const current = urlStateRef.current
    if (version !== undefined) current.version = version
    if (eggmoves !== undefined) current.name = eggmoves
    updateUrl('eggmoves', current)
  }, [])

  // Navigate from PokemonCard → MovePage
  const navigateToMove = useCallback((moveName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: moveName }
    updateUrl('moves', urlStateRef.current, true)
    setMovePageInit(prev => ({ move: moveName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('moves')
    window.scrollTo(0, 0)
  }, [])

  // Navigate from PokemonCard → AbilityPage
  const navigateToAbility = useCallback((abilityName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: abilityName }
    updateUrl('abilities', urlStateRef.current, true)
    setAbilityPageInit(prev => ({ ability: abilityName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('abilities')
    window.scrollTo(0, 0)
  }, [])

  // Navigate from PokemonCard → ItemPage
  const navigateToItem = useCallback((itemName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: itemName }
    updateUrl('items', urlStateRef.current, true)
    setItemPageInit(prev => ({ item: itemName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('items')
    window.scrollTo(0, 0)
  }, [])

  // Navigate from PokemonCard → LocationPage
  const navigateToLocation = useCallback((locationName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: locationName }
    updateUrl('locations', urlStateRef.current, true)
    setLocationPageInit(prev => ({ location: locationName, version: currentVersion, key: prev.key + 1 }))
    setActiveTab('locations')
    window.scrollTo(0, 0)
  }, [])

  // Navigate to egg moves tab
  const navigateToEggMoves = useCallback((pokemonName, moveName) => {
    const currentVersion = urlStateRef.current.version
    urlStateRef.current = { version: currentVersion, name: pokemonName }
    updateUrl('eggmoves', urlStateRef.current, true)
    setEggMovePageInit(prev => ({ pokemon: pokemonName, version: currentVersion, expandMove: moveName || null, key: prev.key + 1 }))
    setActiveTab('eggmoves')
    window.scrollTo(0, 0)
  }, [])

  // Navigate from MovePage → PokemonCard
  const navigateToPokemon = useCallback((pokemonName, version) => {
    urlStateRef.current = { version: version || null, name: pokemonName }
    updateUrl('pokemon', urlStateRef.current, true)
    if (version) setInitialVersion(version)
    setPokemonPageInit(prev => ({ name: pokemonName, version: version || null, key: prev.key + 1 }))
    setActiveTab('pokemon')
    fetchPokemon(pokemonName)
    window.scrollTo(0, 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Return to the Pokémon-tab landing page (the browsable list).
  const goToLanding = useCallback(() => {
    setPokemon(null)
    setError(null)
    setSearchQuery('')
    setActiveTab('pokemon')
    urlStateRef.current = { version: null, name: null }
    updateUrl('pokemon', urlStateRef.current, true)
    window.scrollTo(0, 0)
  }, [])

  // Unified search navigation — routes to the correct tab based on category
  const handleUnifiedNavigate = useCallback((category, name) => {
    switch (category) {
      case 'pokemon':
        navigateToPokemon(name)
        break
      case 'moves':
        navigateToMove(name)
        break
      case 'abilities':
        navigateToAbility(name)
        break
      case 'items':
        navigateToItem(name)
        break
      case 'locations':
        navigateToLocation(name)
        break
      case 'eggmoves':
        navigateToEggMoves(name)
        break
      default:
        // Fall back to pokemon search
        navigateToPokemon(name)
    }
  }, [navigateToPokemon, navigateToMove, navigateToAbility, navigateToItem, navigateToLocation, navigateToEggMoves])

  // Bundled lists object for UnifiedSearch
  const searchLists = { pokemon: pokemonList, pokemonIdMap, moves: moveList, abilities: abilityList, items: itemList, locations: locationList }
  const fetchPokemon = async (nameOrId) => {
    const query = String(nameOrId).trim().toLowerCase().replace(/\s+/g, '-')
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

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = getUrlParams()
      const tab = params.tab || 'pokemon'
      const { version, name } = params

      // Sync the URL state ref
      urlStateRef.current = { version: version || null, name: name || null }

      // Restore the correct tab and its init state
      setActiveTab(tab)

      if (tab === 'pokemon') {
        if (version) setInitialVersion(version)
        if (name) {
          setSearchQuery(name)
          setPokemonPageInit(prev => ({ name, version, key: prev.key + 1 }))
          fetchPokemon(name)
        } else {
          // Going back to empty pokemon landing
          setPokemon(null)
          setError(null)
          setSearchQuery('')
        }
      } else if (tab === 'moves') {
        setMovePageInit(prev => ({ move: name || null, version: version || null, key: prev.key + 1 }))
      } else if (tab === 'abilities') {
        setAbilityPageInit(prev => ({ ability: name || null, version: version || null, key: prev.key + 1 }))
      } else if (tab === 'items') {
        setItemPageInit(prev => ({ item: name || null, version: version || null, key: prev.key + 1 }))
      } else if (tab === 'locations') {
        setLocationPageInit(prev => ({ location: name || null, version: version || null, key: prev.key + 1 }))
      } else if (tab === 'eggmoves') {
        setEggMovePageInit(prev => ({ pokemon: name || null, version: version || null, key: prev.key + 1 }))
      }

      window.scrollTo(0, 0)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    } else if (tabId === 'locations') {
      setLocationPageInit(prev => ({ ...prev, version: currentVersion }))
    } else if (tabId === 'eggmoves') {
      setEggMovePageInit(prev => ({ ...prev, version: currentVersion }))
    }
    setActiveTab(tabId)
  }, [])

  return (
    <ErrorBoundary>
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={goToLanding} title="Back to home page">BlisyDex</h1>
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
          {!pokemon && (
            <div className="page-search-row" style={{ justifyContent: 'center' }}>
              <div className="page-version-inline">
                <label htmlFor="startup-version-select">Version:</label>
                <select
                  id="startup-version-select"
                  value={initialVersion || ''}
                  onChange={(e) => {
                    const v = e.target.value || null
                    setInitialVersion(v)
                    urlStateRef.current.version = v
                  }}
                  className="version-dropdown"
                >
                  {defaultVersionGroups.map((group, idx) => {
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
              <div className="page-search-inline">
                <UnifiedSearch lists={searchLists} onNavigate={handleUnifiedNavigate} activeTab="pokemon" loading={loading} initialQuery={searchQuery} />
              </div>
            </div>
          )}

          {!pokemon && !loading && (
            <PokemonListLanding
              onPokemonClick={navigateToPokemon}
              onAbilityClick={navigateToAbility}
              selectedVersion={initialVersion}
              moveList={moveList}
              abilityList={abilityList}
            />
          )}
          
          {error && <div className="error">{error}</div>}
          {/* Full-page spinner only on the FIRST load (no card yet). On a
              re-search/evolution click, keep the current card in place and let
              it update — avoids the spinner inserting and shoving layout. The
              search box shows its own loading state meanwhile. */}
          {loading && !pokemon && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted playsInline className="loading-pokeball" /></div>}
          {pokemon && <PokemonCard pokemon={pokemon} onEvolutionClick={fetchPokemon} onMoveClick={navigateToMove} onAbilityClick={navigateToAbility} onItemClick={navigateToItem} onLocationClick={navigateToLocation} onEggMoveClick={navigateToEggMoves} initialForm={requestedForm} initialVersion={initialVersion} onStateChange={handleStateChange} searchLists={searchLists} onUnifiedNavigate={handleUnifiedNavigate} searchLoading={loading} initialQuery={searchQuery} />}
        </>
      )}

      {activeTab === 'abilities' && (
        <AbilityPage
          key={abilityPageInit.key}
          initialAbility={abilityPageInit.ability}
          initialVersion={abilityPageInit.version}
          onStateChange={handleAbilityStateChange}
          onPokemonClick={navigateToPokemon}
          searchLists={searchLists}
          onUnifiedNavigate={handleUnifiedNavigate}
        />
      )}

      {activeTab === 'moves' && (
        <MovePage
          key={movePageInit.key}
          initialMove={movePageInit.move}
          initialVersion={movePageInit.version}
          onStateChange={handleMoveStateChange}
          onPokemonClick={navigateToPokemon}
          searchLists={searchLists}
          onUnifiedNavigate={handleUnifiedNavigate}
        />
      )}

      {activeTab === 'items' && (
        <ItemPage
          key={itemPageInit.key}
          initialItem={itemPageInit.item}
          initialVersion={itemPageInit.version}
          onStateChange={handleItemStateChange}
          onPokemonClick={navigateToPokemon}
          onMoveClick={navigateToMove}
          searchLists={searchLists}
          onUnifiedNavigate={handleUnifiedNavigate}
        />
      )}

      {activeTab === 'locations' && (
        <LocationPage
          key={locationPageInit.key}
          initialLocation={locationPageInit.location}
          initialVersion={locationPageInit.version}
          onStateChange={handleLocationStateChange}
          onPokemonClick={navigateToPokemon}
          searchLists={searchLists}
          onUnifiedNavigate={handleUnifiedNavigate}
        />
      )}

      {activeTab === 'eggmoves' && (
        <EggMoveTab
          key={eggMovePageInit.key}
          initialPokemon={eggMovePageInit.pokemon}
          initialVersion={eggMovePageInit.version}
          initialExpandMove={eggMovePageInit.expandMove}
          onStateChange={handleEggMoveStateChange}
          onPokemonClick={navigateToPokemon}
          onMoveClick={navigateToMove}
          searchLists={searchLists}
          onUnifiedNavigate={handleUnifiedNavigate}
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
    </ErrorBoundary>
  )
}

export default App
