import { useState } from 'react'

export default function StatsCalculator({ pokemon, selectedVersion }) {
  const [level, setLevel] = useState(50)
  const [nature, setNature] = useState('neutral')
  const [ivs, setIvs] = useState({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })
  const [evs, setEvs] = useState({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })

  // All natures with their stat modifiers
  const natures = {
    neutral: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1, display: 'Neutral' },
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
    const modifier = natures[nature][statType] || 1
    if (statType === 'hp') {
      // HP stat calculation
      return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100 + level + 10)
    } else {
      // Other stats
      const calculated = Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100 + 5)
      return Math.floor(calculated * modifier)
    }
  }

  const statTypeMap = {
    'hp': 'hp',
    'attack': 'atk',
    'defense': 'def',
    'special-attack': 'spa',
    'special-defense': 'spd',
    'speed': 'spe',
  }

  const stats = pokemon.stats.map(stat => {
    const statKey = statTypeMap[stat.stat.name] || stat.stat.name
    const calculated = calculateStat(
      stat.base_stat, 
      level, 
      ivs[statKey], 
      evs[statKey], 
      nature, 
      statKey
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

  const totalEvs = Object.values(evs).reduce((sum, val) => sum + val, 0)
  const evRemaining = 510 - totalEvs

  const handleEvChange = (statKey, value) => {
    const newValue = parseInt(value) || 0
    const clampedValue = Math.max(0, Math.min(252, newValue))
    const currentTotal = totalEvs - evs[statKey]
    const finalValue = currentTotal + clampedValue > 510 ? 510 - currentTotal : clampedValue
    setEvs({ ...evs, [statKey]: finalValue })
  }

  const handleIvChange = (statKey, value) => {
    const newValue = parseInt(value) || 0
    const clampedValue = Math.max(0, Math.min(31, newValue))
    setIvs({ ...ivs, [statKey]: clampedValue })
  }

  return (
    <div className="stats-calculator">
      <div className="calculator-controls" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="control-group">
          <label htmlFor="level">Level: {level}</label>
          <input
            id="level"
            type="range"
            min="1"
            max="100"
            value={level}
            onChange={(e) => setLevel(parseInt(e.target.value))}
            style={{ width: '150px' }}
          />
        </div>
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
        <div style={{ 
          padding: '0.5rem 1rem', 
          background: evRemaining < 0 ? '#ffebee' : '#e8f5e9',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '0.9rem'
        }}>
          EVs Remaining: {evRemaining} / 510
        </div>
      </div>

      <div className="stats-display" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {stats.map(stat => {
          const barColor = getStatColor(stat.calculated) // Use calculated stat for color
          
          return (
            <div key={stat.name} style={{ 
              display: 'grid', 
              gridTemplateColumns: '80px 60px 1fr 80px 80px 80px',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.5rem',
              background: '#fafafa',
              borderRadius: '4px'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{stat.shortName}</span>
              <span style={{ 
                fontWeight: 'bold', 
                color: getStatColor(stat.base),
                fontSize: '0.9rem'
              }}>
                {stat.base}
              </span>
              <div style={{ 
                height: '20px', 
                backgroundColor: '#e0e0e0', 
                borderRadius: '10px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${(stat.calculated / 400) * 100}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                  transition: 'width 0.3s ease, background 0.3s ease'
                }} />
              </div>
              <input
                type="number"
                min="0"
                max="31"
                value={ivs[stat.key]}
                onChange={(e) => handleIvChange(stat.key, e.target.value)}
                style={{ 
                  padding: '0.3rem', 
                  width: '100%',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
                title="IV (0-31)"
              />
              <input
                type="number"
                min="0"
                max="252"
                step="4"
                value={evs[stat.key]}
                onChange={(e) => handleEvChange(stat.key, e.target.value)}
                style={{ 
                  padding: '0.3rem', 
                  width: '100%',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
                title="EV (0-252)"
              />
              <span style={{ 
                fontWeight: 'bold', 
                fontSize: '1rem',
                textAlign: 'right',
                color: barColor
              }}>
                {stat.calculated}
              </span>
            </div>
          )
        })}
      </div>
      
      <div style={{ 
        marginTop: '0.5rem', 
        padding: '0.5rem',
        fontSize: '0.75rem',
        color: '#666',
        display: 'grid',
        gridTemplateColumns: '80px 60px 1fr 80px 80px 80px',
        gap: '0.5rem'
      }}>
        <span></span>
        <span style={{ fontWeight: 'bold' }}>Base</span>
        <span></span>
        <span style={{ fontWeight: 'bold', textAlign: 'center' }}>IV</span>
        <span style={{ fontWeight: 'bold', textAlign: 'center' }}>EV</span>
        <span style={{ fontWeight: 'bold', textAlign: 'right' }}>Final</span>
      </div>
    </div>
  )
}