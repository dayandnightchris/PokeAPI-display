import { useState, useEffect } from 'react'
import StatsCalculator from './StatsCalculator'
import VersionSelector from './VersionSelector'
import { renderEvolutionForest } from './EvolutionTree'
import { getVersionInfo, generationOrder } from '../utils/versionInfo'
import {
  usePokemonSpecies,
  useAbilityDescriptions,
  usePokemonForms,
  useEvolutionChain,
  useGroupedMoves,
  useVersionSprite
} from '../hooks'

const formatMoveLabel = (value) => {
  if (!value) return 'N/A'
  return value.replace(/-/g, ' ')
}

const getMoveEffectEntry = (details) => {
  if (!details) return 'N/A'
  const entry = (details.effect_entries || []).find(e => e.language?.name === 'en')
  if (!entry) return 'N/A'
  const baseText = entry.short_effect || entry.effect || 'N/A'
  if (details.effect_chance == null) return baseText
  return baseText.replace('$effect_chance', details.effect_chance)
}

function MoveTable({ title, moves, showLevel, showTmNumber }) {
  const [sortConfig, setSortConfig] = useState({
    key: showLevel ? 'level' : showTmNumber ? 'tmNumber' : 'name',
    direction: 'asc'
  })

  const columns = [
    ...(showLevel ? [{ key: 'level', label: 'Level', numeric: true }] : []),
    ...(showTmNumber ? [{ key: 'tmNumber', label: 'TM#', numeric: true }] : []),
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'effect', label: 'Effect Entry' },
    { key: 'category', label: 'Category' },
    { key: 'power', label: 'Power', numeric: true },
    { key: 'pp', label: 'PP', numeric: true },
    { key: 'accuracy', label: 'Accuracy', numeric: true },
    { key: 'priority', label: 'Priority', numeric: true },
    //{ key: 'introduced', label: 'Introduced' }
  ]

  const handleSort = (key) => {
    setSortConfig(prev => {
      const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      return { key, direction }
    })
  }

  const getSortValue = (move, key) => {
    switch (key) {
      case 'level':
        return move.level ?? null
      case 'tmNumber':
        return move.tmNumber ?? null
      case 'name':
        return move.name
      case 'type':
        return move.details?.type?.name
      case 'effect':
        return getMoveEffectEntry(move.details)
      case 'category':
        return move.details?.damage_class?.name
      case 'power':
        return move.details?.power
      case 'pp':
        return move.details?.pp
      case 'accuracy':
        return move.details?.accuracy
      case 'priority':
        return move.details?.priority
      //case 'introduced':
        //return move.details?.generation?.name
      default:
        return null
    }
  }

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
  }

  const sortedMoves = [...moves].sort((a, b) => {
    const valueA = getSortValue(a, sortConfig.key)
    const valueB = getSortValue(b, sortConfig.key)

    if (valueA == null && valueB == null) return 0
    if (valueA == null) return 1
    if (valueB == null) return -1

    let result = 0
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      result = valueA - valueB
    } else {
      result = String(valueA).localeCompare(String(valueB))
    }

    return sortConfig.direction === 'asc' ? result : -result
  })

  const renderCell = (move, key) => {
    switch (key) {
      case 'level':
        return move.level ?? 'N/A'
      case 'tmNumber':
        return move.tmLabel || (move.tmNumber ? String(move.tmNumber).padStart(2, '0') : 'N/A')
      case 'name':
        return formatMoveLabel(move.name)
      case 'type':
        return formatMoveLabel(move.details?.type?.name)
      case 'effect':
        return getMoveEffectEntry(move.details)
      case 'category':
        return formatMoveLabel(move.details?.damage_class?.name)
      case 'power':
        return move.details?.power ?? 'N/A'
      case 'pp':
        return move.details?.pp ?? 'N/A'
      case 'accuracy':
        return move.details?.accuracy ?? 'N/A'
      case 'priority':
        return move.details?.priority ?? 'N/A'
      case 'introduced':
        return formatMoveLabel(move.details?.generation?.name)
      default:
        return 'N/A'
    }
  }

  return (
    <div className="info-box">
      <div className="box-title">{title}</div>
      <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
        <table className="move-table" style={{ margin: '0' }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} className={column.numeric ? 'move-col-number' : undefined}>
                  <button type="button" onClick={() => handleSort(column.key)}>
                    {column.label}{getSortIndicator(column.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedMoves.map(move => (
              <tr key={showLevel ? `${move.name}-${move.level}` : showTmNumber ? `${move.name}-${move.tmNumber}` : move.name}>
                {columns.map(column => (
                  <td key={column.key} className={column.numeric ? 'move-col-number' : undefined}>
                    {renderCell(move, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PokemonCard({ pokemon, onEvolutionClick, initialForm }) {
  // UI state
  const [hoveredType, setHoveredType] = useState(null)
  const [versionInfo, setVersionInfo] = useState(null)

  // Data fetching hooks
  const { species, selectedVersion, setSelectedVersion, allEncounters } = usePokemonSpecies(pokemon)
  const { forms, selectedForm, setSelectedForm, formPokemon } = usePokemonForms({ species, pokemon, selectedVersion, initialForm })
  const abilityDescriptions = useAbilityDescriptions(formPokemon || pokemon)
  const evolutions = useEvolutionChain({ species, selectedVersion })
  const moves = useGroupedMoves(formPokemon || pokemon, selectedVersion)
  const versionSprite = useVersionSprite(formPokemon || pokemon, selectedVersion)

  // Derive display pokemon
  const displayPokemon = formPokemon || pokemon

  // Clear or restore form selection when pokemon changes
  useEffect(() => {
    setSelectedForm(initialForm || null)
  }, [pokemon?.id, initialForm, setSelectedForm])

  useEffect(() => {
    let active = true

    if (!selectedVersion) {
      setVersionInfo(null)
      return () => {
        active = false
      }
    }

    const loadVersionInfo = async () => {
      const info = await getVersionInfo(selectedVersion)
      if (active) setVersionInfo(info)
    }

    loadVersionInfo()

    return () => {
      active = false
    }
  }, [selectedVersion])

  const selectedGenerationRank = versionInfo?.generation
    ? generationOrder[versionInfo.generation]
    : null

  const showHiddenBadge = (isHidden) => {
    if (!isHidden) return false
    if (!selectedGenerationRank) return true
    return selectedGenerationRank >= generationOrder['generation-v']
  }

  const getGenerationAbilities = () => {
    // If no generation is selected, use current abilities
    if (!selectedGenerationRank) {
      return displayPokemon.abilities || []
    }

    // Check if there are past abilities
    const pastAbilities = displayPokemon.past_abilities || []
    if (pastAbilities.length === 0) {
      return displayPokemon.abilities || []
    }

    // Build a slot map from current abilities
    const slotMap = new Map()
    for (const ability of (displayPokemon.abilities || [])) {
      slotMap.set(ability.slot, ability)
    }

    // past_abilities entries contain only the slots that CHANGED, not full lists.
    // ability: null means that slot didn't exist in that era.
    // Apply all entries whose generation >= selected generation as overrides.
    for (const pastAbility of pastAbilities) {
      const pastGenRank = pastAbility.generation?.name
        ? generationOrder[pastAbility.generation.name]
        : null

      if (pastGenRank && pastGenRank >= selectedGenerationRank) {
        for (const entry of pastAbility.abilities) {
          if (entry.ability === null) {
            // Slot didn't exist in this era — remove it
            slotMap.delete(entry.slot)
          } else {
            // Slot had a different ability — override it
            slotMap.set(entry.slot, entry)
          }
        }
      }
    }

    return Array.from(slotMap.values()).sort((a, b) => a.slot - b.slot)
  }

  const generationAbilities = getGenerationAbilities()

  // Filter out hidden abilities pre-Gen 5, and all abilities pre-Gen 3 (abilities didn't exist before Gen 3)
  const filteredAbilities = generationAbilities.filter(ability => {
    if (selectedGenerationRank && selectedGenerationRank < generationOrder['generation-iii']) {
      return false
    }
    if (ability.is_hidden && selectedGenerationRank && selectedGenerationRank < generationOrder['generation-v']) {
      return false
    }
    return true
  })

  const getGenerationTypes = () => {
    // If no generation is selected, use current types
    if (!selectedGenerationRank) {
      return displayPokemon.types || []
    }

    // Check if there are past types
    const pastTypes = displayPokemon.past_types || []
    if (pastTypes.length === 0) {
      return displayPokemon.types || []
    }

    // Find the most recent past_types entry that applies to selected generation or earlier
    // past_types are ordered with most recent first, so we iterate to find the first one
    // where the generation change happened AFTER our selected generation
    let applicableTypes = displayPokemon.types || []
    
    for (const pastType of pastTypes) {
      const pastGenRank = pastType.generation?.name
        ? generationOrder[pastType.generation.name]
        : null
      
      // If the type change happened in a generation after our selected one,
      // we should use the past types
      if (pastGenRank && pastGenRank >= selectedGenerationRank) {
        applicableTypes = pastType.types
      } else {
        // Once we hit a generation at or before our selection, stop
        break
      }
    }

    return applicableTypes
  }

  function getGenerationStats() {
    if (!selectedGenerationRank || !displayPokemon) {
      return displayPokemon?.stats || []
    }

    const pastStats = displayPokemon.past_stats || []
    if (pastStats.length === 0) {
      return displayPokemon.stats || []
    }

    // Build a map from current stats: statName -> stat object
    const statMap = new Map()
    for (const stat of (displayPokemon.stats || [])) {
      statMap.set(stat.stat.name, { ...stat })
    }

    // Collect applicable past_stats entries (pastGenRank >= selectedGenerationRank)
    // Then apply from highest gen to lowest gen so the oldest applicable entry wins
    const applicableEntries = pastStats.filter(pastStat => {
      const pastGenRank = pastStat.generation?.name
        ? generationOrder[pastStat.generation.name]
        : null
      return pastGenRank && pastGenRank >= selectedGenerationRank
    })

    // Reverse so lowest-gen (most specific to selected era) overrides last
    const reversed = [...applicableEntries].reverse()
    let hasSpecialStat = false

    for (const entry of reversed) {
      for (const pastStatEntry of entry.stats) {
        const statName = pastStatEntry.stat.name
        if (statName === 'special') {
          hasSpecialStat = true
        }
        statMap.set(statName, { ...pastStatEntry })
      }
    }

    // If we have the Gen 1 "special" stat, remove special-attack and special-defense
    if (hasSpecialStat) {
      statMap.delete('special-attack')
      statMap.delete('special-defense')
    }

    // Return in a sensible order: hp, attack, defense, special (if gen1), special-attack, special-defense, speed
    const statOrder = ['hp', 'attack', 'defense', 'special', 'special-attack', 'special-defense', 'speed']
    const result = []
    for (const name of statOrder) {
      if (statMap.has(name)) {
        result.push(statMap.get(name))
      }
    }
    // Include any stats not in our predefined order
    for (const [name, stat] of statMap) {
      if (!statOrder.includes(name)) {
        result.push(stat)
      }
    }

    return result
  }

  const generationTypes = getGenerationTypes()
  const generationStats = getGenerationStats()

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
    normal: { resists: [], weak: ['fighting'], immune: ['ghost'], veryWeak: [] },
    fire: { resists: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], weak: ['water', 'ground', 'rock'], immune: [], veryWeak: [] },
    water: { resists: ['fire', 'water', 'ice', 'steel'], weak: ['electric', 'grass'], immune: [], veryWeak: [] },
    electric: { resists: ['flying', 'steel'], weak: ['ground'], immune: [], veryWeak: [] },
    grass: { resists: ['ground', 'water', 'grass'], weak: ['fire', 'ice', 'poison', 'flying', 'bug'], immune: [], veryWeak: [] },
    ice: { resists: ['ice'], weak: ['fire', 'fighting', 'rock', 'steel'], immune: [], veryWeak: [] },
    fighting: { resists: ['rock', 'bug', 'dark'], weak: ['flying', 'psychic', 'fairy'], immune: [], veryWeak: [] },
    poison: { resists: ['fighting', 'poison', 'bug', 'grass'], weak: ['ground', 'psychic'], immune: [], veryWeak: [] },
    ground: { resists: ['poison', 'rock'], weak: ['water', 'grass', 'ice'], immune: ['electric'], veryWeak: [] },
    flying: { resists: ['fighting', 'bug', 'grass'], weak: ['electric', 'ice', 'rock'], immune: ['ground'], veryWeak: [] },
    psychic: { resists: ['fighting', 'psychic'], weak: ['bug', 'ghost', 'dark'], immune: [], veryWeak: [] },
    bug: { resists: ['fighting', 'ground', 'grass'], weak: ['fire', 'flying', 'rock'], immune: [], veryWeak: [] },
    rock: { resists: ['normal', 'flying', 'poison', 'fire'], weak: ['water', 'grass', 'fighting', 'ground', 'steel'], immune: [], veryWeak: [] },
    ghost: { resists: ['poison', 'bug'], weak: ['ghost', 'dark'], immune: ['normal', 'fighting'], veryWeak: [] },
    dragon: { resists: ['fire', 'water', 'grass', 'electric'], weak: ['ice', 'dragon', 'fairy'], immune: [], veryWeak: [] },
    dark: { resists: ['ghost', 'dark'], weak: ['fighting', 'bug', 'fairy'], immune: ['psychic'], veryWeak: [] },
    steel: { resists: ['normal', 'flying', 'rock', 'bug', 'steel', 'grass', 'psychic', 'ice', 'dragon', 'fairy'], weak: ['fire', 'water', 'ground'], immune: ['poison'], veryWeak: [] },
    fairy: { resists: ['fighting', 'bug', 'dark'], weak: ['poison', 'steel'], immune: ['dragon'], veryWeak: [] }
  }

  const getCombinedTypeMatchups = () => {
    const types = generationTypes?.map(t => t.type.name) || []
    if (types.length === 0) return null

    let resists = new Set()
    let weak = new Set()
    let veryWeak = new Set()
    let veryResistant = new Set()
    let immune = new Set()

    types.forEach(type => {
      const matchup = typeEffectiveness[type]
      if (matchup) {
        matchup.resists?.forEach(t => resists.add(t))
        matchup.weak?.forEach(t => weak.add(t))
        matchup.veryWeak?.forEach(t => veryWeak.add(t))
        matchup.immune?.forEach(t => immune.add(t))
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

      // Calculate very resistant for dual types: types that BOTH component types resist
      const type1Resists = new Set(typeEffectiveness[types[0]]?.resists || [])
      const type2Resists = new Set(typeEffectiveness[types[1]]?.resists || [])
      const resistIntersection = new Set([...type1Resists].filter(t => type2Resists.has(t)))
      resistIntersection.forEach(t => veryResistant.add(t))
      // Remove very resistant from regular resists
      resistIntersection.forEach(t => resists.delete(t))
    }

    // Remove overlaps: if a type resists and is weak, it cancels out
    weak.forEach(t => resists.delete(t))
    veryWeak.forEach(t => resists.delete(t))
    veryWeak.forEach(t => weak.delete(t))
    weak.forEach(t => veryResistant.delete(t))
    veryWeak.forEach(t => veryResistant.delete(t))
    immune.forEach(t => {
      resists.delete(t)
      weak.delete(t)
      veryWeak.delete(t)
      veryResistant.delete(t)
    })

    return {
      immune: Array.from(immune),
      veryResistant: Array.from(veryResistant),
      resists: Array.from(resists),
      weak: Array.from(weak),
      veryWeak: Array.from(veryWeak)
    }
  }

  if (!pokemon) {
    return <div className="loading">Loading Pokemon data...</div>
  }

  const englishEntries = species?.flavor_text_entries?.filter(entry => entry.language?.name === 'en') || []
  const versionEntries = selectedVersion
    ? englishEntries.filter(entry => entry.version?.name === selectedVersion)
    : englishEntries
  const displayedEntries = selectedVersion ? versionEntries : versionEntries.slice(0, 3)
  const nationalDexNumber = species?.pokedex_numbers?.find(entry => entry.pokedex?.name === 'national')?.entry_number

  return (
    <div className="pokemon-card-container">
      {/* Version Selector */}
      <div className="version-selector-wrapper">
        <VersionSelector
          pokemon={pokemon}
          selectedVersion={selectedVersion}
          onVersionChange={setSelectedVersion}
          allEncounters={allEncounters}
        />
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
              <span className="value">{nationalDexNumber || 'Unknown'}</span>
            </div>
            <div className="info-row" style={{ position: 'relative' }}>
              <span className="label">Type:</span>
              <div className="types-inline">
                {generationTypes?.map(type => (
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
                          position: 'absolute',
                          zIndex: 10000,
                          backgroundColor: '#222',
                          border: '2px solid #555',
                          borderRadius: '6px',
                          padding: '12px',
                          minWidth: '280px',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginBottom: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: '#aaa', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Immune to:</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getCombinedTypeMatchups().immune.length > 0 ? (
                                getCombinedTypeMatchups().immune.map(t => (
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
                            <div style={{ color: '#aaa', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Very Resistant to:</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getCombinedTypeMatchups().veryResistant.length > 0 ? (
                                getCombinedTypeMatchups().veryResistant.map(t => (
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
            <div className="info-row">
              <span className="label">Height:</span>
              <span className="value">{displayPokemon.height ? (displayPokemon.height / 10).toFixed(1) + ' m' : 'N/A'}</span>
            </div>
            <div className="info-row">
              <span className="label">Weight:</span>
              <span className="value">{displayPokemon.weight ? (displayPokemon.weight / 10).toFixed(1) + ' kg' : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Abilities Box */}
        <div className="info-box">
          <div className="box-title">Abilities</div>
          <div className="box-content abilities-list">
            {filteredAbilities.length > 0 ? (
              filteredAbilities.map((ability, idx) => (
                <div key={idx} className="ability-item">
                  <span className="tooltip-trigger">
                    {ability.ability.name}
                    {abilityDescriptions[ability.ability.name]?.description && (
                      <span className="tooltip-text">{abilityDescriptions[ability.ability.name].description}</span>
                    )}
                  </span>
                  {showHiddenBadge(ability.is_hidden) && <span className="hidden-badge">Hidden</span>}
                </div>
              ))
            ) : (
              <p style={{ margin: '0', color: '#888', fontSize: '12px' }}>No abilities in this version.</p>
            )}
          </div>
        </div>

        {/* Stats Box */}
        <div className="info-box">
          <div className="box-title">Base Stats</div>
          <div className="box-content stats-compact">
            {generationStats.map(stat => {
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
          <div className="box-content evolution-box-content" style={{ display: 'flex', justifyContent: 'center' }}>
            {evolutions.length > 0 ? (
              renderEvolutionForest(evolutions, pokemon.name, onEvolutionClick)
            ) : (
              <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>No evolution available.</p>
            )}
          </div>
        </div>

        {/* Locations Box */}
        <div className="info-box">
          <div className="box-title">Location</div>
          <div className="box-content" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {selectedVersion && allEncounters.length > 0 ? (
              (() => {
                // Build encounter data grouped by location and method
                const encountersByLocation = {}
                allEncounters.forEach(enc => {
                  const versionDetail = enc.version_details?.find(vd => vd.version.name === selectedVersion)
                  if (versionDetail && versionDetail.encounter_details?.length > 0) {
                    const locationName = enc.location_area.name
                    if (!encountersByLocation[locationName]) {
                      encountersByLocation[locationName] = {}
                    }
                    versionDetail.encounter_details.forEach(detail => {
                      const methodName = detail.method?.name || 'unknown'
                      if (!encountersByLocation[locationName][methodName]) {
                        encountersByLocation[locationName][methodName] = 0
                      }
                      encountersByLocation[locationName][methodName] += detail.chance || 0
                    })
                  }
                })
                
                const hasEncounters = Object.keys(encountersByLocation).length > 0
                return hasEncounters ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Location</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Method</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(encountersByLocation).map(([location, methods]) =>
                        Object.entries(methods).map(([method, rate], idx) => (
                          <tr key={`${location}-${method}`} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '6px 8px' }}>
                              {idx === 0 ? location.replace(/-/g, ' ') : ''}
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              {method.replace(/-/g, ' ').charAt(0).toUpperCase() + method.replace(/-/g, ' ').slice(1)}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {rate}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
          <div className="box-title">Encounter Info</div>
          <div className="box-content" style={{ fontSize: '12px' }}>
            <div><strong>Capture Rate:</strong> {species?.capture_rate || 'N/A'}</div>
            <div><strong>Wild Held Item:</strong> {species?.held_items?.length > 0 ? species.held_items.map(item => item.item.name).join(', ') : 'None'}</div>
            <div><strong>EV Yield:</strong> {displayPokemon.stats?.some(s => s.effort > 0) ? (
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
                <span style={{ margin: '0' }}>None</span>
              )}</div>
          </div>
        </div>
      </div>

      {/* Moves Flex Container */}
      {(moves.levelUp.length > 0 || moves.tm.length > 0 || moves.tutor.length > 0 || moves.event.length > 0 || moves.egg.length > 0) && (
        <div className="container-flex">
          {moves.levelUp.length > 0 && (
            <MoveTable title="Level Up Moves" moves={moves.levelUp} showLevel />
          )}

          {moves.tm.length > 0 && (
            <MoveTable title="TMs" moves={moves.tm} showTmNumber />
          )}

          {moves.tutor.length > 0 && (
            <MoveTable title="Tutor" moves={moves.tutor} />
          )}

          {moves.event.length > 0 && (
            <div className="info-box">
              <div className="box-title">Event</div>
              <div className="box-content" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ padding: '0 20px', margin: '0' }}>
                  {moves.event.map(move => (
                    <li key={move.name}>{formatMoveLabel(move.name)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {moves.egg.length > 0 && (
            <MoveTable title="Egg" moves={moves.egg} />
          )}
        </div>
      )}

      {/* Egg Groups, Hatch Steps, Gender, EV Yield Grid */}
      {species && (
        <div className="grid-3">
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
        </div>
      )}

      {/* Stats Calculator Section */}
      <div className="info-box full-width" style={{ marginTop: '10px' }}>
        <div className="box-title">Stats Calculator</div>
        <div className="box-content">
          <StatsCalculator pokemon={displayPokemon} stats={generationStats} selectedVersion={selectedVersion} />
        </div>
      </div>

      {/* Pokedex Entries Grid */}
      {displayedEntries.length > 0 && (
        <div className="grid-3">
          {displayedEntries.map((entry, idx) => (
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