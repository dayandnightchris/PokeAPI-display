import { useState, useEffect } from 'react'
import StatsCalculator from './StatsCalculator'
import VersionSelector from './VersionSelector'
import { renderEvolutionNode } from './EvolutionTree'
import {
  usePokemonSpecies,
  useAbilityDescriptions,
  usePokemonForms,
  useEvolutionChain,
  useGroupedMoves,
  useVersionSprite
} from '../hooks'

export default function PokemonCard({ pokemon, onEvolutionClick }) {
  // UI state
  const [hoveredType, setHoveredType] = useState(null)

  // Data fetching hooks
  const { species, selectedVersion, setSelectedVersion, allEncounters } = usePokemonSpecies(pokemon)
  const { forms, selectedForm, setSelectedForm, formPokemon } = usePokemonForms({ species, pokemon, selectedVersion })
  const abilityDescriptions = useAbilityDescriptions(formPokemon || pokemon)
  const evolutions = useEvolutionChain({ species, selectedVersion })
  const moves = useGroupedMoves(formPokemon || pokemon)
  const versionSprite = useVersionSprite(formPokemon || pokemon, selectedVersion)

  // Derive display pokemon
  const displayPokemon = formPokemon || pokemon

  // Clear form selection when pokemon changes
  useEffect(() => {
    setSelectedForm(null)
  }, [pokemon?.id, setSelectedForm])

  const typeColors = {
    normal: '#A8A878',
    fire: '#F08030',
    water: '#6890F0',
    electric: '#F8D030',
    grass: '#78C850',
    ice: '#98D8D8',
    fighting: '#C03028',
    poison: '#A040A0',
    ground: '#E0C068',
    flying: '#A890F0',
    psychic: '#F85888',
    bug: '#A8B820',
    rock: '#B8A038',
    ghost: '#705898',
    dragon: '#7038F8',
    dark: '#705848',
    steel: '#B8B8D0',
    fairy: '#EE99AC'
  }

  const getTypeColor = (typeName) => typeColors[typeName?.toLowerCase()] || '#999'

  const typeEffectiveness = {
    normal: { resists: [], weak: ['fighting'], veryWeak: [] },
    fire: { resists: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], weak: ['water', 'ground', 'rock'], veryWeak: [] },
    water: { resists: ['fire', 'water', 'ice', 'steel'], weak: ['electric', 'grass'], veryWeak: [] },
    electric: { resists: ['flying', 'steel'], weak: ['ground'], veryWeak: [] },
    grass: { resists: ['ground', 'water', 'grass'], weak: ['fire', 'ice', 'poison', 'flying', 'bug'], veryWeak: [] },
    ice: { resists: ['ice'], weak: ['fire', 'fighting', 'rock', 'steel'], veryWeak: [] },
    fighting: { resists: ['rock', 'bug', 'dark'], weak: ['flying', 'psychic', 'fairy'], veryWeak: [] },
    poison: { resists: ['fighting', 'poison', 'bug', 'grass'], weak: ['ground', 'psychic'], veryWeak: [] },
    ground: { resists: ['poison', 'rock'], weak: ['water', 'grass', 'ice'], veryWeak: [] },
    flying: { resists: ['fighting', 'bug', 'grass'], weak: ['electric', 'ice', 'rock'], veryWeak: [] },
    psychic: { resists: ['fighting', 'psychic'], weak: ['bug', 'ghost', 'dark'], veryWeak: [] },
    bug: { resists: ['fighting', 'ground', 'grass'], weak: ['fire', 'flying', 'rock'], veryWeak: [] },
    rock: { resists: ['normal', 'flying', 'poison', 'fire'], weak: ['water', 'grass', 'fighting', 'ground', 'steel'], veryWeak: [] },
    ghost: { resists: ['poison', 'bug'], weak: ['ghost', 'dark'], veryWeak: [] },
    dragon: { resists: ['fire', 'water', 'grass', 'electric'], weak: ['ice', 'dragon', 'fairy'], veryWeak: [] },
    dark: { resists: ['ghost', 'dark'], weak: ['fighting', 'bug', 'fairy'], veryWeak: [] },
    steel: { resists: ['normal', 'flying', 'rock', 'bug', 'steel', 'grass', 'psychic', 'ice', 'dragon', 'fairy'], weak: ['fire', 'water', 'ground'], veryWeak: [] },
    fairy: { resists: ['fighting', 'bug', 'dark'], weak: ['poison', 'steel'], veryWeak: [] }
  }

  const getCombinedTypeMatchups = () => {
    const types = displayPokemon.types?.map(t => t.type.name) || []
    if (types.length === 0) return null

    let resists = new Set()
    let weak = new Set()
    let veryWeak = new Set()

    types.forEach(type => {
      const matchup = typeEffectiveness[type]
      if (matchup) {
        matchup.resists?.forEach(t => resists.add(t))
        matchup.weak?.forEach(t => weak.add(t))
        matchup.veryWeak?.forEach(t => veryWeak.add(t))
      }
    })

    // Calculate very weak for dual types: types that BOTH component types are weak to
    if (types.length === 2) {
      const type1Weak = new Set(typeEffectiveness[types[0]]?.weak || [])
      const type2Weak = new Set(typeEffectiveness[types[1]]?.weak || [])
      const intersection = new Set([...type1Weak].filter(t => type2Weak.has(t)))
      intersection.forEach(t => veryWeak.add(t))
      // Remove very weak from regular weak
      intersection.forEach(t => weak.delete(t))
    }

    // Remove overlaps: if a type resists and is weak, it cancels out
    weak.forEach(t => resists.delete(t))
    veryWeak.forEach(t => resists.delete(t))
    veryWeak.forEach(t => weak.delete(t))

    return {
      resists: Array.from(resists),
      weak: Array.from(weak),
      veryWeak: Array.from(veryWeak)
    }
  }

  if (!pokemon) {
    return <div className="loading">Loading Pokemon data...</div>
  }

  return (
    <div className="pokemon-card-container">
      {/* Version Selector */}
      <div className="version-selector-wrapper">
        <VersionSelector pokemon={pokemon} selectedVersion={selectedVersion} onVersionChange={setSelectedVersion} />
      </div>

      {/* Form Selector */}
      {forms.length > 1 && (
        <div className="form-selector-wrapper">
          <label className="form-label">Form:</label>
          <div className="form-buttons">
            {forms.map(form => (
              <button
                key={form}
                className={`form-button ${selectedForm === form ? 'active' : ''}`}
                onClick={() => setSelectedForm(form)}
              >
                {form.replace(pokemon.name + '-', '').replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card-section grid-4">
        {/* Image Box */}
        <div className="info-box image-box">
          {(versionSprite || displayPokemon?.sprites?.other?.['official-artwork']?.front_default) && (
            <img
              src={versionSprite || displayPokemon.sprites.other['official-artwork'].front_default}
              alt={displayPokemon.name}
              className="pokemon-main-image"
            />
          )}
        </div>

        {/* Species Info Box */}
        <div className="info-box">
          <div className="box-title">Species Info</div>
          <div className="box-content">
            <div className="info-row">
              <span className="label">Name:</span>
              <span className="value">{displayPokemon.name?.toUpperCase() || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="label">#</span>
              <span className="value">{displayPokemon.id || 'Unknown'}</span>
            </div>
            <div className="info-row" style={{ position: 'relative' }}>
              <span className="label">Type:</span>
              <div className="types-inline">
                {displayPokemon.types?.map(type => (
                  <span
                    key={type.type.name}
                    className="type-badge-small"
                    style={{
                      backgroundColor: getTypeColor(type.type.name),
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      textTransform: 'capitalize',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      position: 'relative',
                      cursor: 'help',
                      display: 'inline-block',
                      marginRight: '8px'
                    }}
                    onMouseEnter={() => setHoveredType(type.type.name)}
                    onMouseLeave={() => setHoveredType(null)}
                  >
                    {type.type.name}
                    {getCombinedTypeMatchups() && hoveredType === type.type.name && (
                        <div style={{
                          position: 'fixed',
                          zIndex: 10000,
                          backgroundColor: '#222',
                          border: '2px solid #555',
                          borderRadius: '6px',
                          padding: '12px',
                          minWidth: '280px',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: '#aaa', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Resists:</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getCombinedTypeMatchups().resists.length > 0 ? (
                                getCombinedTypeMatchups().resists.map(t => (
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#888', fontSize: '11px' }}>None</span>
                              )}
                            </div>
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: '#aaa', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Weak to:</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getCombinedTypeMatchups().weak.length > 0 ? (
                                getCombinedTypeMatchups().weak.map(t => (
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#888', fontSize: '11px' }}>None</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#aaa', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Very Weak to:</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getCombinedTypeMatchups().veryWeak.length > 0 ? (
                                getCombinedTypeMatchups().veryWeak.map(t => (
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#888', fontSize: '11px' }}>None</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Abilities Box */}
        <div className="info-box">
          <div className="box-title">Abilities</div>
          <div className="box-content abilities-list">
            {displayPokemon.abilities?.map((ability, idx) => (
              <div key={idx} className="ability-item">
                <span className="tooltip-trigger">
                  {ability.ability.name}
                  {abilityDescriptions[ability.ability.name] && (
                    <span className="tooltip-text">{abilityDescriptions[ability.ability.name]}</span>
                  )}
                </span>
                {ability.is_hidden && <span className="hidden-badge">Hidden</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Stats Box */}
        <div className="info-box">
          <div className="box-title">Base Stats</div>
          <div className="box-content stats-compact">
            {displayPokemon.stats?.map(stat => {
              const maxStat = 255 // Maximum possible stat value in Pokemon
              const percentage = (stat.base_stat / maxStat) * 100
              const statColor = stat.base_stat < 60 ? '#ff6b6b' : 
                               stat.base_stat < 80 ? '#ffa500' : 
                               stat.base_stat < 100 ? '#ffeb3b' : 
                               stat.base_stat < 130 ? '#90ee90' : '#4caf50'
              
              return (
                <div key={stat.stat.name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div className="stat-compact-row">
                    <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '11px' }}>
                      {stat.stat.name.replace(/-/g, ' ')}
                    </span>
                    <div style={{ 
                      flex: 1, 
                      height: '14px', 
                      backgroundColor: '#e0e0e0', 
                      borderRadius: '7px',
                      overflow: 'hidden',
                      margin: '0 8px'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: statColor,
                        transition: 'width 0.3s ease',
                        borderRadius: '7px'
                      }} />
                    </div>
                    <span className="stat-number" style={{ fontWeight: 'bold', minWidth: '35px', textAlign: 'right' }}>
                      {stat.base_stat}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Evolution, Locations, Misc Stats Grid */}
      <div className="grid-3">
        {/* Evolution Box */}
        <div className="info-box">
          <div className="box-title">Evolution Line</div>
          <div className="box-content" style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
            {evolutions ? (
              renderEvolutionNode(evolutions, pokemon.name, onEvolutionClick)
            ) : (
              <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>No evolution available.</p>
            )}
          </div>
        </div>

        {/* Locations Box */}
        <div className="info-box">
          <div className="box-title">Location</div>
          <div className="box-content">
            {selectedVersion && allEncounters.length > 0 ? (
              (() => {
                const locationsForVersion = allEncounters
                  .filter(enc =>
                    enc.version_details?.some(vd => vd.version.name === selectedVersion)
                  )
                  .map(enc => enc.location_area.name)
                
                const uniqueLocations = [...new Set(locationsForVersion)]
                return uniqueLocations.length > 0 ? (
                  <ul style={{ padding: '0 20px', margin: '0', lineHeight: '1.8' }}>
                    {uniqueLocations.map(location => (
                      <li key={location}>{location.replace(/-/g, ' ')}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: '0' }}>No known locations for this version.</p>
                )
              })()
            ) : allEncounters.length === 0 ? (
              <p style={{ margin: '0' }}>No location data available.</p>
            ) : (
              <p style={{ margin: '0' }}>Select a version to see locations.</p>
            )}
          </div>
        </div>

        {/* Misc Stats Box */}
        <div className="info-box">
          <div className="box-title">Misc Stats</div>
          <div className="box-content" style={{ fontSize: '12px' }}>
            <div><strong>Height:</strong> {displayPokemon.height ? (displayPokemon.height / 10).toFixed(1) + ' m' : 'N/A'}</div>
            <div><strong>Weight:</strong> {displayPokemon.weight ? (displayPokemon.weight / 10).toFixed(1) + ' kg' : 'N/A'}</div>
            <div><strong>Capture Rate:</strong> {species?.capture_rate || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Moves Flex Container */}
      {(moves.levelUp.length > 0 || moves.tm.length > 0 || moves.tutor.length > 0 || moves.event.length > 0 || moves.egg.length > 0) && (
        <div className="container-flex">
          {moves.levelUp.length > 0 && (
            <div className="info-box">
              <div className="box-title">Level Up Moves</div>
              <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {moves.levelUp.map(move => (
                    <li key={move.name}>Lv. {move.level}: {move.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {moves.tm.length > 0 && (
            <div className="info-box">
              <div className="box-title">TMs</div>
              <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {moves.tm.map((move, idx) => (
                    <li key={move}>TM{String(idx + 1).padStart(3, '0')}: {move}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {moves.tutor.length > 0 && (
            <div className="info-box">
              <div className="box-title">Tutor</div>
              <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {moves.tutor.map(move => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {moves.event.length > 0 && (
            <div className="info-box">
              <div className="box-title">Event</div>
              <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {moves.event.map(move => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {moves.egg.length > 0 && (
            <div className="info-box">
              <div className="box-title">Egg</div>
              <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {moves.egg.map(move => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Egg Groups, Hatch Steps, Gender, EV Yield Grid */}
      {species && (
        <div className="grid-4">
          <div className="info-box">
            <div className="box-title">Egg Groups</div>
            <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              {species.egg_groups?.length > 0 ? (
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {species.egg_groups.map(group => (
                    <li key={group.name}>{group.name}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0' }}>N/A</p>
              )}
            </div>
          </div>

          <div className="info-box">
            <div className="box-title">Egg Steps</div>
            <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <p style={{ margin: '0', fontSize: '18px', color: '#ff6b6b', fontWeight: 'bold' }}>
                {species.hatch_counter ? (species.hatch_counter * 255).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="info-box">
            <div className="box-title">Gender Ratio</div>
            <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <p style={{ margin: '0' }}>
                {species.gender_rate === -1 ? 'Genderless' : species.gender_rate === 0 ? 'Male only' : species.gender_rate === 8 ? 'Female only' : `${species.gender_rate * 12.5}% Female`}
              </p>
            </div>
          </div>

          <div className="info-box">
            <div className="box-title">EV Yield</div>
            <div className="box-content" style={{ fontSize: '12px' }}>
              {displayPokemon.stats?.some(s => s.effort > 0) ? (
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {displayPokemon.stats.map(stat => (
                    stat.effort > 0 && (
                      <li key={stat.stat.name}>
                        {stat.stat.name}: {stat.effort}
                      </li>
                    )
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0' }}>None</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Calculator Section */}
      <div className="info-box full-width" style={{ marginTop: '10px' }}>
        <div className="box-title">Stats Calculator</div>
        <div className="box-content">
          <StatsCalculator pokemon={displayPokemon} selectedVersion={selectedVersion} />
        </div>
      </div>

      {/* Pokedex Entries Grid */}
      {species?.flavor_text_entries?.length > 0 && (
        <div className="grid-3">
          {species.flavor_text_entries
            .filter(e => e.language.name === 'en')
            .slice(0, 3)
            .map((entry, idx) => (
              <div key={idx} className="info-box">
                <div className="box-title">{entry.version?.name?.replace(/-/g, ' ') || `Entry ${idx + 1}`}</div>
                <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  <p style={{ margin: '0' }}>{entry.flavor_text.replace(/\f/g, ' ')}</p>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}