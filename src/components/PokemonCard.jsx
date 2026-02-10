import { useState, useEffect, useCallback } from 'react'
import StatsCalculator from './StatsCalculator'
import VersionSelector from './VersionSelector'

export default function PokemonCard({ pokemon, onEvolutionClick }) {
  const [species, setSpecies] = useState(null)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [allEncounters, setAllEncounters] = useState([])
  const [abilityDescriptions, setAbilityDescriptions] = useState({})
  const [evolutions, setEvolutions] = useState([])
  const [moves, setMoves] = useState({ levelUp: [], tm: [], tutor: [], event: [], egg: [] })
  const [versionSprite, setVersionSprite] = useState(null)
  const [hoveredType, setHoveredType] = useState(null)
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [formPokemon, setFormPokemon] = useState(null)
  const displayPokemon = formPokemon || pokemon

  useEffect(() => {
    if (!pokemon) return
    
    // Reset form state when pokemon changes
    setSelectedForm(null)
    setFormPokemon(null)
    
    // Fetch species data for more info
    fetch(pokemon.species.url)
      .then(res => res.json())
      .then(data => setSpecies(data))
      .catch(err => console.error('Failed to fetch species:', err))
    
    // Fetch location areas with version info
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}/encounters`)
      .then(res => res.json())
      .then(data => setAllEncounters(data))
      .catch(err => {
        console.error('Failed to fetch location areas:', err)
        setAllEncounters([])
      })
    
    // Auto-select the latest version
    if (pokemon.game_indices && pokemon.game_indices.length > 0) {
      const latestVersion = pokemon.game_indices[pokemon.game_indices.length - 1].version.name
      setSelectedVersion(latestVersion)
    }
  }, [pokemon])

  // Extract forms and set initial selected form, filtered by game version
  useEffect(() => {
    if (!species?.varieties?.length) return
    
    const getVersionAvailability = async (formName) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${formName}/`)
        const data = await res.json()
        // Check if this form exists in the selected version
        return data.game_indices?.some(gi => gi.version.name === selectedVersion) || false
      } catch (err) {
        console.error('Failed to check form availability:', formName, err)
        return false
      }
    }
    
    // Get all distinct form names from varieties
    let formList = species.varieties
      .map(v => v.pokemon.name)
      .filter(name => {
        // Filter to only forms of the current pokemon's evolution line
        const baseName = pokemon.name.split('-')[0]
        return name.startsWith(baseName)
      })
      .sort()
    
    // Filter forms by version availability
    if (selectedVersion) {
      const filterByVersion = async () => {
        const availableForms = []
        for (const form of formList) {
          const isAvailable = await getVersionAvailability(form)
          if (isAvailable) {
            availableForms.push(form)
          }
        }
        setForms(availableForms)
        
        // Auto-select the base form (without hyphen) or first form
        const baseForm = availableForms.find(f => !f.includes('-')) || availableForms[0]
        if (baseForm && baseForm !== selectedForm) {
          setSelectedForm(baseForm)
        }
      }
      filterByVersion()
    } else {
      setForms(formList)
      const baseForm = formList.find(f => !f.includes('-')) || formList[0]
      if (baseForm && baseForm !== selectedForm) {
        setSelectedForm(baseForm)
      }
    }
  }, [species?.varieties, pokemon.name, selectedVersion, selectedForm])

  // Fetch selected form's pokemon data
  useEffect(() => {
    if (!selectedForm || selectedForm === pokemon.name) {
      setFormPokemon(null)
      return
    }
    
    fetch(`https://pokeapi.co/api/v2/pokemon/${selectedForm}/`)
      .then(res => res.json())
      .then(data => setFormPokemon(data))
      .catch(err => console.error('Failed to fetch form pokemon:', selectedForm, err))
  }, [selectedForm, pokemon.name])

  // Fetch ability descriptions
  useEffect(() => {
    if (!pokemon?.abilities?.length) return
    
    const fetchAbilityData = async () => {
      const descriptions = {}
      for (const ability of pokemon.abilities) {
        try {
          const res = await fetch(ability.ability.url)
          const data = await res.json()
          const desc = data.effect_entries?.find(e => e.language.name === 'en')?.effect || 'No description available.'
          descriptions[ability.ability.name] = desc
        } catch (err) {
          console.error('Failed to fetch ability:', ability.ability.name)
          descriptions[ability.ability.name] = 'No description available.'
        }
      }
      setAbilityDescriptions(descriptions)
    }
    
    fetchAbilityData()
  }, [pokemon?.abilities])

  // Fetch evolution chain with version filtering
  useEffect(() => {
    if (!species?.evolution_chain?.url) return
    
    const checkVersionAvailability = async (speciesName) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesName}/`)
        const data = await res.json()
        // If no version selected, show all. Otherwise check if species exists in version
        if (!selectedVersion) return true
        return data.game_indices?.some(gi => gi.version.name === selectedVersion) || false
      } catch (err) {
        return false
      }
    }
    
    const fetchEvolutionChain = async () => {
      try {
        const res = await fetch(species.evolution_chain.url)
        const data = await res.json()
        const evolutionList = []
        const seen = new Set()
        
        const traverse = async (chain) => {
          // Add current species if not seen and available in version
          if (chain.species && !seen.has(chain.species.name)) {
            const isAvailable = await checkVersionAvailability(chain.species.name)
            if (isAvailable) {
              evolutionList.push({
                name: chain.species.name,
                url: chain.species.url
              })
              seen.add(chain.species.name)
            }
          }
          
          // Process evolutions
          if (chain.evolves_to?.length > 0) {
            for (const evo of chain.evolves_to) {
              const isEvoAvailable = await checkVersionAvailability(evo.species.name)
              if (isEvoAvailable) {
                // Add trigger between current and next evolution
                const trigger = evo.evolution_details?.[0]
                const triggerText = trigger ? getTriggerText(trigger) : 'Unknown'
                evolutionList.push({
                  isTrigger: true,
                  text: triggerText
                })
                
                // Add evolved species and continue recursion
                if (!seen.has(evo.species.name)) {
                  evolutionList.push({
                    name: evo.species.name,
                    url: evo.species.url
                  })
                  seen.add(evo.species.name)
                  
                  // Continue traversal from this species
                  await traverse(evo)
                }
              }
            }
          }
        }
        
        await traverse(data.chain)
        setEvolutions(evolutionList)
      } catch (err) {
        console.error('Failed to fetch evolution chain:', err)
      }
    }
    
    fetchEvolutionChain()
  }, [species?.evolution_chain?.url, selectedVersion])

  const getTriggerText = (trigger) => {
    if (trigger.trigger.name === 'level-up') {
      if (trigger.min_level) {
        return `L${trigger.min_level}`
      }
      // Check for other level-up conditions
      if (trigger.min_happiness) {
        return `Happiness ${trigger.min_happiness}`
      }
      if (trigger.min_affection) {
        return `Affection ${trigger.min_affection}`
      }
      if (trigger.min_beauty) {
        return `Beauty ${trigger.min_beauty}`
      }
      if (trigger.known_move) {
        return `Learn ${trigger.known_move.name}`
      }
      if (trigger.time_of_day) {
        return `Level up (${trigger.time_of_day})`
      }
      if (trigger.location) {
        return `Level up at ${trigger.location.name}`
      }
      return 'Level up'
    } else if (trigger.trigger.name === 'trade') {
      if (trigger.held_item) {
        return `Trade (${trigger.held_item.name.replace(/-/g, ' ')})`
      }
      if (trigger.trade_species) {
        return `Trade for ${trigger.trade_species.name}`
      }
      return 'Trade'
    } else if (trigger.trigger.name === 'use-item') {
      return `Use ${trigger.item?.name.replace(/-/g, ' ') || 'Item'}`
    } else if (trigger.trigger.name === 'shed') {
      return 'Shed'
    } else if (trigger.trigger.name === 'other') {
      return 'Special'
    }
    return trigger.trigger.name.replace(/-/g, ' ')
  }

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

  // Fetch moves grouped by method
  useEffect(() => {
    if (!displayPokemon?.moves?.length) return
    
    const groupedMoves = { levelUp: [], tm: [], tutor: [], event: [], egg: [] }
    const seenMoves = { levelUp: new Set(), tm: new Set(), tutor: new Set(), event: new Set(), egg: new Set() }
    
    displayPokemon.moves.forEach(moveData => {
      const moveName = moveData.move.name
      moveData.version_group_details?.forEach(detail => {
        const method = detail.move_learn_method?.name
        const level = detail.level_learned_at
        
        if (method === 'level-up' && !seenMoves.levelUp.has(moveName)) {
          groupedMoves.levelUp.push({ name: moveName, level })
          seenMoves.levelUp.add(moveName)
        } else if (method === 'machine' && !seenMoves.tm.has(moveName)) {
          groupedMoves.tm.push(moveName)
          seenMoves.tm.add(moveName)
        } else if (method === 'tutor' && !seenMoves.tutor.has(moveName)) {
          groupedMoves.tutor.push(moveName)
          seenMoves.tutor.add(moveName)
        } else if (method === 'reminder' && !seenMoves.event.has(moveName)) {
          groupedMoves.event.push(moveName)
          seenMoves.event.add(moveName)
        } else if (method === 'egg' && !seenMoves.egg.has(moveName)) {
          groupedMoves.egg.push(moveName)
          seenMoves.egg.add(moveName)
        }
      })
    })
    
    // Sort level-up moves by level
    groupedMoves.levelUp.sort((a, b) => a.level - b.level)
    // Sort moves alphabetically
    groupedMoves.tm.sort()
    groupedMoves.tutor.sort()
    groupedMoves.event.sort()
    groupedMoves.egg.sort()
    
    setMoves(groupedMoves)
  }, [displayPokemon?.moves])

  // Fetch version-specific sprites
  useEffect(() => {
    if (!displayPokemon?.sprites?.versions || !selectedVersion) {
      setVersionSprite(null)
      return
    }

    // Map version names to version group keys
    const versionGroupMap = {
      'red': 'generation-i',
      'blue': 'generation-i',
      'yellow': 'generation-i',
      'gold': 'generation-ii',
      'silver': 'generation-ii',
      'crystal': 'generation-ii',
      'ruby': 'generation-iii',
      'sapphire': 'generation-iii',
      'firered': 'generation-iii',
      'leafgreen': 'generation-iii',
      'emerald': 'generation-iii',
      'diamond': 'generation-iv',
      'pearl': 'generation-iv',
      'platinum': 'generation-iv',
      'heartgold': 'generation-iv',
      'soulsilver': 'generation-iv',
      'black': 'generation-v',
      'white': 'generation-v',
      'black-2': 'generation-v',
      'white-2': 'generation-v',
      'x': 'generation-vi',
      'y': 'generation-vi',
      'omega-ruby': 'generation-vi',
      'alpha-sapphire': 'generation-vi',
      'sun': 'generation-vii',
      'moon': 'generation-vii',
      'ultra-sun': 'generation-vii',
      'ultra-moon': 'generation-vii',
      'lets-go-pikachu': 'generation-vii',
      'lets-go-eevee': 'generation-vii',
      'sword': 'generation-viii',
      'shield': 'generation-viii',
      'scarlet': 'generation-ix',
      'violet': 'generation-ix'
    }

    const versionGroup = versionGroupMap[selectedVersion]
    if (versionGroup && displayPokemon.sprites.versions[versionGroup]) {
      const groupSprites = displayPokemon.sprites.versions[versionGroup]
      // Try to find a sprite for this version
      let sprite = null
      
      // Try different keys in the version group
      for (const key of Object.keys(groupSprites)) {
        if (key.includes(selectedVersion)) {
          const versionData = groupSprites[key]
          sprite = versionData?.front_default || null
          if (sprite) break
        }
      }
      
      setVersionSprite(sprite)
    } else {
      setVersionSprite(null)
    }
  }, [displayPokemon?.sprites?.versions, selectedVersion])

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
          <div className="box-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {evolutions.length > 1 ? (
              evolutions.map((item, idx) => {
                if (item.isTrigger) {
                  return (
                    <div key={`trigger-${idx}`} style={{ color: '#ff6b6b', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', maxWidth: '90px', margin: '4px 0 2px 0' }}>
                      {item.text}
                    </div>
                  )
                }
                
                const isCurrentPokemon = item.name === pokemon.name
                return (
                  <button
                    key={item.name}
                    onClick={() => onEvolutionClick?.(item.name)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: isCurrentPokemon ? '#ff0000' : '#444',
                      color: '#fff',
                      border: isCurrentPokemon ? '2px solid #cc0000' : '1px solid #666',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: isCurrentPokemon ? 'bold' : 'normal',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                      boxShadow: isCurrentPokemon ? '0 2px 4px rgba(255, 0, 0, 0.3)' : 'none'
                    }}
                  >
                    {item.name}
                  </button>
                )
              })
            ) : (
              <p style={{ margin: '0', color: '#888', fontSize: '12px' }}>No evolution available.</p>
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
                  .filter(enc => enc.version?.name === selectedVersion && enc.location_area?.name)
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