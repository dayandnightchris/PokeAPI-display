import React, { useState, useEffect, useRef } from 'react'
import StatsCalculator from './StatsCalculator'
import VersionSelector from './VersionSelector'
import { renderEvolutionForest } from './EvolutionTree'
import { getVersionInfo, generationOrder, generationVersions, versionGeneration, versionDisplayNames } from '../utils/versionInfo'
import {
  usePokemonSpecies,
  useAbilityDescriptions,
  usePokemonForms,
  useEvolutionChain,
  useGroupedMoves,
  useVersionSprite,
  usePreEvolutionCheck
} from '../hooks'

function CollapsibleInfoBox({ title, children, className = '', style, contentClassName = '', contentStyle }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasMaxHeight = contentStyle && contentStyle.maxHeight != null

  const effectiveContentStyle = expanded && hasMaxHeight
    ? { ...contentStyle, maxHeight: 'none', overflowY: 'visible' }
    : contentStyle

  return (
    <div className={`info-box ${className}`} style={style}>
      <div className="box-title collapsible-title">
        <span>{title}</span>
        <div className="collapsible-title-buttons">
          {hasMaxHeight && !collapsed && (
            <button
              type="button"
              className="expand-toggle"
              onClick={() => setExpanded(prev => !prev)}
              title={expanded ? 'Collapse to scrollable view' : 'Expand to show all rows'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? (
                  <>
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </>
                ) : (
                  <>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`collapse-toggle-icon${collapsed ? ' collapse-toggle-flipped' : ''}`} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#333" strokeWidth="4" />
              <path d="M2,50 A48,48 0 0,1 98,50 Z" fill="#ff0000" stroke="#333" strokeWidth="4" />
              <path d="M2,50 A48,48 0 0,0 98,50 Z" fill="#fff" stroke="#333" strokeWidth="4" />
              <rect x="2" y="47" width="96" height="6" fill="#333" />
              <circle cx="50" cy="50" r="12" fill="#fff" stroke="#333" strokeWidth="4" />
              <circle cx="50" cy="50" r="5" fill="#333" />
            </svg>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={`box-content ${contentClassName}`} style={effectiveContentStyle}>
          {children}
        </div>
      )}
    </div>
  )
}

function formatLocationName(name) {
  // Remove trailing -area or -area-123, then replace dashes with spaces
  return name
    .replace(/-area-\d+$/, '')
    .replace(/-area$/, '')
    .replace(/-/g, ' ')
    .trim();
}
const formatMoveLabel = (value) => {
  if (!value) return 'N/A'
  if (value === 'unknown') return '???'
  return value.replace(/-/g, ' ')
}

// Type color map (module-level so MoveTable and PokemonCard can both use it)
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
  fairy: '#EE99AC',
  unknown: '#4D7A70'
}

const getTypeColor = (typeName) => typeColors[typeName?.toLowerCase()] || '#999'

// Returns dark or white text based on background luminance for readability
const getTypeTextColor = (typeName) => {
  const hex = getTypeColor(typeName)
  const r = parseInt(hex.slice(1,3), 16) / 255
  const g = parseInt(hex.slice(3,5), 16) / 255
  const b = parseInt(hex.slice(5,7), 16) / 255
  const lum = 0.2126 * (r <= 0.03928 ? r/12.92 : ((r+0.055)/1.055)**2.4)
            + 0.7152 * (g <= 0.03928 ? g/12.92 : ((g+0.055)/1.055)**2.4)
            + 0.0722 * (b <= 0.03928 ? b/12.92 : ((b+0.055)/1.055)**2.4)
  return lum > 0.35 ? '#333' : '#fff'
}

// Darken a hex color by a factor (0 = black, 1 = original) for readable text on light backgrounds
const darkenColor = (hex, factor = 0.65) => {
  const r = Math.round(parseInt(hex.slice(1,3), 16) * factor)
  const g = Math.round(parseInt(hex.slice(3,5), 16) * factor)
  const b = Math.round(parseInt(hex.slice(5,7), 16) * factor)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

const getMoveEffectEntry = (details) => {
  if (!details) return 'N/A'
  const entry = (details.effect_entries || []).find(e => e.language?.name === 'en')
  if (!entry) return 'N/A'
  const baseText = entry.short_effect || entry.effect || 'N/A'
  if (details.effect_chance == null) return baseText
  return baseText.replaceAll('$effect_chance', details.effect_chance)
}

// In Gens 1-3 move category was determined by type, not per-move
const physicalTypes = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])
const specialTypes = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'])

function getMoveCategoryForGen(move, generationNum) {
  // Gens 1-3: category is based on type, not the move's own damage_class
  if (generationNum && generationNum <= 3) {
    const typeName = move.details?.type?.name
    if (!typeName) return move.details?.damage_class?.name || null
    // Status moves remain status regardless of generation
    if (move.details?.damage_class?.name === 'status') return 'status'
    if (physicalTypes.has(typeName)) return 'physical'
    if (specialTypes.has(typeName)) return 'special'
  }
  return move.details?.damage_class?.name || null
}

function MoveTable({ title, moves, showLevel, showTmNumber, showMethod, loading, onMoveClick, compact, generationNum }) {
  const [sortConfig, setSortConfig] = useState({
    key: showLevel ? 'level' : showTmNumber ? 'tmNumber' : 'name',
    direction: 'asc'
  })

  const hasSourceGames = moves.some(m => m.sourceGames)

  const methodDisplayNames = {
    'light-ball-egg': 'Light Ball Egg',
    'colosseum-purification': 'Colosseum Purification',
    'xd-purification': 'XD Purification',
    'stadium-surfing-pikachu': 'Stadium',
    'form-change': 'Form Change',
    'zygarde-cube': 'Zygarde Cube',
  }

  const allColumns = [
    ...(showLevel ? [{ key: 'level', label: compact ? 'Lv' : 'Level', numeric: true }] : []),
    ...(showTmNumber ? [{ key: 'tmNumber', label: 'TM#', numeric: true }] : []),
    ...(showMethod ? [{ key: 'learnMethod', label: compact ? 'Mthd' : 'Method' }] : []),
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'effect', label: 'Effect Entry' },
    { key: 'category', label: compact ? 'Cat' : 'Category' },
    { key: 'power', label: compact ? 'Pow' : 'Power', numeric: true },
    { key: 'pp', label: 'PP', numeric: true },
    { key: 'accuracy', label: compact ? 'Acc' : 'Accuracy', numeric: true },
    { key: 'priority', label: compact ? 'Pri' : 'Priority', numeric: true },
    ...(hasSourceGames ? [{ key: 'sourceGames', label: 'Game' }] : []),
  ]

  // In compact mode, effect becomes a sub-row instead of a column
  const columns = compact ? allColumns.filter(c => c.key !== 'effect') : allColumns

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
        return getMoveCategoryForGen(move, generationNum)
      case 'power':
        return move.details?.power
      case 'pp':
        return move.details?.pp
      case 'accuracy':
        return move.details?.accuracy
      case 'priority':
        return move.details?.priority
      case 'sourceGames':
        return move.sourceGames ?? ''
      case 'learnMethod':
        return move.learnMethod ?? ''
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
        const nameEl = onMoveClick
          ? <button type="button" className="move-name-link" onClick={() => onMoveClick(move.name)}>{formatMoveLabel(move.name)}</button>
          : formatMoveLabel(move.name)
        return move.inheritedFrom
          ? <>{nameEl} <span style={{ fontSize: '10px', color: '#888' }}>({formatMoveLabel(move.inheritedFrom)})</span></>
          : nameEl
      case 'type': {
        const typeName = move.details?.type?.name
        if (!typeName) return 'N/A'
        const bg = getTypeColor(typeName)
        const fg = getTypeTextColor(typeName)
        return (
          <span className="move-type-badge" style={{
            backgroundColor: bg,
            color: fg,
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: 'inherit',
            fontWeight: 600,
            textTransform: 'capitalize',
            whiteSpace: 'nowrap',
            opacity: 0.85,
            display: 'inline-block',
            textAlign: 'center',
            width: '62px',
            overflow: 'hidden'
          }}>
            {formatMoveLabel(typeName)}
          </span>
        )
      }
      case 'effect':
        return getMoveEffectEntry(move.details)
      case 'category':
        return formatMoveLabel(getMoveCategoryForGen(move, generationNum))
      case 'power':
        return move.details?.power ?? 'N/A'
      case 'pp':
        return move.details?.pp ?? 'N/A'
      case 'accuracy':
        return move.details?.accuracy ?? 'N/A'
      case 'priority':
        return move.details?.priority ?? 'N/A'
      case 'sourceGames': {
        const src = move.sourceGames
        if (!src) return 'N/A'
        if (typeof src !== 'string') return src
        const parts = src.split(', ')
        if (parts.length <= 3) return src
        return (
          <span title={src} style={{ cursor: 'help' }}>
            {parts.slice(0, 3).join(', ')} <span style={{ fontSize: '10px', color: '#888' }}>+{parts.length - 3} more</span>
          </span>
        )
      }
      case 'learnMethod':
        return methodDisplayNames[move.learnMethod] || formatMoveLabel(move.learnMethod) || 'N/A'
      case 'introduced':
        return formatMoveLabel(move.details?.generation?.name)
      default:
        return 'N/A'
    }
  }

  return (
    <CollapsibleInfoBox title={title} contentStyle={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
      {loading ? (
        <div className="move-loading">
          <video src="/simple_pokeball.webm" autoPlay loop muted className="move-loading-gif" />
        </div>
      ) : (
      <table className={`move-table${compact ? ' move-table-compact' : ''}`} style={{ margin: '0', ...(compact ? {} : { tableLayout: 'fixed' }) }}>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''}`}>
                <button type="button" onClick={() => handleSort(column.key)}>
                  {column.label}{getSortIndicator(column.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedMoves.map(move => {
            const rowKey = showLevel ? `${move.name}-${move.level}` : showTmNumber ? `${move.name}-${move.tmNumber}` : move.name
            if (compact) {
              // Serebii-style: level/tm + name span both rows; effect sits under the remaining columns
              const spanKeys = new Set(['level', 'tmNumber', 'learnMethod', 'name'])
              const spanCols = columns.filter(c => spanKeys.has(c.key))
              const restCols = columns.filter(c => !spanKeys.has(c.key))
              return (
                <React.Fragment key={rowKey}>
                  <tr>
                    {spanCols.map(column => (
                      <td key={column.key} rowSpan={2} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''} move-span-cell`}>
                        {renderCell(move, column.key)}
                      </td>
                    ))}
                    {restCols.map(column => (
                      <td key={column.key} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''}`}>
                        {renderCell(move, column.key)}
                      </td>
                    ))}
                  </tr>
                  <tr className="move-effect-subrow">
                    <td colSpan={restCols.length} className="move-effect-subrow-cell">
                      {getMoveEffectEntry(move.details)}
                    </td>
                  </tr>
                </React.Fragment>
              )
            }
            return (
              <tr key={rowKey}>
                {columns.map(column => (
                  <td key={column.key} className={`move-col-${column.key}${column.numeric ? ' move-col-number' : ''}`}>
                    {renderCell(move, column.key)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      )}
    </CollapsibleInfoBox>
  )
}

export default function PokemonCard({ pokemon, onEvolutionClick, onMoveClick, onAbilityClick, onItemClick, onLocationClick, initialForm, initialVersion, onStateChange }) {
  // UI state
  const [hoveredType, setHoveredType] = useState(null)
  const [versionInfo, setVersionInfo] = useState(null)

  // Refs for scroll navigation
  const cardTopRef = useRef(null)
  const statsCalcRef = useRef(null)

  // Data fetching hooks
  const { species, selectedVersion, setSelectedVersion, allEncounters, availableVersions, pokedexVersions } = usePokemonSpecies(pokemon, initialVersion)
  const { forms, selectedForm, setSelectedForm, formPokemon, formSuggestedVersion, formVersionFilter } = usePokemonForms({ species, pokemon, selectedVersion, initialForm })
  const abilityDescriptionsBase = useAbilityDescriptions(formPokemon || pokemon)
  const [extraAbilityDescs, setExtraAbilityDescs] = useState({})
  const evolutions = useEvolutionChain({ species, selectedVersion, selectedForm })
  const { canEvolveFrom, canTradeAndEvolveFrom } = usePreEvolutionCheck({ species, selectedVersion })
  // For forms with empty moves (e.g. PLZA megas), fall back to base pokemon's moves
  const movesSource = (formPokemon && formPokemon.moves?.length > 0) ? formPokemon : pokemon
  const { moves, loading: movesLoading } = useGroupedMoves(movesSource, selectedVersion, species)
  const { versionSprite, versionShinySprite, versionFemaleSprite, versionAnimSprite, versionAnimShiny, versionAnimFemale } = useVersionSprite(formPokemon || pokemon, selectedVersion)

  // Sprite mode: 0 = normal, 1 = shiny, 2 = female
  const [spriteMode, setSpriteMode] = useState(0)

  // Mobile move tab state
  const [activeMoveTab, setActiveMoveTab] = useState(0)

  // Collapsible location rows
  const [expandedLocations, setExpandedLocations] = useState({})

  // Derive display pokemon
  const displayPokemon = formPokemon || pokemon

  // Fetch description for hardcoded exception abilities not in the API data
  const isBasculinBW = displayPokemon?.name === 'basculin-blue-striped' && ['black', 'white'].includes(selectedVersion)
  useEffect(() => {
    if (!isBasculinBW) {
      setExtraAbilityDescs({})
      return
    }
    let active = true
    fetch('https://pokeapi.co/api/v2/ability/120/')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const desc = data.effect_entries?.find(e => e.language.name === 'en')?.effect || 'No description available.'
        setExtraAbilityDescs({ reckless: { description: desc, generation: data.generation?.name || null } })
      })
      .catch(() => {
        if (active) setExtraAbilityDescs({ reckless: { description: 'No description available.', generation: null } })
      })
    return () => { active = false }
  }, [isBasculinBW])

  const abilityDescriptions = { ...abilityDescriptionsBase, ...extraAbilityDescs }

  // When a searched form requires a specific version (e.g. PLZA megas → legends-za),
  // switch to that version automatically
  useEffect(() => {
    if (formSuggestedVersion && formSuggestedVersion !== selectedVersion) {
      setSelectedVersion(formSuggestedVersion)
    }
  }, [formSuggestedVersion, selectedVersion, setSelectedVersion])

  // Report version/form changes to parent for URL sync
  useEffect(() => {
    if (onStateChange && selectedVersion) {
      onStateChange({ version: selectedVersion })
    }
  }, [selectedVersion, onStateChange])

  useEffect(() => {
    if (onStateChange && selectedForm) {
      onStateChange({ form: selectedForm })
    }
  }, [selectedForm, onStateChange])

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

  // Hardcoded exception: Blue-Striped Basculin had Reckless in BW, changed to Rock Head in B2W2.
  // The API only has Rock Head. In BW, both abilities are valid (Reckless natively, Rock Head via trade).
  if (displayPokemon.name === 'basculin-blue-striped' && ['black', 'white'].includes(selectedVersion)) {
    const hasReckless = generationAbilities.some(a => a.ability?.name === 'reckless')
    if (!hasReckless) {
      generationAbilities.unshift({
        ability: { name: 'reckless', url: 'https://pokeapi.co/api/v2/ability/120/' },
        is_hidden: false,
        slot: 1
      })
    }
  }

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
    return <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball" /></div>
  }

  const englishEntries = species?.flavor_text_entries?.filter(entry => entry.language?.name === 'en') || []
  const versionEntries = selectedVersion
    ? englishEntries.filter(entry => entry.version?.name === selectedVersion)
    : englishEntries
  const displayedEntries = selectedVersion ? versionEntries : versionEntries.slice(0, 3)
  const nationalDexNumber = species?.pokedex_numbers?.find(entry => entry.pokedex?.name === 'national')?.entry_number

  return (
    <div className="pokemon-card-container" ref={cardTopRef}>
      {/* Version Selector */}
      <div className="version-selector-wrapper">
        <VersionSelector
          pokemon={displayPokemon}
          selectedVersion={selectedVersion}
          onVersionChange={setSelectedVersion}
          allEncounters={formPokemon ? [] : allEncounters}
          pokedexVersions={formPokemon ? null : pokedexVersions}
          formVersionFilter={formVersionFilter}
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

      <div className="main-info-grid">
        {/* Image + Breeding Info Stack */}
        <div className="image-breeding-stack">
          <div className="info-box image-box">
            {(() => {
              const currentGen = selectedVersion ? versionGeneration[selectedVersion] : null
              const isGen1 = currentGen === 1
              const hasFemaleSprites = !currentGen || currentGen >= 4
              // Use API animated sprites (Gen 5 BW) when available, prefer over static
              const normalSrc = versionAnimSprite || versionSprite || displayPokemon?.sprites?.other?.['official-artwork']?.front_default || displayPokemon?.sprites?.front_default
              const shinySrc = isGen1 ? null : (versionAnimShiny || versionShinySprite || displayPokemon?.sprites?.other?.['official-artwork']?.front_shiny || displayPokemon?.sprites?.front_shiny)
              const femaleSrc = hasFemaleSprites ? (versionAnimFemale || versionFemaleSprite || displayPokemon?.sprites?.front_female || null) : null

              // Build available modes
              const modes = [{ key: 'normal', src: normalSrc, label: '' }]
              if (shinySrc) modes.push({ key: 'shiny', src: shinySrc, label: '✨ Shiny' })
              if (femaleSrc) modes.push({ key: 'female', src: femaleSrc, label: 'Female' })

              const safeMode = spriteMode % modes.length
              const current = modes[safeMode]
              const canCycle = modes.length > 1
              const nextLabel = modes[(safeMode + 1) % modes.length]?.key

              return (
                <>
                  {current.src && (
                    <img
                      src={current.src}
                      alt={`${displayPokemon.name}${current.label ? ` (${current.label})` : ''}`}
                      className="pokemon-main-image"
                      onClick={() => canCycle && setSpriteMode(prev => prev + 1)}
                      style={{ cursor: canCycle ? 'pointer' : 'default' }}
                      title={canCycle ? `Click for ${nextLabel}` : ''}
                    />
                  )}
                  {current.label && <span className="shiny-badge">{current.label}</span>}
                  {femaleSrc && <span className="gender-badge" title="Male / Female available. Click sprite to cycle">⚥</span>}
                </>
              )
            })()}
          </div>

          {/* Breeding Info Box */}
          {species && (!selectedGenerationRank || selectedGenerationRank >= 2) && (
            <div className="info-box breeding-info-box">
              <div className="box-title">Breeding Info</div>
              <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
                <div className="info-row">
                  <span className="label">Egg Groups:</span>
                  <span className="value">
                    {species.egg_groups?.length > 0
                      ? species.egg_groups.map(g => g.name).join(', ')
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
          )}
        </div>

        {/* Species Info Box */}
        <div className="info-box species-box">
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
                      color: getTypeTextColor(type.type.name),
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
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t), padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
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
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t), padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
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
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t), padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
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
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t), padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
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
                                  <span key={t} style={{ backgroundColor: getTypeColor(t), color: getTypeTextColor(t), padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
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
        <div className="info-box abilities-box">
          <div className="box-title">Abilities</div>
          <div className="box-content abilities-list">
            {filteredAbilities.length > 0 ? (
              filteredAbilities.map((ability, idx) => (
                <div key={idx} className="ability-item">
                  <span className="tooltip-trigger">
                    {onAbilityClick
                      ? <button type="button" className="ability-name-link" onClick={() => onAbilityClick(ability.ability.name)}>{ability.ability.name}</button>
                      : ability.ability.name
                    }
                    {abilityDescriptions[ability.ability.name]?.description && (
                      <span className="tooltip-text">{abilityDescriptions[ability.ability.name].description}</span>
                    )}
                  </span>
                  {showHiddenBadge(ability.is_hidden) && <span className="hidden-badge">Hidden</span>}
                </div>
              ))
            ) : (
              <p style={{ margin: '0', color: 'var(--text-muted, #888)', fontSize: '12px' }}>No abilities in this version.</p>
            )}
          </div>
        </div>

        {/* Encounter Info + Location stacked in column 4, spanning both rows */}
        <div className="encounter-location-stack">
          <div className="info-box encounter-info-box">
            <div className="box-title">Encounter Info</div>
            <div className="box-content" style={{ fontSize: '12px' }}>
              <div><strong>Capture Rate:</strong> {species?.capture_rate || 'N/A'}</div>
              <div><strong>Wild Held Item:</strong> {(() => {
                if (!displayPokemon?.held_items?.length) return 'None'
                // Filter held items to the selected version
                const items = displayPokemon.held_items
                  .map(hi => {
                    const vd = selectedVersion
                      ? hi.version_details?.find(v => v.version?.name === selectedVersion)
                      : hi.version_details?.[0]
                    if (!vd) return null
                    return { name: hi.item.name, displayName: hi.item.name.replace(/-/g, ' '), rarity: vd.rarity }
                  })
                  .filter(Boolean)
                if (items.length === 0) return 'None'
                return (
                  <ul style={{ padding: '0 20px', margin: '0' }}>
                    {items.map(item => (
                      <li key={item.name}>
                        {onItemClick
                          ? <button type="button" className="item-name-link" onClick={() => onItemClick(item.name)}>{item.displayName}</button>
                          : item.displayName
                        } ({item.rarity}%)
                      </li>
                    ))}
                  </ul>
                )
              })()}</div>
              <div><strong>EV Yield:</strong> {(!selectedGenerationRank || selectedGenerationRank >= 3) && generationStats?.some(s => s.effort > 0) ? (
                  <ul style={{ padding: '0 20px', margin: '0' }}>
                    {generationStats.map(stat => (
                      stat.effort > 0 && (
                        <li key={stat.stat.name}>
                          {stat.stat.name}: {stat.effort}
                        </li>
                      )
                    ))}
                  </ul>
                ) : selectedGenerationRank && selectedGenerationRank < 3 ? (
                  <span style={{ margin: '0', color: 'var(--text-muted, #888)' }}>N/A (Stat Exp. system)</span>
                ) : (
                  <span style={{ margin: '0' }}>None</span>
                )}</div>
            </div>
          </div>

          <div className="info-box location-box">
            <div className="box-title">Location</div>
            <div className="box-content" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {selectedVersion && allEncounters.length > 0 ? (
                (() => {
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
                        const conditions = (detail.condition_values || []).map(cv => cv.name).sort()
                        const key = methodName + '|' + conditions.join(',')
                        if (!encountersByLocation[locationName][key]) {
                          encountersByLocation[locationName][key] = { method: methodName, rate: 0, conditions }
                        }
                        encountersByLocation[locationName][key].rate += detail.chance || 0
                      })
                    }
                  })
                  
                  const hasEncounters = Object.keys(encountersByLocation).length > 0
                  if (hasEncounters) {
                    const toggleLocation = (loc) => {
                      setExpandedLocations(prev => ({ ...prev, [loc]: !prev[loc] }))
                    }
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Location</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Method</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(encountersByLocation).map(([location, entries]) => {
                            const entryList = Object.values(entries)
                            const hasMultiple = entryList.length > 1
                            const hasConditions = entryList.some(e => e.conditions.length > 0)
                            const isCollapsible = hasMultiple || hasConditions
                            const isExpanded = !!expandedLocations[location]
                            const locationDisplay = location.replace(/-/g, ' ').replace(/ area$/i, '')

                            if (!isCollapsible) {
                              // Single entry, no conditions — flat row
                              const entry = entryList[0]
                              const methodDisplay = entry.method.replace(/-/g, ' ')
                              return (
                                <tr key={location} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '6px 8px' }}>
                                    {onLocationClick
                                      ? <button type="button" className="pokemon-name-link" onClick={() => onLocationClick(location)}>{formatLocationName(location)}</button>
                                      : locationDisplay
                                    }
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {methodDisplay.charAt(0).toUpperCase() + methodDisplay.slice(1)}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{entry.rate}%</td>
                                </tr>
                              )
                            }

                            // Collapsible location
                            const rows = []
                            rows.push(
                              <tr
                                key={location}
                                className="location-header-row"
                                style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                                onClick={() => toggleLocation(location)}
                              >
                                <td style={{ padding: '6px 8px' }}>
                                  <span className="location-toggle">{isExpanded ? '▾' : '▸'}</span>
                                  {onLocationClick
                                    ? <button type="button" className="pokemon-name-link" onClick={(e) => { e.stopPropagation(); onLocationClick(location) }}>{locationDisplay}</button>
                                    : locationDisplay
                                  }
                                </td>
                                <td style={{ padding: '6px 8px', color: '#888' }}>
                                  {entryList.length} method{entryList.length !== 1 ? 's' : ''}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#888' }}>
                                  —
                                </td>
                              </tr>
                            )

                            if (isExpanded) {
                              entryList.forEach((entry, idx) => {
                                const methodDisplay = entry.method.replace(/-/g, ' ')
                                rows.push(
                                  <tr
                                    key={`${location}-${idx}`}
                                    className="location-detail-row"
                                    style={{ borderBottom: '1px solid #eee' }}
                                  >
                                    <td style={{ padding: '4px 8px 4px 24px' }}>
                                      {entry.conditions.length > 0 && (
                                        <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                                          {entry.conditions.map(c => c.replace(/-/g, ' ')).join(', ')}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      {methodDisplay.charAt(0).toUpperCase() + methodDisplay.slice(1)}
                                    </td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{entry.rate}%</td>
                                  </tr>
                                )
                              })
                            }

                            return rows
                          })}
                        </tbody>
                      </table>
                    )
                  }

                  // --- No wild encounters for this version: priority fallback ---
                  // Priority 1: Can it evolve from a pre-evolution available in this game?
                  if (canEvolveFrom) {
                    return <p style={{ margin: '0' }}>Evolve from {canEvolveFrom.replace(/-/g, ' ')}.</p>
                  }

                  // Priority 2: Can it be traded from another game in this gen?
                  const currentGen = versionGeneration[selectedVersion]
                  if (currentGen) {
                    const genVersions = generationVersions[currentGen] || []
                    // Only consider versions where the Pokémon has actual wild encounters
                    const versionsWithEncounters = new Set()
                    allEncounters.forEach(enc => {
                      enc.version_details?.forEach(vd => {
                        if (vd.version?.name && vd.encounter_details?.length > 0) {
                          versionsWithEncounters.add(vd.version.name)
                        }
                      })
                    })
                    const otherGenVersions = genVersions.filter(
                      v => v !== selectedVersion && versionsWithEncounters.has(v)
                    )
                    if (otherGenVersions.length > 0) {
                      const tradeNames = otherGenVersions.map(v => versionDisplayNames[v] || v).join(', ')
                      return <p style={{ margin: '0' }}>Trade from {tradeNames}.</p>
                    }
                  }

                  // Priority 2b: Can a pre-evolution be traded from another game and then evolved?
                  if (canTradeAndEvolveFrom) {
                    const tradeNames = canTradeAndEvolveFrom.tradeVersions.map(v => versionDisplayNames[v] || v).join(', ')
                    const preEvoName = canTradeAndEvolveFrom.preEvo.replace(/-/g, ' ')
                    return <p style={{ margin: '0' }}>Trade from {tradeNames} and/or evolve from {preEvoName}.</p>
                  }

                  // Priority 3: Transfer (only Gen 1-6)
                  if (currentGen && currentGen <= 6) {
                    return <p style={{ margin: '0' }}>Transfer only.</p>
                  }

                  return <p style={{ margin: '0' }}>No location data available.</p>
                })()
              ) : allEncounters.length === 0 && selectedVersion ? (
                (() => {
                  // No encounter data at all from the API — same priority fallback
                  if (canEvolveFrom) {
                    return <p style={{ margin: '0' }}>Evolve from {canEvolveFrom.replace(/-/g, ' ')}.</p>
                  }

                  // Check if a pre-evo can be traded from another same-gen game and evolved
                  if (canTradeAndEvolveFrom) {
                    const tradeNames = canTradeAndEvolveFrom.tradeVersions.map(v => versionDisplayNames[v] || v).join(', ')
                    const preEvoName = canTradeAndEvolveFrom.preEvo.replace(/-/g, ' ')
                    return <p style={{ margin: '0' }}>Trade from {tradeNames} and/or evolve from {preEvoName}.</p>
                  }

                  // allEncounters is empty, so no wild encounters exist in any version — skip trade check
                  const currentGen = versionGeneration[selectedVersion]

                  if (currentGen && currentGen <= 6) {
                    return <p style={{ margin: '0' }}>Transfer only.</p>
                  }

                  return <p style={{ margin: '0' }}>No location data available.</p>
                })()
              ) : allEncounters.length === 0 ? (
                <p style={{ margin: '0' }}>No location data available.</p>
              ) : (
                <p style={{ margin: '0' }}>Select a version to see locations.</p>
              )}
            </div>
          </div>
        </div>

        {/* Evolution Box */}
        <div className="info-box evolution-box">
          <div className="box-title">Evolution Line</div>
          <div className="box-content evolution-box-content" style={{ display: 'flex', justifyContent: 'center' }}>
            {evolutions.length > 0 ? (
              renderEvolutionForest(evolutions, selectedForm || pokemon.name, onEvolutionClick)
            ) : (
              <p style={{ margin: 0, color: 'var(--text-muted, #888)', fontSize: '12px' }}>No evolution available.</p>
            )}
          </div>
        </div>

        {/* Stats Box */}
        <div className="info-box basestats-box">
          <div className="box-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Base Stats</span>
            <button
              type="button"
              className="scroll-to-calc-btn"
              onClick={() => statsCalcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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
            {generationStats.map(stat => {
              const maxStat = 255 // Maximum possible stat value in Pokemon
              const percentage = (stat.base_stat / maxStat) * 100
              const statColor = stat.base_stat < 60 ? '#ff6b6b' : 
                               stat.base_stat < 80 ? '#ffa500' : 
                               stat.base_stat < 100 ? '#ffeb3b' : 
                               stat.base_stat < 130 ? '#90ee90' : '#4caf50'
              const shortName = {
                'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF',
                'special': 'SPC', 'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'SPE'
              }[stat.stat.name] || stat.stat.name
              
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

      </div>

      {/* Moves — Desktop: stacked, Mobile: tabbed */}
      {(movesLoading || moves.levelUp.length > 0 || moves.tm.length > 0 || moves.tutor.length > 0 || moves.special.length > 0 || moves.egg.length > 0 || moves.transfer.length > 0) && (() => {
        const moveTabs = [
          moves.levelUp.length > 0 && { key: 'levelUp', title: 'Level Up', content: <MoveTable title="Level Up Moves" moves={moves.levelUp} showLevel loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Level Up Moves" moves={moves.levelUp} showLevel loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.tm.length > 0 && { key: 'tm', title: 'TMs', content: <MoveTable title="TMs" moves={moves.tm} showTmNumber loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="TMs" moves={moves.tm} showTmNumber loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.tutor.length > 0 && { key: 'tutor', title: 'Tutor', content: <MoveTable title="Tutor" moves={moves.tutor} loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Tutor" moves={moves.tutor} loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.special.length > 0 && { key: 'special', title: 'Special', content: <MoveTable title="Special" moves={moves.special} showMethod loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Special" moves={moves.special} showMethod loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.transfer.length > 0 && { key: 'transfer', title: 'Transfer', content: <MoveTable title="Transfer Only" moves={moves.transfer} loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Transfer Only" moves={moves.transfer} loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.egg.length > 0 && { key: 'egg', title: 'Egg', content: <MoveTable title="Egg" moves={moves.egg} loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Egg" moves={moves.egg} loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
        ].filter(Boolean)

        const safeTab = activeMoveTab < moveTabs.length ? activeMoveTab : 0

        return (
          <>
            {/* Desktop: all tables stacked */}
            <div className="container-flex moves-desktop">
              {moveTabs.map(tab => <div key={tab.key}>{tab.content}</div>)}
              {movesLoading && moveTabs.length === 0 && (
                <MoveTable title="Moves" moves={[]} loading onMoveClick={onMoveClick} />
              )}
            </div>

            {/* Mobile: tabbed interface */}
            <div className="moves-mobile">
              {movesLoading && moveTabs.length === 0 ? (
                <MoveTable title="Moves" moves={[]} loading onMoveClick={onMoveClick} />
              ) : (
                <>
                  <div className="moves-tab-bar">
                    {moveTabs.map((tab, idx) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`moves-tab-btn${idx === safeTab ? ' moves-tab-active' : ''}`}
                        onClick={() => setActiveMoveTab(idx)}
                      >
                        {tab.title}
                      </button>
                    ))}
                  </div>
                  <div className="moves-tab-content">
                    {moveTabs[safeTab]?.compactContent}
                  </div>
                </>
              )}
            </div>
          </>
        )
      })()}



      {/* Stats Calculator Section */}
      <div className="info-box full-width" style={{ marginTop: '10px' }} ref={statsCalcRef}>
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
                <div className="box-title">Pokédex Entry: {entry.version?.name?.replace(/-/g, ' ') || `Entry ${idx + 1}`}</div>
                <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  <p style={{ margin: '0' }}>{entry.flavor_text.replace(/\f/g, ' ')}</p>
                </div>
              </div>
            ))}

                <div className="info-box">
            <div className="box-title">Training Info</div>
            <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <div>
                <ul style={{ padding: '0 20px', margin: '0' }}><li> <b>Exp. Growth Rate:</b> {species.growth_rate?.name?.toUpperCase() || 'Unknown'}</li></ul>
                <ul style={{ padding: '0 20px', margin: '0' }}><li> <b>Base Happiness: </b>{species.base_happiness ? (species.base_happiness).toLocaleString() : 'N/A'}</li></ul> 
              </div>
            </div>
          </div>

              <div className="info-box">
            <div className="box-title">Misc Info</div>
            <div className="box-content" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <div>
                <ul style={{ padding: '0 20px', margin: '0' }}><li> <b>Habitat:</b> {species.habitat?.name?.toUpperCase() || 'Unknown'}</li></ul>
                <ul style={{ padding: '0 20px', margin: '0' }}><li> <b>Color:</b> {species.color?.name?.toUpperCase() || 'Unknown'}</li></ul>
                <ul style={{ padding: '0 20px', margin: '0' }}><li> <b>Introduced in:</b> {species.generation?.name?.toUpperCase() || 'Unknown'}</li></ul>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back to Top Button */}
      <button
        type="button"
        className="back-to-top-btn"
        onClick={() => cardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        title="Back to top"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
        Back to Top
      </button>
    </div>
  )
}