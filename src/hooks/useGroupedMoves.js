import { useState, useEffect } from 'react'
import { getVersionInfo } from '../utils/versionInfo'
import { fetchMoveCached } from '../utils/pokeCache'

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
        details: moveDetailsMap.get(move.name) || null
      }))
      
      // Special handler for TMs to extract actual TM numbers
      const withDetailsAndTmNumber = list => list.map(move => {
        const details = moveDetailsMap.get(move.name)
        let tmNumber = null
        
        if (details?.machines && versionGroup) {
          // Find the machine for this version group
          const machine = details.machines.find(m => m.version_group?.name === versionGroup)
          if (machine?.machine?.url) {
            // Extract TM number from URL like: https://pokeapi.co/api/v2/machine/223/
            const match = machine.machine.url.match(/\/machine\/(\d+)\/$/)
            if (match) {
              tmNumber = parseInt(match[1])
            }
          }
        }
        
        return {
          ...move,
          tmNumber: tmNumber ?? move.tmNumber,
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
