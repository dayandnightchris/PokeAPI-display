import { useState, useEffect } from 'react'
import { getVersionInfo } from '../utils/versionInfo'

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

      if (active) setMoves(groupedMoves)
    }

    buildMoves()

    return () => {
      active = false
    }
  }, [displayPokemon?.moves, selectedVersion])

  return moves
}
