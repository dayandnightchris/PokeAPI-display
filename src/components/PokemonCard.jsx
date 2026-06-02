import React, { useState, useEffect, useRef } from 'react'
import StatsCalculator from './StatsCalculator'
import VersionSelector from './VersionSelector'
import UnifiedSearch from './UnifiedSearch'
import { renderEvolutionForest } from './EvolutionTree'
import { getVersionInfo, generationOrder, versionGeneration } from '../utils/versionInfo'
import { titleCase } from '../utils/format'
import MoveTable from './MoveTable'
import TypeMatchupDisplay from './TypeMatchupDisplay'
import BreedingInfoBox from './BreedingInfoBox'
import AbilitiesBox from './AbilitiesBox'
import BaseStatsBox from './BaseStatsBox'
import LocationBox from './LocationBox'
import {
  usePokemonSpecies,
  useAbilityDescriptions,
  usePokemonForms,
  useEvolutionChain,
  useGroupedMoves,
  useVersionSprite,
  usePreEvolutionCheck
} from '../hooks'

export default function PokemonCard({ pokemon, onEvolutionClick, onMoveClick, onAbilityClick, onItemClick, onLocationClick, onEggMoveClick, initialForm, initialVersion, onStateChange, searchLists, onUnifiedNavigate, searchLoading, initialQuery }) {
  // UI state
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
  const { canEvolveFrom, canEvolveFromChain, canTradeAndEvolveFrom, evoFamilyVersions } = usePreEvolutionCheck({ species, selectedVersion })
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

  // Fetch description for hardcoded exception abilities not in the API data. 
  // Currently only Blue-Striped Basculin's Reckless in BW, which was changed to Rock Head in B2W2. 
  // The API only has Rock Head, but in BW both were valid. Insane.
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

  if (!pokemon) {
    return <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted playsInline className="loading-pokeball" /></div>
  }

  const englishEntries = species?.flavor_text_entries?.filter(entry => entry.language?.name === 'en') || []
  const versionEntries = selectedVersion
    ? englishEntries.filter(entry => entry.version?.name === selectedVersion)
    : englishEntries
  const displayedEntries = selectedVersion ? versionEntries : versionEntries.slice(0, 3)
  const nationalDexNumber = species?.pokedex_numbers?.find(entry => entry.pokedex?.name === 'national')?.entry_number

  return (
    <div className="pokemon-card-container" ref={cardTopRef}>
      {/* Search + Version Selector Row */}
      <div className="page-search-row">
        <VersionSelector
          pokemon={displayPokemon}
          selectedVersion={selectedVersion}
          onVersionChange={setSelectedVersion}
          allEncounters={formPokemon ? [] : allEncounters}
          pokedexVersions={formPokemon ? null : pokedexVersions}
          formVersionFilter={formVersionFilter}
        />
        <div className="page-search-inline">
          <UnifiedSearch lists={searchLists} onNavigate={onUnifiedNavigate} activeTab="pokemon" loading={searchLoading} initialQuery={initialQuery} />
        </div>
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
                  <div className="sprite-badges">
                    {shinySrc && (
                      <span className="shiny-hint-badge" title="Shiny available. Click sprite to cycle">✦</span>
                    )}
                    {femaleSrc && (
                      <span className="gender-badge" title="Male / Female available. Click sprite to cycle">⚥</span>
                    )}
                  </div>
                </>
              )
            })()}
          </div>

          {/* Breeding Info Box */}
          <BreedingInfoBox species={species} selectedGenerationRank={selectedGenerationRank} />
        </div>

        {/* Species Info Box */}
        <div className="info-box species-box">
          <div className="box-title">Species Info</div>
          <div className="box-content">
            <div className="info-row">
              <span className="label">Name:</span>
              <span className="value">{titleCase(displayPokemon.name) || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="label">#</span>
              <span className="value">{nationalDexNumber || 'Unknown'}</span>
            </div>
            <div className="info-row">
              <span className="label">Type:</span>
              <TypeMatchupDisplay types={generationTypes} selectedVersion={selectedVersion} />
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
        <AbilitiesBox
          abilities={filteredAbilities}
          abilityDescriptions={abilityDescriptions}
          onAbilityClick={onAbilityClick}
          selectedGenerationRank={selectedGenerationRank}
        />

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
                    return { name: hi.item.name, displayName: titleCase(hi.item.name), rarity: vd.rarity }
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
                          {titleCase(stat.stat.name)}: {stat.effort}
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

          <LocationBox
            selectedVersion={selectedVersion}
            allEncounters={allEncounters}
            expandedLocations={expandedLocations}
            setExpandedLocations={setExpandedLocations}
            onLocationClick={onLocationClick}
            species={species}
            canEvolveFrom={canEvolveFrom}
            canEvolveFromChain={canEvolveFromChain}
            canTradeAndEvolveFrom={canTradeAndEvolveFrom}
            evoFamilyVersions={evoFamilyVersions}
          />
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
        <BaseStatsBox
          stats={generationStats}
          onJumpToCalc={() => statsCalcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />

      </div>

      {/* Moves — Desktop: stacked, Mobile: tabbed */}
      {(movesLoading || moves.levelUp.length > 0 || moves.tm.length > 0 || moves.tutor.length > 0 || moves.special.length > 0 || moves.egg.length > 0 || moves.transfer.length > 0) && (() => {
        const moveTabs = [
          moves.levelUp.length > 0 && { key: 'levelUp', title: 'Level Up', content: <MoveTable title="Level Up Moves" moves={moves.levelUp} showLevel loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Level Up Moves" moves={moves.levelUp} showLevel loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.tm.length > 0 && { key: 'tm', title: 'TMs', content: <MoveTable title="TMs" moves={moves.tm} showTmNumber loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="TMs" moves={moves.tm} showTmNumber loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.tutor.length > 0 && { key: 'tutor', title: 'Tutor', content: <MoveTable title="Tutor" moves={moves.tutor} loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Tutor" moves={moves.tutor} loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.special.length > 0 && { key: 'special', title: 'Special', content: <MoveTable title="Special" moves={moves.special} showMethod loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Special" moves={moves.special} showMethod loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.transfer.length > 0 && { key: 'transfer', title: 'Transfer', content: <MoveTable title="Transfer Only" moves={moves.transfer} loading={movesLoading} onMoveClick={onMoveClick} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Transfer Only" moves={moves.transfer} loading={movesLoading} onMoveClick={onMoveClick} compact generationNum={selectedGenerationRank} /> },
          moves.egg.length > 0 && { key: 'egg', title: 'Egg', content: <MoveTable title="Egg" moves={moves.egg} loading={movesLoading} onMoveClick={onMoveClick} onEggMoveParentsClick={onEggMoveClick ? (moveName) => onEggMoveClick(species?.name || pokemon.name, moveName) : undefined} onNavigateToEggTab={onEggMoveClick ? () => onEggMoveClick(species?.name || pokemon.name) : undefined} generationNum={selectedGenerationRank} />, compactContent: <MoveTable title="Egg" moves={moves.egg} loading={movesLoading} onMoveClick={onMoveClick} onEggMoveParentsClick={onEggMoveClick ? (moveName) => onEggMoveClick(species?.name || pokemon.name, moveName) : undefined} onNavigateToEggTab={onEggMoveClick ? () => onEggMoveClick(species?.name || pokemon.name) : undefined} compact generationNum={selectedGenerationRank} /> },
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
          <StatsCalculator pokemon={displayPokemon} stats={generationStats} selectedVersion={selectedVersion} moves={moves} />
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
