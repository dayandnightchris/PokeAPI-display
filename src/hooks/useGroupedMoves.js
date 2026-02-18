import { useState, useEffect } from 'react'
import { getVersionInfo, generationOrder, versionGeneration, generationVersionGroups, versionGroupDisplayNames } from '../utils/versionInfo'
import { fetchMoveCached, fetchMachineCached, fetchPokemonCached } from '../utils/pokeCache'

// Map version groups to a comparable order (by generation + sub-order within gen)
const versionGroupOrder = {
  'red-blue': 1,
  'yellow': 2,
  'gold-silver': 3,
  'crystal': 4,
  'ruby-sapphire': 5,
  'emerald': 6,
  'firered-leafgreen': 7,
  'colosseum': 7.5,
  'xd': 7.6,
  'diamond-pearl': 8,
  'platinum': 9,
  'heartgold-soulsilver': 10,
  'black-white': 11,
  'black-2-white-2': 12,
  'x-y': 13,
  'omega-ruby-alpha-sapphire': 14,
  'sun-moon': 15,
  'ultra-sun-ultra-moon': 16,
  'lets-go-pikachu-lets-go-eevee': 17,
  'sword-shield': 18,
  'the-isle-of-armor': 19,
  'the-crown-tundra': 20,
  'brilliant-diamond-and-shining-pearl': 21,
  'legends-arceus': 22,
  'scarlet-violet': 23,
  'the-teal-mask': 24,
  'the-indigo-disk': 25
}

// Apply past_values to move details based on the selected version group
function applyPastValues(details, versionGroup) {
  if (!details || !versionGroup || !details.past_values?.length) return details

  const selectedOrder = versionGroupOrder[versionGroup]
  if (selectedOrder == null) return details

  // Create a shallow copy of details so we can override fields
  const adjusted = { ...details }

  // past_values entries mark when a value CHANGED — meaning the listed values
  // were in effect BEFORE that version group. Process from newest to oldest:
  // if our selected version group is BEFORE the entry's version group,
  // apply those past values.
  for (const entry of details.past_values) {
    const entryOrder = versionGroupOrder[entry.version_group?.name]
    if (entryOrder == null) continue

    // If our selected version is before this change point, apply the old values
    if (selectedOrder < entryOrder) {
      if (entry.power != null) adjusted.power = entry.power
      if (entry.pp != null) adjusted.pp = entry.pp
      if (entry.accuracy != null) adjusted.accuracy = entry.accuracy
      if (entry.effect_chance != null) adjusted.effect_chance = entry.effect_chance
      if (entry.type != null) adjusted.type = entry.type
      if (entry.effect_entries?.length) adjusted.effect_entries = entry.effect_entries
    }
  }

  return adjusted
}

export function useGroupedMoves(displayPokemon, selectedVersion, species) {
  const [moves, setMoves] = useState({ levelUp: [], tm: [], tutor: [], event: [], egg: [] })

  useEffect(() => {
    if (!displayPokemon?.moves?.length) return

    let active = true

    const buildMoves = async () => {
      let versionGroup = null
      let genVersionGroupSet = null
      if (selectedVersion) {
        const info = await getVersionInfo(selectedVersion)
        versionGroup = info?.versionGroup || null
        // Build a set of all version groups in the same generation
        if (versionGroup) {
          const genNum = versionGeneration[selectedVersion]
          if (genNum) {
            genVersionGroupSet = new Set(generationVersionGroups[genNum] || [])
          }
        }
      }

      const groupedMoves = { levelUp: [], tm: [], tutor: [], event: [], egg: [] }
      const seenMoves = { levelUp: new Set(), tm: new Set(), tutor: new Set(), event: new Set(), egg: new Set() }

      // Collect which version groups each move+method appears in
      const moveMethodSources = new Map() // key: `${moveName}:${method}` → Set of version group names

      displayPokemon.moves.forEach(moveData => {
        const moveName = moveData.move.name
        const details = moveData.version_group_details || []
        // Filter to all version groups in the generation (not just the selected game)
        const detailsToUse = genVersionGroupSet
          ? details.filter(detail => genVersionGroupSet.has(detail.version_group?.name))
          : details

        // For level-up moves, prefer the level from the selected version group
        const selectedVgLevelUp = versionGroup
          ? details.find(d => d.version_group?.name === versionGroup && d.move_learn_method?.name === 'level-up')
          : null

        detailsToUse.forEach(detail => {
          const method = detail.move_learn_method?.name
          const level = detail.level_learned_at
          const vg = detail.version_group?.name
          const sourceKey = `${moveName}:${method}`

          // Track source version groups
          if (!moveMethodSources.has(sourceKey)) moveMethodSources.set(sourceKey, new Set())
          if (vg) moveMethodSources.get(sourceKey).add(vg)

          if (method === 'level-up' && !seenMoves.levelUp.has(moveName)) {
            // Use level from selected version group if available, otherwise from whichever version group has it
            const preferredLevel = selectedVgLevelUp ? selectedVgLevelUp.level_learned_at : level
            groupedMoves.levelUp.push({ name: moveName, level: preferredLevel })
            seenMoves.levelUp.add(moveName)
          } else if (method === 'machine' && !seenMoves.tm.has(moveName)) {
            // TM number will be fetched from move details later
            groupedMoves.tm.push({ name: moveName, tmNumber: null })
            seenMoves.tm.add(moveName)
          } else if (method === 'tutor' && !seenMoves.tutor.has(moveName)) {
            groupedMoves.tutor.push({ name: moveName })
            seenMoves.tutor.add(moveName)
          } else if (method === 'reminder' && !seenMoves.event.has(moveName)) {
            groupedMoves.event.push({ name: moveName })
            seenMoves.event.add(moveName)
          } else if (method === 'egg' && !seenMoves.egg.has(moveName)) {
            groupedMoves.egg.push({ name: moveName })
            seenMoves.egg.add(moveName)
          }
        })
      })

      // Helper to build source games label for a move+method
      const genVgList = genVersionGroupSet ? [...genVersionGroupSet] : null
      const getSourceLabel = (moveName, method) => {
        const sources = moveMethodSources.get(`${moveName}:${method}`)
        if (!sources || !genVersionGroupSet) return null
        // If present in all version groups of the gen, show "All"
        if (genVgList.every(vg => sources.has(vg))) return 'All'
        return [...sources]
          .sort((a, b) => (versionGroupOrder[a] || 0) - (versionGroupOrder[b] || 0))
          .map(vg => versionGroupDisplayNames[vg] || vg)
          .join(', ')
      }

      const allMoveNames = new Set()
      Object.values(groupedMoves).forEach(list => {
        list.forEach(move => allMoveNames.add(move.name))
      })

      const moveDetailsMap = new Map()
      await Promise.all(
        Array.from(allMoveNames).map(async moveName => {
          const details = await fetchMoveCached(moveName)
          if (details) moveDetailsMap.set(moveName, details)
        })
      )

      const withDetails = (list, method) => list.map(move => ({
        ...move,
        sourceGames: getSourceLabel(move.name, method),
        details: applyPastValues(moveDetailsMap.get(move.name), versionGroup) || null
      }))
      
// Fetch actual TM/HM/TR numbers from machine endpoints
      const tmMachineUrls = new Map()
      for (const move of groupedMoves.tm) {
        const details = moveDetailsMap.get(move.name)
        if (details?.machines && genVersionGroupSet) {
          // Prefer selected version group's machine entry, fall back to any in the generation
          const machineEntry = details.machines.find(m => m.version_group?.name === versionGroup)
            || details.machines.find(m => genVersionGroupSet.has(m.version_group?.name))
          if (machineEntry?.machine?.url) {
            tmMachineUrls.set(move.name, machineEntry.machine.url)
          }
        }
      }

      // Batch-fetch all machine data in parallel
      const machineDataMap = new Map()
      await Promise.all(
        Array.from(tmMachineUrls.entries()).map(async ([moveName, url]) => {
          const data = await fetchMachineCached(url)
          if (data) machineDataMap.set(moveName, data)
        })
      )

      const withDetailsAndTmNumber = list => list.map(move => {
        const details = applyPastValues(moveDetailsMap.get(move.name), versionGroup)
        let tmNumber = null
        let tmLabel = null

        const machineData = machineDataMap.get(move.name)
        if (machineData?.item?.name) {
          const m = machineData.item.name.match(/^(tm|hm|tr)(\d+)$/i)
          if (m) {
            tmNumber = parseInt(m[2], 10)
            tmLabel = `${m[1].toUpperCase()}${m[2].padStart(2, '0')}`
          }
        }

        return {
          ...move,
          sourceGames: getSourceLabel(move.name, 'machine'),
          tmNumber: tmNumber ?? move.tmNumber,
          tmLabel: tmLabel ?? null,
          details
        }
      })

      groupedMoves.levelUp = withDetails(groupedMoves.levelUp, 'level-up')
      groupedMoves.tm = withDetailsAndTmNumber(groupedMoves.tm)
      groupedMoves.tutor = withDetails(groupedMoves.tutor, 'tutor')
      groupedMoves.event = withDetails(groupedMoves.event, 'reminder')
      groupedMoves.egg = withDetails(groupedMoves.egg, 'egg')

      // If this is an evolved Pokémon, fetch egg moves from all pre-evolutions
      if (species?.evolves_from_species) {
        // Collect all pre-evolution species names (closest first)
        const preEvoNames = []
        let currentSpecies = species
        while (currentSpecies?.evolves_from_species) {
          const preEvoName = currentSpecies.evolves_from_species.name
          preEvoNames.push(preEvoName)
          try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${preEvoName}/`)
            if (res.ok) {
              currentSpecies = await res.json()
            } else {
              break
            }
          } catch {
            break
          }
        }

        // Fetch egg moves from each pre-evolution
        for (const preEvoName of preEvoNames) {
          const preEvoPokemon = await fetchPokemonCached(preEvoName)
          if (preEvoPokemon?.moves) {
            const preEvoEggMoves = []

            preEvoPokemon.moves.forEach(moveData => {
              const moveName = moveData.move.name
              if (seenMoves.egg.has(moveName)) return // already in egg moves

              const details = moveData.version_group_details || []
              const eggDetails = genVersionGroupSet
                ? details.filter(d => d.move_learn_method?.name === 'egg' && genVersionGroupSet.has(d.version_group?.name))
                : details.filter(d => d.move_learn_method?.name === 'egg')

              if (eggDetails.length > 0) {
                preEvoEggMoves.push({ name: moveName })
                seenMoves.egg.add(moveName)

                // Track sources
                const sourceKey = `${moveName}:egg`
                if (!moveMethodSources.has(sourceKey)) moveMethodSources.set(sourceKey, new Set())
                eggDetails.forEach(d => {
                  if (d.version_group?.name) moveMethodSources.get(sourceKey).add(d.version_group.name)
                })
              }
            })

            if (preEvoEggMoves.length > 0) {
              // Fetch details for new egg moves
              const newMoveNames = preEvoEggMoves.filter(m => !moveDetailsMap.has(m.name)).map(m => m.name)
              await Promise.all(
                newMoveNames.map(async name => {
                  const details = await fetchMoveCached(name)
                  if (details) moveDetailsMap.set(name, details)
                })
              )

              const inheritedEggs = withDetails(
                preEvoEggMoves.map(m => ({ ...m, inheritedFrom: preEvoName })),
                'egg'
              )
              groupedMoves.egg.push(...inheritedEggs)
            }
          }
        }
      }

      // Sort level-up moves by level
      groupedMoves.levelUp.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      // Sort moves alphabetically
      groupedMoves.tm.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.tutor.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.event.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.egg.sort((a, b) => a.name.localeCompare(b.name))

      if (active) setMoves(groupedMoves)
    }

    buildMoves()

    return () => {
      active = false
    }
  }, [displayPokemon?.moves, selectedVersion, species?.name])

  return moves
}
