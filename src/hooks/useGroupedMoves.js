import { useState, useEffect } from 'react'
import { getVersionInfo, generationOrder } from '../utils/versionInfo'
import { fetchMoveCached, fetchMachineCached } from '../utils/pokeCache'

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

export function useGroupedMoves(displayPokemon, selectedVersion) {
  const [moves, setMoves] = useState({ levelUp: [], tm: [], tutor: [], event: [], egg: [] })

  useEffect(() => {
    if (!displayPokemon?.moves?.length) return

    let active = true

    const buildMoves = async () => {
      let versionGroup = null
      if (selectedVersion) {
        const info = await getVersionInfo(selectedVersion)
        versionGroup = info?.versionGroup || null
      }

      const groupedMoves = { levelUp: [], tm: [], tutor: [], event: [], egg: [] }
      const seenMoves = { levelUp: new Set(), tm: new Set(), tutor: new Set(), event: new Set(), egg: new Set() }

      displayPokemon.moves.forEach(moveData => {
        const moveName = moveData.move.name
        const details = moveData.version_group_details || []
        const detailsToUse = versionGroup
          ? details.filter(detail => detail.version_group?.name === versionGroup)
          : details

        detailsToUse.forEach(detail => {
          const method = detail.move_learn_method?.name
          const level = detail.level_learned_at

          if (method === 'level-up' && !seenMoves.levelUp.has(moveName)) {
            groupedMoves.levelUp.push({ name: moveName, level })
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

      const withDetails = list => list.map(move => ({
        ...move,
        details: applyPastValues(moveDetailsMap.get(move.name), versionGroup) || null
      }))
      
// Fetch actual TM/HM/TR numbers from machine endpoints
      const tmMachineUrls = new Map()
      for (const move of groupedMoves.tm) {
        const details = moveDetailsMap.get(move.name)
        if (details?.machines && versionGroup) {
          const machineEntry = details.machines.find(m => m.version_group?.name === versionGroup)
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
          tmNumber: tmNumber ?? move.tmNumber,
          tmLabel: tmLabel ?? null,
          details
        }
      })

      groupedMoves.levelUp = withDetails(groupedMoves.levelUp)
      groupedMoves.tm = withDetailsAndTmNumber(groupedMoves.tm)
      groupedMoves.tutor = withDetails(groupedMoves.tutor)
      groupedMoves.event = withDetails(groupedMoves.event)
      groupedMoves.egg = withDetails(groupedMoves.egg)

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
  }, [displayPokemon?.moves, selectedVersion])

  return moves
}
