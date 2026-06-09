import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { fetchPokedexList, fetchMoveLearners, typesForGeneration, spriteUrlForId, REGIONS, ALL_TYPES } from '../utils/pokedexList'
import { getTypeColor, getTypeTextColor } from '../utils/typeColors'
import { titleCase } from '../utils/format'
import { versionGeneration } from '../utils/versionInfo'

const STAT_COLUMNS = [
  ['hp', 'HP'],
  ['attack', 'Atk'],
  ['defense', 'Def'],
  ['special-attack', 'SpA'],
  ['special-defense', 'SpD'],
  ['speed', 'Spe'],
]

const NUMERIC_KEYS = new Set(['id', ...STAT_COLUMNS.map(([k]) => k)])

const PAGE_SIZE = 60

// Highest National-Dex id that exists by a given generation (cumulative).
// Used so the version dropdown limits the list to Pokémon that exist by then.
const maxIdForGen = (gen) => (gen ? (REGIONS[gen - 1]?.max ?? Infinity) : Infinity)

// Filter chip kinds, for the colored dot/label in suggestions + chips.
const KIND_LABEL = { type: 'Type', ability: 'Ability', move: 'Move' }

export default function PokemonListLanding({ onPokemonClick, onAbilityClick, selectedVersion, moveList, abilityList }) {
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null) // null = All
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })

  // Typed filter system (Smogon-style): each chip is { kind, value, label, ids? }
  const [filters, setFilters] = useState([])
  const [query, setQuery] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const [addingMove, setAddingMove] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)
  const inputRef = useRef(null)
  const sentinelRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const gen = selectedVersion ? versionGeneration[selectedVersion] : null

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchPokedexList()
      .then(data => { if (active) { setList(data); setError(null) } })
      .catch(() => { if (active) setError('Failed to load Pokédex list.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // Reset how many rows are shown whenever the result set changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [filters, selectedRegion, sortConfig, gen])

  // ── Filter add/remove ──────────────────────────────────────────────
  const hasFilter = (kind, value) => filters.some(f => f.kind === kind && f.value === value)

  const addFilter = async (s) => {
    if (hasFilter(s.kind, s.value)) { setQuery(''); return }
    if (s.kind === 'move') {
      setAddingMove(true)
      try {
        const ids = await fetchMoveLearners(s.value)
        setFilters(prev => [...prev, { ...s, ids }])
      } catch { /* ignore — move data unavailable */ }
      finally { setAddingMove(false) }
    } else {
      setFilters(prev => [...prev, s])
    }
    setQuery('')
    setActiveSuggestion(0)
  }

  const removeFilter = (idx) => setFilters(prev => prev.filter((_, i) => i !== idx))

  // ── Suggestions ────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '-')
    if (!q) return []
    const score = (name) => (name.startsWith(q) ? 0 : 1)
    const collect = (names, kind) =>
      (names || []).filter(n => n.includes(q)).map(n => ({ kind, value: n, label: titleCase(n) }))
    const all = [
      ...collect(ALL_TYPES, 'type'),
      ...collect(abilityList, 'ability'),
      ...collect(moveList, 'move'),
    ].filter(s => !hasFilter(s.kind, s.value))
    all.sort((a, b) => score(a.value) - score(b.value) || a.label.localeCompare(b.label))
    return all.slice(0, 8)
  }, [query, abilityList, moveList, filters])

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && query === '' && filters.length) {
      removeFilter(filters.length - 1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveSuggestion(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && suggestions[activeSuggestion]) {
      e.preventDefault(); addFilter(suggestions[activeSuggestion])
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  // ── Filtering + sorting ────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!list) return []
    const region = REGIONS.find(r => r.name === selectedRegion)
    const maxId = maxIdForGen(gen)
    const rows = list.filter(p => {
      if (p.id > maxId) return false // version dropdown: hide later-gen Pokémon
      if (region && (p.id < region.min || p.id > region.max)) return false
      const ptypes = typesForGeneration(p, gen)
      for (const f of filters) {
        if (f.kind === 'type' && !ptypes.includes(f.value)) return false
        if (f.kind === 'ability' && !p.abilities.some(a => a.name === f.value)) return false
        if (f.kind === 'move' && !(f.ids && f.ids.has(p.id))) return false
      }
      return true
    })

    const { key, direction } = sortConfig
    const getVal = (p) => (key === 'name' ? p.name : key === 'id' ? p.id : (p.stats[key] ?? -1))
    rows.sort((a, b) => {
      const va = getVal(a), vb = getVal(b)
      let r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      if (r === 0) r = a.id - b.id
      return direction === 'asc' ? r : -r
    })
    return rows
  }, [list, filters, selectedRegion, sortConfig, gen])

  // Infinite scroll: reveal the next batch when the bottom sentinel comes into
  // view (preloading a little early via rootMargin), until everything is shown.
  useEffect(() => {
    if (!sentinelRef.current || filtered.length <= visibleCount) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(c => c + PAGE_SIZE)
    }, { rootMargin: '300px' })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [filtered.length, visibleCount])

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      return { key, direction: NUMERIC_KEYS.has(key) && key !== 'id' ? 'desc' : 'asc' }
    })
  }
  const sortIndicator = (key) =>
    sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div className="pokedex-landing">
      {/* Typed filter input */}
      <div className="pokedex-filter-builder">
        <div className="pokedex-filter-input-wrap">
          {filters.map((f, i) => (
            <span key={`${f.kind}-${f.value}`} className="pokedex-chip" data-kind={f.kind}>
              <span className="pokedex-chip-kind">{KIND_LABEL[f.kind]}</span>
              {f.label}
              <button type="button" className="pokedex-chip-x" onClick={() => removeFilter(i)} aria-label="Remove filter">×</button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="pokedex-filter-input"
            placeholder={filters.length ? '' : 'Filter by type, ability, or move…'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveSuggestion(0) }}
            onKeyDown={handleKeyDown}
          />
          {addingMove && <span className="pokedex-filter-loading">loading…</span>}
        </div>
        {suggestions.length > 0 && (
          <ul className="pokedex-suggestions">
            {suggestions.map((s, i) => (
              <li
                key={`${s.kind}-${s.value}`}
                className={`pokedex-suggestion${i === activeSuggestion ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); addFilter(s) }}
                onMouseEnter={() => setActiveSuggestion(i)}
              >
                <span className="pokedex-suggestion-kind" data-kind={s.kind}>{KIND_LABEL[s.kind]}</span>
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Region filter */}
      <div className="pokedex-filter-row">
        <span className="pokedex-filter-label">Region:</span>
        <button
          type="button"
          className={`pokedex-region-btn${selectedRegion === null ? ' active' : ''}`}
          onClick={() => setSelectedRegion(null)}
        >
          All
        </button>
        {REGIONS.map(r => (
          <button
            key={r.name}
            type="button"
            className={`pokedex-region-btn${selectedRegion === r.name ? ' active' : ''}`}
            onClick={() => setSelectedRegion(r.name)}
          >
            {r.name}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted playsInline className="loading-pokeball" /></div>
      )}
      {error && <div className="error">{error}</div>}

      {list && !loading && (
        <div className="pokedex-table-wrapper">
          <div className="pokedex-count">
            {filtered.length} Pokémon
            {filtered.length > visibleCount ? ` (showing ${visibleCount})` : ''}
          </div>
          <table className="pokedex-table">
            <thead>
              <tr>
                <th className="pokedex-col-sprite">
                  <button type="button" onClick={() => handleSort('id')}>#{sortIndicator('id')}</button>
                </th>
                <th className="pokedex-col-name">
                  <button type="button" onClick={() => handleSort('name')}>Name{sortIndicator('name')}</button>
                </th>
                <th className="pokedex-col-types">Type</th>
                <th className="pokedex-col-abilities">Abilities</th>
                {!isMobile && STAT_COLUMNS.map(([key, label]) => (
                  <th key={key} className="pokedex-col-stat">
                    <button type="button" onClick={() => handleSort(key)}>{label}{sortIndicator(key)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visibleCount).map(p => {
                const ptypes = typesForGeneration(p, gen)
                const mainCells = (
                  <>
                    <td className="pokedex-col-sprite">
                      <div className="pokedex-sprite-cell">
                        <img src={spriteUrlForId(p.id)} alt={p.name} loading="lazy" className="pokedex-sprite" />
                        <span className="pokedex-dexnum">{String(p.id).padStart(3, '0')}</span>
                      </div>
                    </td>
                    <td className="pokedex-col-name">
                      <span className="pokedex-name-link">{titleCase(p.name)}</span>
                    </td>
                    <td className="pokedex-col-types">
                      <div className="pokedex-row-types">
                        {ptypes.map(t => (
                          <span key={t} className="pokedex-type-tag" style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t) }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="pokedex-col-abilities">
                      {p.abilities.map(a => (
                        <button
                          key={a.name}
                          type="button"
                          className={`pokedex-ability${a.isHidden ? ' hidden' : ''}`}
                          onClick={(e) => { e.stopPropagation(); onAbilityClick?.(a.name) }}
                        >
                          {titleCase(a.name)}{a.isHidden ? ' (H)' : ''}
                        </button>
                      ))}
                    </td>
                  </>
                )

                if (isMobile) {
                  // Stats drop to an inner row so everything fits without horizontal scroll.
                  return (
                    <Fragment key={p.id}>
                      <tr className="pokedex-row pokedex-row-main" onClick={() => onPokemonClick(p.name)}>
                        {mainCells}
                      </tr>
                      <tr className="pokedex-row pokedex-row-statrow" onClick={() => onPokemonClick(p.name)}>
                        <td colSpan={4}>
                          <div className="pokedex-mobile-stats">
                            {STAT_COLUMNS.map(([key, label]) => (
                              <span key={key} className="pokedex-mstat">
                                <span className="pokedex-mstat-label">{label}</span> {p.stats[key] ?? '—'}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                }

                return (
                  <tr key={p.id} className="pokedex-row" onClick={() => onPokemonClick(p.name)}>
                    {mainCells}
                    {STAT_COLUMNS.map(([key]) => (
                      <td key={key} className="pokedex-col-stat">{p.stats[key] ?? '—'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > visibleCount && (
            <div ref={sentinelRef} className="pokedex-sentinel">
              Loading more… ({filtered.length - visibleCount} remaining)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
