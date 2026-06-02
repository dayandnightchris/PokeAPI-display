import { getEggGroupDisplayName } from '../utils/versionInfo'

// Egg groups, hatch time, and gender ratio. Hidden in Gen 1 (no breeding).
export default function BreedingInfoBox({ species, selectedGenerationRank }) {
  if (!species || (selectedGenerationRank && selectedGenerationRank < 2)) return null

  return (
    <div className="info-box breeding-info-box">
      <div className="box-title">Breeding Info</div>
      <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
        <div className="info-row">
          <span className="label">Egg Groups:</span>
          <span className="value">
            {species.egg_groups?.length > 0
              ? species.egg_groups.map(g => getEggGroupDisplayName(g.name, selectedGenerationRank)).join(', ')
              : 'N/A'}
          </span>
        </div>
        <div className="info-row">
          <span className="label">Hatch Steps:</span>
          <span className="value">{species.hatch_counter ? (species.hatch_counter * 255).toLocaleString() : 'N/A'}</span>
        </div>
        <div className="info-row">
          <span className="label">Hatch Cycles:</span>
          <span className="value">{species.hatch_counter ? species.hatch_counter.toLocaleString() : 'N/A'}</span>
        </div>
        <div className="info-row">
          <span className="label">Gender:</span>
          <span className="value">
            {species.gender_rate === -1 ? 'Genderless'
              : species.gender_rate === 0 ? '♂ 100% Male'
              : species.gender_rate === 8 ? '♀ 100% Female'
              : `♂ ${100 - species.gender_rate * 12.5}% / ♀ ${species.gender_rate * 12.5}%`}
          </span>
        </div>
        {species.gender_rate > 0 && species.gender_rate < 8 && (
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#EE99AC',
            borderRadius: '3px',
            overflow: 'hidden',
            marginTop: '2px'
          }}>
            <div style={{
              width: `${100 - species.gender_rate * 12.5}%`,
              height: '100%',
              backgroundColor: '#6890F0',
              borderRadius: '3px 0 0 3px'
            }} />
          </div>
        )}
      </div>
    </div>
  )
}
