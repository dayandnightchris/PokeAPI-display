import { useState, useEffect } from 'react'
import { getVersionInfo, generationOrder, versionGeneration, generationVersionGroups, versionGroupDisplayNames } from '../utils/versionInfo'
import { fetchMoveCached, fetchMachineCached, fetchPokemonCached } from '../utils/pokeCache'
import gen1TradebackMoves from '../utils/tradebackMoves'

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
  'the-indigo-disk': 25,
  'legends-za': 26,
  'mega-dimension': 27,
}

// Determine which version groups can provide transfer-only moves for the selected version.
// Returns a Set of version group names, or null if no transfers are possible.
function getTransferSourceVersionGroups(selectedVersion, versionGroup) {
  if (!selectedVersion || !versionGroup) return null

  const gen = versionGeneration[selectedVersion]
  if (!gen) return null

  // Gen 3: hard cutoff, no transfers
  if (gen === 3) return null

  // LGPE, BDSP, PLA, Gen 9+: no transfers
  const noTransferVersionGroups = new Set([
    'lets-go-pikachu-lets-go-eevee',
    'brilliant-diamond-and-shining-pearl',
    'legends-arceus',
    'scarlet-violet', 'the-teal-mask', 'the-indigo-disk',
    'legends-za', 'mega-dimension',
  ])
  if (noTransferVersionGroups.has(versionGroup)) return null

  const sources = new Set()
  const currentGenVgs = new Set(generationVersionGroups[gen] || [])

  // Gen 1-2: bidirectional transfers between Gen 1 and Gen 2
  if (gen === 1 || gen === 2) {
    const otherGen = gen === 1 ? 2 : 1
    for (const vg of (generationVersionGroups[otherGen] || [])) {
      sources.add(vg)
    }
    return sources.size > 0 ? sources : null
  }

  // Gen 4-6: forward from Gen 3+
  if (gen >= 4 && gen <= 6) {
    for (let g = 3; g < gen; g++) {
      for (const vg of (generationVersionGroups[g] || [])) {
        sources.add(vg)
      }
    }
    return sources.size > 0 ? sources : null
  }

  // SM/USUM (Gen 7, but NOT LGPE): Gen 3+ forward AND Gen 1-2 via Virtual Console
  if (gen === 7) {
    for (let g = 1; g <= 6; g++) {
      for (const vg of (generationVersionGroups[g] || [])) {
        sources.add(vg)
      }
    }
    return sources.size > 0 ? sources : null
  }

  // SWSH (Gen 8, sword-shield / IoA / CT only): same as SM/USUM
  if (gen === 8) {
    const swshVgs = new Set(['sword-shield', 'the-isle-of-armor', 'the-crown-tundra'])
    if (!swshVgs.has(versionGroup)) return null
    for (let g = 1; g <= 7; g++) {
      for (const vg of (generationVersionGroups[g] || [])) {
        sources.add(vg)
      }
    }
    return sources.size > 0 ? sources : null
  }

  return null
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
  const [moves, setMoves] = useState({ levelUp: [], tm: [], tutor: [], special: [], egg: [], transfer: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!displayPokemon?.moves?.length) return

    let active = true
    setLoading(true)

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

      const groupedMoves = { levelUp: [], tm: [], tutor: [], special: [], egg: [] }
      const seenMoves = { levelUp: new Set(), tm: new Set(), tutor: new Set(), special: new Set(), egg: new Set() }

      // Methods that map to the "special" category
      const specialMethods = new Set(['light-ball-egg', 'colosseum-purification', 'xd-purification', 'stadium-surfing-pikachu', 'form-change', 'zygarde-cube'])

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
          } else if (specialMethods.has(method) && !seenMoves.special.has(moveName)) {
            groupedMoves.special.push({ name: moveName, learnMethod: method })
            seenMoves.special.add(moveName)
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

      const withDetails = (list, method) => list.map(move => {
        let sourceGames
        if (method === 'special') {
          // Merge sources across all special learn methods
          const merged = new Set()
          for (const sm of specialMethods) {
            const sources = moveMethodSources.get(`${move.name}:${sm}`)
            if (sources) sources.forEach(vg => merged.add(vg))
          }
          if (merged.size === 0 || !genVersionGroupSet) {
            sourceGames = null
          } else if (genVgList.every(vg => merged.has(vg))) {
            sourceGames = 'All'
          } else {
            sourceGames = [...merged]
              .sort((a, b) => (versionGroupOrder[a] || 0) - (versionGroupOrder[b] || 0))
              .map(vg => versionGroupDisplayNames[vg] || vg)
              .join(', ')
          }
        } else {
          sourceGames = getSourceLabel(move.name, method)
        }
        return {
          ...move,
          sourceGames,
          details: applyPastValues(moveDetailsMap.get(move.name), versionGroup) || null
        }
      })
      
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
      groupedMoves.special = withDetails(groupedMoves.special, 'special')
      groupedMoves.egg = withDetails(groupedMoves.egg, 'egg')

      // If this is an evolved Pokémon, inherit unique moves from all pre-evolutions
      // (level-up, TM, tutor, event, egg — per-category, so a move known via TM
      // can still be inherited as a level-up move from a pre-evo)
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

        // API method name → groupedMoves key
        const methodMap = [
          ['level-up', 'levelUp'],
          ['machine', 'tm'],
          ['tutor', 'tutor'],
          ['light-ball-egg', 'special'],
          ['colosseum-purification', 'special'],
          ['xd-purification', 'special'],
          ['stadium-surfing-pikachu', 'special'],
          ['form-change', 'special'],
          ['zygarde-cube', 'special'],
          ['egg', 'egg']
        ]

        for (const preEvoName of preEvoNames) {
          const preEvoPokemon = await fetchPokemonCached(preEvoName)
          if (!preEvoPokemon?.moves) continue

          const inheritedByCategory = { levelUp: [], tm: [], tutor: [], special: [], egg: [] }

          preEvoPokemon.moves.forEach(moveData => {
            const moveName = moveData.move.name
            const vgDetails = moveData.version_group_details || []

            for (const [apiMethod, groupKey] of methodMap) {
              const methodDetails = genVersionGroupSet
                ? vgDetails.filter(d => d.move_learn_method?.name === apiMethod && genVersionGroupSet.has(d.version_group?.name))
                : vgDetails.filter(d => d.move_learn_method?.name === apiMethod)

              if (methodDetails.length === 0) continue

              // Skip if the current pokemon already has this move in this same category
              if (seenMoves[groupKey].has(moveName)) continue

              const moveEntry = { name: moveName, inheritedFrom: preEvoName }

              // For level-up, capture the level (prefer selected version group)
              if (apiMethod === 'level-up') {
                const selectedVgLevelUp = versionGroup
                  ? vgDetails.find(d => d.version_group?.name === versionGroup && d.move_learn_method?.name === 'level-up')
                  : null
                moveEntry.level = selectedVgLevelUp ? selectedVgLevelUp.level_learned_at : methodDetails[0]?.level_learned_at
              }

              // For TM, set placeholder tmNumber
              if (apiMethod === 'machine') {
                moveEntry.tmNumber = null
              }

              // For special methods, store the learn method name
              if (groupKey === 'special') {
                moveEntry.learnMethod = apiMethod
              }

              inheritedByCategory[groupKey].push(moveEntry)
              seenMoves[groupKey].add(moveName)

              // Track sources for sourceGames label
              const sourceKey = `${moveName}:${apiMethod}`
              if (!moveMethodSources.has(sourceKey)) moveMethodSources.set(sourceKey, new Set())
              methodDetails.forEach(d => {
                if (d.version_group?.name) moveMethodSources.get(sourceKey).add(d.version_group.name)
              })

              break // Only add to the first matching category
            }
          })

          // Fetch move details for any newly discovered moves
          const newMoveNames = []
          Object.values(inheritedByCategory).forEach(list => {
            list.forEach(m => { if (!moveDetailsMap.has(m.name)) newMoveNames.push(m.name) })
          })
          await Promise.all(
            newMoveNames.map(async name => {
              const details = await fetchMoveCached(name)
              if (details) moveDetailsMap.set(name, details)
            })
          )

          // Add inherited level-up, tutor, event, egg moves
          if (inheritedByCategory.levelUp.length > 0) {
            groupedMoves.levelUp.push(...withDetails(inheritedByCategory.levelUp, 'level-up'))
          }
          if (inheritedByCategory.tutor.length > 0) {
            groupedMoves.tutor.push(...withDetails(inheritedByCategory.tutor, 'tutor'))
          }
          if (inheritedByCategory.special.length > 0) {
            groupedMoves.special.push(...withDetails(inheritedByCategory.special, 'special'))
          }
          if (inheritedByCategory.egg.length > 0) {
            groupedMoves.egg.push(...withDetails(inheritedByCategory.egg, 'egg'))
          }

          // Add inherited TM moves (also fetch machine data for TM numbers)
          if (inheritedByCategory.tm.length > 0) {
            const inheritedTmMachineUrls = new Map()
            for (const move of inheritedByCategory.tm) {
              const details = moveDetailsMap.get(move.name)
              if (details?.machines && genVersionGroupSet) {
                const machineEntry = details.machines.find(m => m.version_group?.name === versionGroup)
                  || details.machines.find(m => genVersionGroupSet.has(m.version_group?.name))
                if (machineEntry?.machine?.url) {
                  inheritedTmMachineUrls.set(move.name, machineEntry.machine.url)
                }
              }
            }
            await Promise.all(
              Array.from(inheritedTmMachineUrls.entries()).map(async ([moveName, url]) => {
                const data = await fetchMachineCached(url)
                if (data) machineDataMap.set(moveName, data)
              })
            )
            groupedMoves.tm.push(...withDetailsAndTmNumber(inheritedByCategory.tm))
          }
        }
      }

      // === Transfer-only moves ===
      // Moves that can only exist on this Pokémon in the selected game via transfer
      // from a prior generation (not available by any learn method in the current gen).
      const transferSourceVgs = getTransferSourceVersionGroups(selectedVersion, versionGroup)
      if (transferSourceVgs) {
        // Collect all move names already available in the current generation (across all categories)
        const currentGenMoveNames = new Set()
        Object.values(groupedMoves).forEach(list => {
          list.forEach(m => currentGenMoveNames.add(m.name))
        })

        // Gather all pokemon to check (self + pre-evolutions)
        const pokemonToCheck = [displayPokemon]
        if (species?.evolves_from_species) {
          let currentSpecies = species
          while (currentSpecies?.evolves_from_species) {
            const preEvoName = currentSpecies.evolves_from_species.name
            const preEvoPokemon = await fetchPokemonCached(preEvoName)
            if (preEvoPokemon) pokemonToCheck.push(preEvoPokemon)
            try {
              const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${preEvoName}/`)
              if (res.ok) {
                currentSpecies = await res.json()
              } else break
            } catch { break }
          }
        }

        // For Gen 1 tradeback: only allow moves explicitly listed in the whitelist
        const selectedGen = versionGeneration[selectedVersion]
        const isGen1Tradeback = selectedGen === 1

        const transferMoves = []
        const seenTransfer = new Set()

        for (const pkmn of pokemonToCheck) {
          if (!pkmn?.moves) continue
          const isPreEvo = pkmn !== displayPokemon
          const pkmnName = pkmn.name || pkmn.species?.name || ''

          for (const moveData of pkmn.moves) {
            const moveName = moveData.move.name
            // Skip if already available in current gen or already added as transfer
            if (currentGenMoveNames.has(moveName) || seenTransfer.has(moveName)) continue

            const vgDetails = moveData.version_group_details || []
            // Find learn methods in transfer source version groups
            const transferDetails = vgDetails.filter(d => transferSourceVgs.has(d.version_group?.name))
            if (transferDetails.length === 0) continue

            // For Gen 1: only allow moves in the tradeback whitelist for this Pokémon
            if (isGen1Tradeback) {
              const allowed = gen1TradebackMoves[pkmnName]
              if (!allowed || !allowed.includes(moveName)) continue
            }

            // Collect which source games teach this move
            const sourceVgs = new Set()
            transferDetails.forEach(d => {
              if (d.version_group?.name) sourceVgs.add(d.version_group.name)
            })
            const sourceLabel = [...sourceVgs]
              .sort((a, b) => (versionGroupOrder[a] || 0) - (versionGroupOrder[b] || 0))
              .map(vg => versionGroupDisplayNames[vg] || vg)
              .join(', ')

            transferMoves.push({
              name: moveName,
              sourceGames: sourceLabel,
              ...(isPreEvo ? { inheritedFrom: pkmn.name || pkmn.species?.name } : {}),
            })
            seenTransfer.add(moveName)
          }
        }

        // Fetch details for new transfer moves
        const newTransferMoveNames = transferMoves.filter(m => !moveDetailsMap.has(m.name)).map(m => m.name)
        await Promise.all(
          newTransferMoveNames.map(async name => {
            const details = await fetchMoveCached(name)
            if (details) moveDetailsMap.set(name, details)
          })
        )

        groupedMoves.transfer = transferMoves.map(move => ({
          ...move,
          details: applyPastValues(moveDetailsMap.get(move.name), versionGroup) || null
        }))
      } else {
        groupedMoves.transfer = []
      }

      // Sort level-up moves by level
      groupedMoves.levelUp.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      // Sort moves alphabetically
      groupedMoves.tm.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.tutor.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.special.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.egg.sort((a, b) => a.name.localeCompare(b.name))
      groupedMoves.transfer.sort((a, b) => a.name.localeCompare(b.name))

      if (active) {
        setMoves(groupedMoves)
        setLoading(false)
      }
    }

    buildMoves()

    return () => {
      active = false
    }
  }, [displayPokemon?.moves, selectedVersion, species?.name])

  return { moves, loading }
}
