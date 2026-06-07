import { useState, useEffect, useMemo } from 'react'
import { fetchPokedexList, spriteUrlForId, REGIONS, ALL_TYPES } from '../utils/pokedexList'
import { getTypeColor, getTypeTextColor } from '../utils/typeColors'
import { titleCase } from '../utils/format'

const STAT_COLUMNS = [
  ['hp', 'HP'],
  ['attack', 'Atk'],
  ['defense', 'Def'],
  ['special-attack', 'SpA'],
  ['special-defense', 'SpD'],
  ['speed', 'Spe'],
]

function TypePill({ type, onClick, dimmed }) {
  return (
    <button
      type="button"
      className={`pokedex-type-pill${dimmed ? ' dimmed' : ''}`}
      style={{ backgroundColor: getTypeColor(type), color: getTypeTextColor(type) }}
      onClick={onClick}
    >
      {type}
    </button>
  )
}

export default function PokemonListLanding({ onPokemonClick, onAbilityClick }) {
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTypes, setSelectedTypes] = useState(() => new Set())
  const [selectedRegion, setSelectedRegion] = useState(null) // null = All
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })

  const NUMERIC_KEYS = new Set(['id', ...STAT_COLUMNS.map(([k]) => k)])

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      // New column: stats/numeric default to desc (highest first); name to asc.
      return { key, direction: NUMERIC_KEYS.has(key) && key !== 'id' ? 'desc' : 'asc' }
    })
  }

  const sortIndicator = (key) =>
    sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchPokedexList()
      .then(data => { if (active) { setList(data); setError(null) } })
      .catch(() => { if (active) setError('Failed to load Pokédex list.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const toggleType = (type) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const filtered = useMemo(() => {
    if (!list) return []
    const region = REGIONS.find(r => r.name === selectedRegion)
    const types = [...selectedTypes]
    const rows = list.filter(p => {
      if (region && (p.id < region.min || p.id > region.max)) return false
      // multi-select AND: Pokémon must have every selected type
      if (types.length && !types.every(t => p.types.includes(t))) return false
      return true
    })

    const { key, direction } = sortConfig
    const getVal = (p) => (key === 'name' ? p.name : key === 'id' ? p.id : (p.stats[key] ?? -1))
    rows.sort((a, b) => {
      const va = getVal(a), vb = getVal(b)
      let r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      if (r === 0) r = a.id - b.id // stable tiebreak by dex number
      return direction === 'asc' ? r : -r
    })
    return rows
  }, [list, selectedTypes, selectedRegion, sortConfig])

  return (
    <div className="pokedex-landing">
      {/* Type filter */}
      <div className="pokedex-filter-row">
        <span className="pokedex-filter-label">Type:</span>
        {ALL_TYPES.map(t => (
          <TypePill
            key={t}
            type={t}
            dimmed={selectedTypes.size > 0 && !selectedTypes.has(t)}
            onClick={() => toggleType(t)}
          />
        ))}
        {selectedTypes.size > 0 && (
          <button type="button" className="pokedex-filter-clear" onClick={() => setSelectedTypes(new Set())}>
            Clear
          </button>
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
          <div className="pokedex-count">{filtered.length} Pokémon</div>
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
                {STAT_COLUMNS.map(([key, label]) => (
                  <th key={key} className="pokedex-col-stat">
                    <button type="button" onClick={() => handleSort(key)}>{label}{sortIndicator(key)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="pokedex-row" onClick={() => onPokemonClick(p.name)}>
                  <td className="pokedex-col-sprite">
                    <img src={spriteUrlForId(p.id)} alt={p.name} loading="lazy" className="pokedex-sprite" />
                  </td>
                  <td className="pokedex-col-name">
                    <span className="pokedex-name-link">{titleCase(p.name)}</span>
                  </td>
                  <td className="pokedex-col-types">
                    <div className="pokedex-row-types">
                      {p.types.map(t => (
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
                  {STAT_COLUMNS.map(([key]) => (
                    <td key={key} className="pokedex-col-stat">{p.stats[key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
