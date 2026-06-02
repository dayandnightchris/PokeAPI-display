import { generationOrder } from '../utils/versionInfo'
import { titleCase } from '../utils/format'

export default function AbilitiesBox({ abilities, abilityDescriptions, onAbilityClick, selectedGenerationRank }) {
  // The "Hidden" badge only applies from Gen V onward (when hidden abilities exist).
  const showHiddenBadge = (isHidden) => {
    if (!isHidden) return false
    if (!selectedGenerationRank) return true
    return selectedGenerationRank >= generationOrder['generation-v']
  }

  return (
    <div className="info-box abilities-box">
      <div className="box-title">Abilities</div>
      <div className="box-content abilities-list">
        {abilities.length > 0 ? (
          abilities.map((ability, idx) => (
            <div key={idx} className="ability-item">
              <span className="tooltip-trigger">
                {onAbilityClick
                  ? <button type="button" className="ability-name-link" onClick={() => onAbilityClick(ability.ability.name)}>{titleCase(ability.ability.name)}</button>
                  : titleCase(ability.ability.name)
                }
                {abilityDescriptions[ability.ability.name]?.description && (
                  <span className="tooltip-text">{abilityDescriptions[ability.ability.name].description}</span>
                )}
              </span>
              {showHiddenBadge(ability.is_hidden)
                ? <span className="hidden-badge">Hidden</span>
                : <span className={`slot-badge slot-badge-${ability.slot}`}>Ability {ability.slot}</span>
              }
            </div>
          ))
        ) : (
          <p style={{ margin: '0', color: 'var(--text-muted, #888)', fontSize: '12px' }}>No abilities in this version.</p>
        )}
      </div>
    </div>
  )
}
