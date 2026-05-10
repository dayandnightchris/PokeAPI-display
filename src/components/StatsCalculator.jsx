import { useState, useEffect } from 'react'
import { versionGeneration } from '../utils/versionInfo'
import { getTypeEffectiveness } from '../utils/typeEffectiveness'

export default function StatsCalculator({ pokemon, stats: statsProp, selectedVersion }) {
  const [level, setLevel] = useState(50)
  const [nature, setNature] = useState('hardy')
  const [ivs, setIvs] = useState({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, spc: 15 })
  const [evs, setEvs] = useState({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, spc: 0 })
  const [maxedOrder, setMaxedOrder] = useState([]) // FILO tracking for maxed EVs

  // Damage calculator mode
  const [calcMode, setCalcMode] = useState('stats') // 'stats' | 'damage'
  const [dmgMoveType, setDmgMoveType] = useState('normal')
  const [dmgCategory, setDmgCategory] = useState('physical')
  const [dmgPower, setDmgPower] = useState(80)
  const [dmgDefType1, setDmgDefType1] = useState('normal')
  const [dmgDefType2, setDmgDefType2] = useState('none')
  const [dmgDefStat, setDmgDefStat] = useState(100)
  const [dmgStab, setDmgStab] = useState(false)
  const [dmgCrit, setDmgCrit] = useState(false)
  const [dmgBurned, setDmgBurned] = useState(false)

  // Determine if we're in a legacy generation (Gen 1-2)
  const currentGen = selectedVersion ? versionGeneration[selectedVersion] : null
  const isLegacy = currentGen && currentGen <= 2
  const maxIv = isLegacy ? 15 : 31
  const maxEv = isLegacy ? 255 : 252

  // Reset IVs and EVs when switching between legacy and modern generations
  useEffect(() => {
    setIvs(prev => {
      const updated = {}
      for (const key in prev) {
        updated[key] = maxIv
      }
      return updated
    })
    setEvs(prev => {
      const updated = {}
      for (const key in prev) {
        updated[key] = 0
      }
      return updated
    })
    setMaxedOrder([])
  }, [maxIv])

  // All natures with their stat modifiers
  const natures = {
    hardy: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1, display: 'Hardy' },
    lonely: { atk: 1.1, def: 0.9, spa: 1, spd: 1, spe: 1, display: 'Lonely (+Atk, -Def)' },
    brave: { atk: 1.1, def: 1, spa: 1, spd: 1, spe: 0.9, display: 'Brave (+Atk, -Spe)' },
    adamant: { atk: 1.1, def: 1, spa: 0.9, spd: 1, spe: 1, display: 'Adamant (+Atk, -SpA)' },
    naughty: { atk: 1.1, def: 1, spa: 1, spd: 0.9, spe: 1, display: 'Naughty (+Atk, -SpD)' },
    bold: { atk: 0.9, def: 1.1, spa: 1, spd: 1, spe: 1, display: 'Bold (+Def, -Atk)' },
    relaxed: { atk: 1, def: 1.1, spa: 1, spd: 1, spe: 0.9, display: 'Relaxed (+Def, -Spe)' },
    impish: { atk: 1, def: 1.1, spa: 0.9, spd: 1, spe: 1, display: 'Impish (+Def, -SpA)' },
    lax: { atk: 1, def: 1.1, spa: 1, spd: 0.9, spe: 1, display: 'Lax (+Def, -SpD)' },
    timid: { atk: 0.9, def: 1, spa: 1, spd: 1, spe: 1.1, display: 'Timid (+Spe, -Atk)' },
    hasty: { atk: 1, def: 0.9, spa: 1, spd: 1, spe: 1.1, display: 'Hasty (+Spe, -Def)' },
    jolly: { atk: 1, def: 1, spa: 0.9, spd: 1, spe: 1.1, display: 'Jolly (+Spe, -SpA)' },
    naive: { atk: 1, def: 1, spa: 1, spd: 0.9, spe: 1.1, display: 'Naive (+Spe, -SpD)' },
    modest: { atk: 0.9, def: 1, spa: 1.1, spd: 1, spe: 1, display: 'Modest (+SpA, -Atk)' },
    mild: { atk: 1, def: 0.9, spa: 1.1, spd: 1, spe: 1, display: 'Mild (+SpA, -Def)' },
    quiet: { atk: 1, def: 1, spa: 1.1, spd: 1, spe: 0.9, display: 'Quiet (+SpA, -Spe)' },
    rash: { atk: 1, def: 1, spa: 1.1, spd: 0.9, spe: 1, display: 'Rash (+SpA, -SpD)' },
    calm: { atk: 0.9, def: 1, spa: 1, spd: 1.1, spe: 1, display: 'Calm (+SpD, -Atk)' },
    gentle: { atk: 1, def: 0.9, spa: 1, spd: 1.1, spe: 1, display: 'Gentle (+SpD, -Def)' },
    sassy: { atk: 1, def: 1, spa: 1, spd: 1.1, spe: 0.9, display: 'Sassy (+SpD, -Spe)' },
    careful: { atk: 1, def: 1, spa: 0.9, spd: 1.1, spe: 1, display: 'Careful (+SpD, -SpA)' },
  }

  const calculateStat = (baseStat, level, iv, ev, nature, statType) => {
    if (isLegacy) {
      // Gen 1-2 formula: ((Base + DV) * 2 + floor(EV / 4)) * Level / 100 + 5
      // EV here represents sqrt(Stat Exp), range 0-255. No nature modifier.
      if (statType === 'hp') {
        return Math.floor(((baseStat + iv) * 2 + Math.floor(ev / 4)) * level / 100) + level + 10
      } else {
        return Math.floor(((baseStat + iv) * 2 + Math.floor(ev / 4)) * level / 100) + 5
      }
    }
    // Gen 3+ formula
    const modifier = natures[nature][statType] || 1
    if (statType === 'hp') {
      return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100 + level + 10)
    } else {
      const calculated = Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100 + 5)
      return Math.floor(calculated * modifier)
    }
  }

  const statTypeMap = {
    'hp': 'hp',
    'attack': 'atk',
    'defense': 'def',
    'special': 'spc',
    'special-attack': 'spa',
    'special-defense': 'spd',
    'speed': 'spe',
  }

  const baseStats = statsProp || pokemon.stats
  const stats = baseStats.map(stat => {
    const statKey = statTypeMap[stat.stat.name] || stat.stat.name
    const ivKey = statKey
    const evKey = statKey
    const calculated = calculateStat(
      stat.base_stat, 
      level, 
      ivs[ivKey] ?? ivs['spa'], 
      evs[evKey] ?? evs['spa'], 
      nature, 
      statKey === 'spc' ? 'spa' : statKey
    )
    
    return {
      name: stat.stat.name.toUpperCase().replace(/-/g, ' '),
      shortName: statKey.toUpperCase(),
      base: stat.base_stat,
      calculated,
      key: statKey,
    }
  })

  const getStatColor = (value) => {
    if (value < 60) return '#ff6b6b'
    if (value < 80) return '#ffa500'
    if (value < 100) return '#ffeb3b'
    if (value < 130) return '#90ee90'
    return '#4caf50'
  }

  // Darker text-safe variants for light mode (yellow/orange/green are hard to read on white)
  const getStatTextColor = (value) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    if (isDark) return getStatColor(value)
    if (value < 60) return '#d32f2f'
    if (value < 80) return '#e65100'
    if (value < 100) return '#f9a825'
    if (value < 130) return '#388e3c'
    return '#2e7d32'
  }

  const totalEvs = Object.values(evs).reduce((sum, val) => sum + val, 0)
  const evRemaining = 508 - totalEvs

  const handleEvChange = (statKey, value) => {
    const newValue = parseInt(value) || 0
    if (isLegacy) {
      // Gen 1-2: each EV can be 0-255, no total cap
      const clampedValue = Math.max(0, Math.min(255, newValue))
      setEvs({ ...evs, [statKey]: clampedValue })
    } else {
      // Gen 3+: each EV 0-252, total capped at 508
      const clampedValue = Math.max(0, Math.min(252, newValue))
      const currentTotal = totalEvs - evs[statKey]
      const finalValue = currentTotal + clampedValue > 508 ? 508 - currentTotal : clampedValue
      setEvs({ ...evs, [statKey]: finalValue })
    }
    // Remove from maxed order if manually changed
    setMaxedOrder(prev => prev.filter(k => k !== statKey))
  }

  const handleMaxEv = (statKey) => {
    if (isLegacy) {
      // Gen 1-2: no total cap, just toggle between 0 and 255
      setEvs(prev => ({ ...prev, [statKey]: prev[statKey] === maxEv ? 0 : maxEv }))
      return
    }
    // If already maxed via button, toggle it off
    if (maxedOrder.includes(statKey) && evs[statKey] === 252) {
      setEvs(prev => ({ ...prev, [statKey]: 0 }))
      setMaxedOrder(prev => prev.filter(k => k !== statKey))
      return
    }

    const newEvs = { ...evs, [statKey]: 252 }
    let newOrder = maxedOrder.filter(k => k !== statKey)
    let total = Object.values(newEvs).reduce((sum, val) => sum + val, 0)

    // FIFO: zero out the oldest maxed stats until we fit within 508
    while (total > 508 && newOrder.length > 0) {
      const oldest = newOrder.shift()
      newEvs[oldest] = 0
      total = Object.values(newEvs).reduce((sum, val) => sum + val, 0)
    }

    // If still over (manual EVs filling the budget), give whatever remains
    if (total > 508) {
      const othersTotal = total - newEvs[statKey]
      newEvs[statKey] = Math.max(0, 508 - othersTotal)
    }

    newOrder.push(statKey)
    setEvs(newEvs)
    setMaxedOrder(newOrder)
  }

  const handleIvChange = (statKey, value) => {
    const newValue = parseInt(value) || 0
    const clampedValue = Math.max(0, Math.min(maxIv, newValue))
    setIvs({ ...ivs, [statKey]: clampedValue })
  }

  // Level control helpers
  const clampLevel = (val) => Math.min(100, Math.max(1, Number(val) || 1))

  const setLevelSafe = (val) => {
    setLevel(clampLevel(val))
  }

  const bumpLevel = (delta) => {
    setLevel(prev => clampLevel(prev + delta))
  }

  // ── Damage Calculator helpers ─────────────────────────────────────────────
  const GEN1_TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon']
  const GEN2_5_TYPES = [...GEN1_TYPES, 'dark','steel']
  const MODERN_TYPES = [...GEN1_TYPES, 'dark','steel','fairy']
  const availableTypes = currentGen === 1 ? GEN1_TYPES : (currentGen >= 2 && currentGen <= 5) ? GEN2_5_TYPES : MODERN_TYPES

  const pokemonTypes = pokemon?.types?.map(t => t.type.name) || []

  // Auto-detect STAB when move type changes
  useEffect(() => {
    setDmgStab(pokemonTypes.includes(dmgMoveType))
  }, [dmgMoveType]) // eslint-disable-line react-hooks/exhaustive-deps

  const getTypeMultiplier = (chart, moveType, defType) => {
    const entry = chart[defType]
    if (!entry) return 1
    if (entry.immune.includes(moveType)) return 0
    if (entry.weak.includes(moveType)) return 2
    if (entry.resists.includes(moveType)) return 0.5
    return 1
  }

  const getAttackerStatForDmg = () => {
    const key = isLegacy
      ? (dmgCategory === 'physical' ? 'atk' : 'spc')
      : (dmgCategory === 'physical' ? 'atk' : 'spa')
    return stats.find(s => s.key === key)?.calculated || 0
  }

  const calcDamageRange = () => {
    const power = parseInt(dmgPower) || 0
    const defStat = parseInt(dmgDefStat) || 0
    if (power <= 0 || defStat <= 0) return null
    const atkStat = getAttackerStatForDmg()
    if (!atkStat) return null

    const base = Math.floor(Math.floor((2 * level / 5 + 2) * power * atkStat / defStat) / 50) + 2

    const chart = getTypeEffectiveness(selectedVersion)
    const mult1 = getTypeMultiplier(chart, dmgMoveType, dmgDefType1)
    const mult2 = dmgDefType2 !== 'none' ? getTypeMultiplier(chart, dmgMoveType, dmgDefType2) : 1
    const effectiveness = mult1 * mult2

    let damage = base
    if (dmgStab) damage = Math.floor(damage * 1.5)
    damage = Math.floor(damage * effectiveness)
    if (dmgCrit) damage = Math.floor(damage * (currentGen && currentGen <= 5 ? 2 : 1.5))
    if (dmgBurned && dmgCategory === 'physical') damage = Math.floor(damage * 0.5)

    return { min: Math.floor(damage * 0.85), max: damage, effectiveness, atkStat }
  }

  const effectivenessLabel = (mult) => {
    if (mult === 0) return { text: 'Immune (0×)', color: '#888' }
    if (mult <= 0.25) return { text: 'Not very effective (0.25×)', color: '#6890F0' }
    if (mult < 1) return { text: 'Not very effective (0.5×)', color: '#6890F0' }
    if (mult >= 4) return { text: 'Super effective (4×)', color: '#b71c1c' }
    if (mult === 2) return { text: 'Super effective (2×)', color: '#e53935' }
    return { text: 'Normal (1×)', color: 'var(--text-secondary, #888)' }
  }

  return (
    <div className="stats-calculator">
      {/* Mode toggle */}
      <div style={{ display: 'flex', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-light, #ddd)' }}>
          {[['stats', 'Stats'], ['damage', 'Damage']].map(([mode, label], i) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCalcMode(mode)}
              style={{
                padding: '0.35rem 1.1rem',
                background: calcMode === mode ? 'var(--accent, #6890F0)' : 'var(--control-bg, #fafafa)',
                color: calcMode === mode ? '#fff' : 'var(--text-color, #333)',
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border-light, #ddd)' : 'none',
                cursor: 'pointer',
                fontWeight: calcMode === mode ? 'bold' : 'normal',
                fontSize: '0.9rem',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="calculator-controls" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="control-group">
          <label htmlFor="level">Level:</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '0.4rem'
            }}
          >
            <button type="button" onClick={() => bumpLevel(-10)} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer' }}>−10</button>
            <button type="button" onClick={() => bumpLevel(-1)} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer' }}>−</button>

            <input
              id="level"
              type="number"
              min="1"
              max="100"
              value={level}
              onChange={(e) => setLevelSafe(e.target.value)}
              style={{ width: '60px', textAlign: 'center', padding: '0.4rem' }}
            />

            <button type="button" onClick={() => bumpLevel(1)} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer' }}>+</button>
            <button type="button" onClick={() => bumpLevel(10)} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer' }}>+10</button>
          </div>

          <input
            type="range"
            min="1"
            max="100"
            value={level}
            onChange={(e) => setLevelSafe(e.target.value)}
            style={{ width: '150px' }}
          />
        </div>
        {!isLegacy && (
          <div className="control-group" style={{ flex: '1', minWidth: '250px' }}>
            <label htmlFor="nature">Nature:</label>
            <select 
              id="nature"
              value={nature} 
              onChange={(e) => setNature(e.target.value)}
              style={{ width: '100%' }}
            >
              {Object.entries(natures).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.display}
                </option>
              ))}
            </select>
          </div>
        )}
        {!isLegacy && (
          <div style={{ 
            padding: '0.5rem 1rem', 
            background: evRemaining < 0 ? 'var(--ev-over-bg, #ffebee)' : 'var(--ev-ok-bg, #e8f5e9)',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}>
            EVs Remaining: {evRemaining} / 508
          </div>
        )}
      </div>

      {calcMode === 'stats' && (
        <>
      <div className="stats-display" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {stats.map(stat => {
          const barColor = getStatColor(stat.calculated) // Use calculated stat for color
          
          return (
            <div key={stat.name} className="stat-calc-row" style={{ 
              display: 'grid', 
              gridTemplateColumns: '80px 60px 1fr 80px 80px 40px 80px',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.5rem',
              background: 'var(--control-bg, #fafafa)',
              borderRadius: '4px'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{stat.shortName}</span>
              <span style={{ 
                fontWeight: 'bold', 
                color: getStatTextColor(stat.base),
                fontSize: '0.9rem'
              }}>
                {stat.base}
              </span>
              <div style={{ 
                height: '20px', 
                backgroundColor: 'var(--stat-bar-bg, #e0e0e0)', 
                borderRadius: '10px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${(stat.calculated / 500) * 100}%`, 
                  height: '100%',
                  background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                  transition: 'width 0.3s ease, background 0.3s ease'
                }} />
              </div>
              <input
                type="number"
                min="0"
                max={maxIv}
                value={ivs[stat.key] ?? (isLegacy ? 15 : 31)}
                onChange={(e) => handleIvChange(stat.key, e.target.value)}
                style={{ 
                  padding: '0.3rem', 
                  width: '100%',
                  border: '1px solid var(--border-light, #ddd)',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--input-bg, white)',
                  color: 'var(--text-color, #333)'
                }}
                title={isLegacy ? 'DV (0-15)' : 'IV (0-31)'}
              />
              <input
                type="number"
                min="0"
                max={maxEv}
                step={isLegacy ? 1 : 4}
                value={evs[stat.key] ?? 0}
                onChange={(e) => handleEvChange(stat.key, e.target.value)}
                style={{ 
                  padding: '0.3rem', 
                  width: '100%',
                  border: '1px solid var(--border-light, #ddd)',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--input-bg, white)',
                  color: 'var(--text-color, #333)'
                }}
                title={isLegacy ? 'EV (0-255)' : 'EV (0-252)'}
              />
              {!isLegacy ? (
                <button
                  type="button"
                  className={`ev-max-btn${maxedOrder.includes(stat.key) && evs[stat.key] === 252 ? ' ev-max-active' : ''}`}
                  onClick={() => handleMaxEv(stat.key)}
                  title={maxedOrder.includes(stat.key) && evs[stat.key] === 252 ? 'Clear this EV' : 'Max this EV to 252'}
                >
                  {maxedOrder.includes(stat.key) && evs[stat.key] === 252 ? '✕' : '▲'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`ev-max-btn${evs[stat.key] === maxEv ? ' ev-max-active' : ''}`}
                  onClick={() => handleMaxEv(stat.key)}
                  title={evs[stat.key] === maxEv ? 'Clear this EV' : 'Max this EV to 255'}
                >
                  {evs[stat.key] === maxEv ? '✕' : '▲'}
                </button>
              )}
              <span style={{ 
                fontWeight: 'bold', 
                fontSize: '1rem',
                textAlign: 'right',
                color: getStatTextColor(stat.calculated)
              }}>
                {stat.calculated}
              </span>
            </div>
          )
        })}
      </div>
      
      <div className="stat-calc-row stat-calc-footer" style={{ 
        marginTop: '0.25rem', 
        padding: '0.25rem 0.5rem',
        fontSize: '0.85rem',
        color: 'var(--text-secondary, #666)',
        display: 'grid',
        gridTemplateColumns: '80px 60px 1fr 80px 80px 40px 80px',
        gap: '0.5rem'
      }}>
        <span></span>
        <span style={{ fontWeight: 'bold' }}>Base</span>
        <span></span>
        <span style={{ fontWeight: 'bold', textAlign: 'center' }}>{isLegacy ? 'DV' : 'IV'}</span>
        <span style={{ fontWeight: 'bold', textAlign: 'center' }}>EV</span>
        <span></span>
        <span style={{ fontWeight: 'bold', textAlign: 'right' }}>Final</span>
      </div>
        </>
      )}

      {calcMode === 'damage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Move config */}
          <div style={{ background: 'var(--control-bg, #fafafa)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary, #666)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Move</div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="control-group">
                <label>Type</label>
                <select value={dmgMoveType} onChange={e => setDmgMoveType(e.target.value)}>
                  {availableTypes.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label>Category</label>
                <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-light, #ddd)' }}>
                  {['physical', 'special'].map((cat, i) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDmgCategory(cat)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: dmgCategory === cat ? 'var(--accent, #6890F0)' : 'transparent',
                        color: dmgCategory === cat ? '#fff' : 'var(--text-color, #333)',
                        border: 'none',
                        borderLeft: i > 0 ? '1px solid var(--border-light, #ddd)' : 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: dmgCategory === cat ? 'bold' : 'normal',
                      }}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-group">
                <label>Base Power</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={dmgPower}
                  onChange={e => setDmgPower(e.target.value)}
                  style={{ width: '70px', textAlign: 'center', padding: '0.35rem' }}
                />
              </div>
            </div>
          </div>

          {/* Defender config */}
          <div style={{ background: 'var(--control-bg, #fafafa)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary, #666)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Defender</div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="control-group">
                <label>Type 1</label>
                <select value={dmgDefType1} onChange={e => setDmgDefType1(e.target.value)}>
                  {availableTypes.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label>Type 2</label>
                <select value={dmgDefType2} onChange={e => setDmgDefType2(e.target.value)}>
                  <option value="none">—</option>
                  {availableTypes.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label>{isLegacy ? (dmgCategory === 'physical' ? 'Def Stat' : 'Spc Stat') : (dmgCategory === 'physical' ? 'Def Stat' : 'SpD Stat')}</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={dmgDefStat}
                  onChange={e => setDmgDefStat(e.target.value)}
                  style={{ width: '70px', textAlign: 'center', padding: '0.35rem' }}
                />
              </div>
            </div>
          </div>

          {/* Modifiers */}
          <div style={{ background: 'var(--control-bg, #fafafa)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary, #666)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Modifiers</div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={dmgStab} onChange={e => setDmgStab(e.target.checked)} />
                STAB (1.5×)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={dmgCrit} onChange={e => setDmgCrit(e.target.checked)} />
                Critical Hit ({currentGen && currentGen <= 5 ? '2×' : '1.5×'})
              </label>
              {dmgCategory === 'physical' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={dmgBurned} onChange={e => setDmgBurned(e.target.checked)} />
                  Burned Attacker (0.5×)
                </label>
              )}
            </div>
          </div>

          {/* Output */}
          {(() => {
            const result = calcDamageRange()
            const atkStatLabel = isLegacy
              ? (dmgCategory === 'physical' ? 'Atk' : 'Spc')
              : (dmgCategory === 'physical' ? 'Atk' : 'SpA')
            if (!result) {
              return (
                <div style={{ color: 'var(--text-muted, #888)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  Enter a valid base power and defender stat to calculate damage.
                </div>
              )
            }
            const { min, max, effectiveness, atkStat } = result
            const effInfo = effectivenessLabel(effectiveness)
            return (
              <div style={{ background: 'var(--control-bg, #fafafa)', borderRadius: '6px', padding: '1rem', border: '2px solid var(--border-light, #ddd)' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #666)' }}>
                    Attacker {atkStatLabel}: <strong>{atkStat}</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: effInfo.color }}>
                    {effInfo.text}
                  </span>
                </div>
                {effectiveness === 0 ? (
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#888' }}>No Effect</div>
                ) : (
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-color, #333)' }}>
                    {min === max ? `${max}` : `${min}–${max}`}
                    <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-secondary, #666)', marginLeft: '0.5rem' }}>damage</span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}