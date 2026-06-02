import { useState } from 'react'
import { getTypeColor, getTypeTextColor } from '../utils/typeColors'
import { getTypeEffectiveness } from '../utils/typeEffectiveness'

// Renders the Pokémon's type badges and, on hover/tap, a defensive
// type-effectiveness tooltip computed for the selected generation's chart.
export default function TypeMatchupDisplay({ types, selectedVersion }) {
  const [hoveredType, setHoveredType] = useState(null)
  const [pinnedType, setPinnedType] = useState(null)

  // Use the version-appropriate type chart (Gen 1 / Gen 2–5 / Gen 6+)
  const typeEffectiveness = getTypeEffectiveness(selectedVersion)

  const getCombinedTypeMatchups = () => {
    const typeNames = types?.map(t => t.type.name) || []
    if (typeNames.length === 0) return null

    const result = { immune: [], veryResistant: [], resists: [], weak: [], veryWeak: [] }

    for (const attackType of Object.keys(typeEffectiveness)) {
      let multiplier = 1
      for (const defType of typeNames) {
        const matchup = typeEffectiveness[defType]
        if (!matchup) continue
        if (matchup.immune?.includes(attackType)) { multiplier = 0; break }
        if (matchup.weak?.includes(attackType)) multiplier *= 2
        if (matchup.resists?.includes(attackType)) multiplier *= 0.5
      }
      if (multiplier === 0) result.immune.push(attackType)
      else if (multiplier <= 0.25) result.veryResistant.push(attackType)
      else if (multiplier < 1) result.resists.push(attackType)
      else if (multiplier >= 4) result.veryWeak.push(attackType)
      else if (multiplier >= 2) result.weak.push(attackType)
    }

    return result
  }

  const matchups = getCombinedTypeMatchups()

  return (
    <div className="types-inline">
      {types?.map(type => (
        <span
          key={type.type.name}
          className="type-badge-small"
          style={{
            backgroundColor: getTypeColor(type.type.name),
            color: getTypeTextColor(type.type.name),
            padding: '4px 8px',
            borderRadius: '3px',
            textTransform: 'capitalize',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'help',
            display: 'inline-block',
            marginRight: '8px'
          }}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHoveredType(type.type.name) }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoveredType(null) }}
          onTouchEnd={(e) => {
            e.preventDefault()
            setPinnedType(prev => prev === type.type.name ? null : type.type.name)
          }}
        >
          {type.type.name}
        </span>
      ))}
      {matchups && (hoveredType || pinnedType) && (
        <div
          className={`type-matchup-tooltip${pinnedType ? ' is-pinned' : ''}`}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoveredType(null) }}
          onTouchEnd={(e) => { e.preventDefault(); setPinnedType(null) }}
        >
          <span className="matchup-lock-icon" title={pinnedType ? 'Tap to dismiss' : ''}>
            {pinnedType ? '🔒' : '🔓'}
          </span>
          {[
            { label: 'Very Weak to', types: matchups.veryWeak },
            { label: 'Weak to', types: matchups.weak },
            { label: 'Resists', types: matchups.resists },
            { label: 'Very Resistant to', types: matchups.veryResistant },
            { label: 'Immune to', types: matchups.immune },
          ].map(({ label, types: matchupTypes }) => (
            <div key={label} className="matchup-section">
              <div className="matchup-label">{label}:</div>
              <div className="matchup-types">
                {matchupTypes.length > 0 ? (
                  matchupTypes.map(t => (
                    <span key={t} className="matchup-type-chip" style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t) }}>
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="matchup-none">None</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
