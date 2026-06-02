const STAT_SHORT_NAMES = {
  'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF',
  'special': 'SPC', 'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'SPE'
}

export default function BaseStatsBox({ stats, onJumpToCalc }) {
  return (
    <div className="info-box basestats-box">
      <div className="box-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Base Stats</span>
        <button
          type="button"
          className="scroll-to-calc-btn"
          onClick={onJumpToCalc}
          title="Jump to Stats Calculator"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="13" y2="14" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <div className="box-content stats-compact">
        {stats.map(stat => {
          const maxStat = 255 // Maximum possible stat value in Pokemon
          const percentage = (stat.base_stat / maxStat) * 100
          const statColor = stat.base_stat < 60 ? '#ff6b6b' :
                           stat.base_stat < 80 ? '#ffa500' :
                           stat.base_stat < 100 ? '#ffeb3b' :
                           stat.base_stat < 130 ? '#90ee90' : '#4caf50'
          const shortName = STAT_SHORT_NAMES[stat.stat.name] || stat.stat.name

          return (
            <div key={stat.stat.name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div className="stat-compact-row">
                <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '11px', minWidth: '28px' }}>
                  {shortName}
                </span>
                <span className="stat-number" style={{ fontWeight: 'bold', marginRight: '8px' }}>
                  {stat.base_stat}
                </span>
                <div style={{
                  flex: 1,
                  height: '14px',
                  backgroundColor: 'var(--stat-bar-bg, #e0e0e0)',
                  borderRadius: '7px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    backgroundColor: statColor,
                    transition: 'width 0.3s ease',
                    borderRadius: '7px'
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
