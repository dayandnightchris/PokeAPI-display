import { useState, useEffect, useRef, useCallback } from 'react'
import UnifiedSearch from './UnifiedSearch'
import { fetchPokemonCached, fetchMoveCached, fetchSpeciesCached, preloadPokemonCache } from '../utils/pokeCache'
import {
  versionGeneration, generationVersionGroups, generationOrder, versionGroupOrder,
  versionGroupDisplayNames, versionDisplayNames, getTransferSourceVersionGroups,
} from '../utils/versionInfo'

function formatName(name) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const typeColors = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC', unknown: '#4D7A70',
}
const getTypeColor = (t) => typeColors[t?.toLowerCase()] || '#999'
const getTypeTextColor = (t) => {
  const hex = getTypeColor(t)
  const r = parseInt(hex.slice(1,3), 16) / 255
  const g = parseInt(hex.slice(3,5), 16) / 255
  const b = parseInt(hex.slice(5,7), 16) / 255
  const lum = 0.2126 * (r <= 0.03928 ? r/12.92 : ((r+0.055)/1.055)**2.4)
            + 0.7152 * (g <= 0.03928 ? g/12.92 : ((g+0.055)/1.055)**2.4)
            + 0.0722 * (b <= 0.03928 ? b/12.92 : ((b+0.055)/1.055)**2.4)
  return lum > 0.35 ? '#333' : '#fff'
}

// Map version group name → Set of individual version names
const versionGroupToVersions = {
  'red-blue': ['red', 'blue'], 'yellow': ['yellow'],
  'gold-silver': ['gold', 'silver'], 'crystal': ['crystal'],
  'ruby-sapphire': ['ruby', 'sapphire'], 'emerald': ['emerald'],
  'firered-leafgreen': ['firered', 'leafgreen'], 'colosseum': ['colosseum'], 'xd': ['xd'],
  'diamond-pearl': ['diamond', 'pearl'], 'platinum': ['platinum'], 'heartgold-soulsilver': ['heartgold', 'soulsilver'],
  'black-white': ['black', 'white'], 'black-2-white-2': ['black-2', 'white-2'],
  'x-y': ['x', 'y'], 'omega-ruby-alpha-sapphire': ['omega-ruby', 'alpha-sapphire'],
  'sun-moon': ['sun', 'moon'], 'ultra-sun-ultra-moon': ['ultra-sun', 'ultra-moon'],
  'lets-go-pikachu-lets-go-eevee': ['lets-go-pikachu', 'lets-go-eevee'],
  'sword-shield': ['sword', 'shield'], 'the-isle-of-armor': ['sword', 'shield'],
  'the-crown-tundra': ['sword', 'shield'],
  'brilliant-diamond-and-shining-pearl': ['brilliant-diamond', 'shining-pearl'],
  'legends-arceus': ['legends-arceus'],
  'scarlet-violet': ['scarlet', 'violet'], 'the-teal-mask': ['scarlet', 'violet'],
  'the-indigo-disk': ['scarlet', 'violet'],
  'legends-za': ['legends-za'], 'mega-dimension': ['scarlet', 'violet'],
}

// Build reverse map: version name → primary version group name
const versionToVersionGroup = {}
for (const [vg, versions] of Object.entries(versionGroupToVersions)) {
  for (const v of versions) {
    // First mapping wins (e.g. 'sword' → 'sword-shield', not DLC vgs)
    if (!versionToVersionGroup[v]) versionToVersionGroup[v] = vg
  }
}

// No breeding in these version groups
const NO_BREEDING_VGS = new Set([
  'red-blue', 'yellow',
  'colosseum', 'xd',
  'lets-go-pikachu-lets-go-eevee',
  'legends-arceus', 'legends-za',
])

// Moves that cannot be Sketched by Smeargle, by generation
const UNSKETCHABLE_BY_GEN = {
  2: new Set(['transform', 'mimic', 'metronome', 'mirror-move', 'sleep-talk', 'self-destruct', 'explosion', 'sketch']),
  3: new Set(['transform', 'mimic', 'sketch']),
}
const UNSKETCHABLE_DEFAULT = new Set(['chatter', 'sketch']) // Gen 4+
function isSketchable(moveName, gen) {
  const blocked = UNSKETCHABLE_BY_GEN[gen] || UNSKETCHABLE_DEFAULT
  return !blocked.has(moveName)
}

// Version groups that are isolated within their generation (can't trade with
// the other games in the same gen)
const ISOLATED_VGS = {
  'lets-go-pikachu-lets-go-eevee': new Set(['lets-go-pikachu-lets-go-eevee']),
  'brilliant-diamond-and-shining-pearl': new Set(['brilliant-diamond-and-shining-pearl']),
  'legends-arceus': new Set(['legends-arceus']),
}

// Return the set of version groups in the selected version's gen that can
// actually trade with the selected version.  LGPE is isolated from SM/USUM,
// BDSP and PLA are isolated from SwSh, etc.
function getCompatibleGenVgs(selectedVersion) {
  const gen = versionGeneration[selectedVersion]
  const allGenVgs = generationVersionGroups[gen] || []
  const selVg = versionToVersionGroup[selectedVersion]

  // If the selected version is itself in an isolated group, only its own VGs
  if (ISOLATED_VGS[selVg]) return new Set(ISOLATED_VGS[selVg])

  // Otherwise, include everything in the gen EXCEPT isolated VGs
  const compatible = new Set()
  for (const vg of allGenVgs) {
    if (!ISOLATED_VGS[vg]) compatible.add(vg)
  }
  return compatible
}

export default function EggMoveTab({
  initialPokemon, initialVersion, initialExpandMove, onStateChange, onPokemonClick,
  searchLists, onUnifiedNavigate, onMoveClick,
}) {
  const [pokemonName, setPokemonName] = useState(initialPokemon || null)
  const [pokemonData, setPokemonData] = useState(null)
  const [speciesData, setSpeciesData] = useState(null)
  const [allEggGroups, setAllEggGroups] = useState(new Set()) // egg groups from entire evo chain
  const [eggMoves, setEggMoves] = useState([]) // [{name, versionGroups: Set, sources: [{from, versionGroups}]}]
  const [parentsByMove, setParentsByMove] = useState({}) // moveName → [{name, sprite, methods: [{method, versionGroups}]}]
  const [expandedMoves, setExpandedMoves] = useState({})
  const [tableFullyExpanded, setTableFullyExpanded] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(initialVersion || null)
  const [availableVersions, setAvailableVersions] = useState([])
  const [loadingPokemon, setLoadingPokemon] = useState(false)
  const [loadingParents, setLoadingParents] = useState({}) // moveName → bool
  const [error, setError] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'move', direction: 'asc' })

  const requestIdRef = useRef(0)
  const expandMoveRef = useRef(initialExpandMove || null)
  const scrolledToMoveRef = useRef(false)

  // Compute available versions from egg move data
  useEffect(() => {
    if (!eggMoves || eggMoves.length === 0) {
      setAvailableVersions([])
      return
    }

    // Collect all version groups that have egg moves
    const allVgs = new Set()
    eggMoves.forEach(m => {
      m.versionGroups.forEach(vg => {
        if (!NO_BREEDING_VGS.has(vg)) allVgs.add(vg)
      })
    })

    // Map to individual versions, grouped by generation
    const versionSet = new Set()
    allVgs.forEach(vg => {
      const versions = versionGroupToVersions[vg]
      if (versions) versions.forEach(v => versionSet.add(v))
    })

    // Remove versions from no-breeding games
    const noBreeders = new Set(['red', 'blue', 'yellow', 'colosseum', 'xd', 'lets-go-pikachu', 'lets-go-eevee', 'legends-arceus', 'legends-za'])
    noBreeders.forEach(v => versionSet.delete(v))

    // Group by generation (exclude Gen 8+)
    const grouped = {}
    versionSet.forEach(v => {
      const gen = versionGeneration[v]
      if (!gen || gen >= 8) return
      if (!grouped[gen]) grouped[gen] = []
      grouped[gen].push({ name: v, display: versionDisplayNames[v] || formatName(v), gen })
    })

    // Sort and build groups array
    const groups = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(gen => grouped[gen].sort((a, b) => a.display.localeCompare(b.display)))

    setAvailableVersions(groups)

    // Auto-select version
    if (selectedVersion && versionSet.has(selectedVersion)) return
    if (groups.length > 0) {
      const lastGen = groups[groups.length - 1]
      setSelectedVersion(lastGen[0]?.name || null)
    }
  }, [eggMoves]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ version: selectedVersion, eggmoves: pokemonName })
    }
  }, [selectedVersion, pokemonName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load a Pokémon and extract its egg moves
  const loadPokemon = useCallback(async (name) => {
    if (!name) return
    const cleanName = String(name).trim().toLowerCase()
    const myReq = ++requestIdRef.current

    setPokemonName(cleanName)
    setLoadingPokemon(true)
    setError(null)
    setEggMoves([])
    setParentsByMove({})
    setExpandedMoves({})
    setTableFullyExpanded(false)

    try {
      const pData = await fetchPokemonCached(cleanName)
      if (!pData) throw new Error('Pokémon not found')
      if (requestIdRef.current !== myReq) return

      // If this is a non-default form, load base species
      let speciesName = pData.species?.name || cleanName
      const sData = await fetchSpeciesCached(speciesName)
      if (requestIdRef.current !== myReq) return

      setPokemonData(pData)
      setSpeciesData(sData)

      // Extract egg moves with version group info from this Pokemon
      const eggs = []
      const seen = new Set()

      const extractEggMoves = (pokemonMoves, inheritedFrom) => {
        pokemonMoves.forEach(moveData => {
          const moveName = moveData.move.name
          const vgs = new Set()
          ;(moveData.version_group_details || []).forEach(vgd => {
            if (vgd.move_learn_method?.name === 'egg') {
              const vgName = vgd.version_group?.name
              if (vgName) vgs.add(vgName)
            }
          })
          if (vgs.size > 0) {
            if (seen.has(moveName)) {
              // Merge version groups and add this source
              const existing = eggs.find(e => e.name === moveName)
              if (existing) {
                vgs.forEach(vg => existing.versionGroups.add(vg))
                existing.sources.push({ from: inheritedFrom || null, versionGroups: new Set(vgs) })
              }
            } else {
              seen.add(moveName)
              eggs.push({
                name: moveName,
                versionGroups: vgs,
                sources: [{ from: inheritedFrom || null, versionGroups: new Set(vgs) }],
              })
            }
          }
        })
      }

      // Collect egg groups from the entire evo chain for parent matching
      const chainEggGroups = new Set(
        (sData?.egg_groups || []).map(g => g.name)
      )

      // Extract from the Pokemon itself
      extractEggMoves(pData.moves, null)

      // Walk pre-evolution chain and inherit their egg moves
      // Track the lowest pre-evo (baby form) name
      let babyName = null
      if (sData?.evolves_from_species) {
        let currentSpecies = sData
        while (currentSpecies?.evolves_from_species) {
          const preEvoName = currentSpecies.evolves_from_species.name
          babyName = preEvoName // keeps getting overwritten to the lowest
          try {
            const preEvoPoke = await fetchPokemonCached(preEvoName)
            if (requestIdRef.current !== myReq) return
            if (preEvoPoke?.moves) {
              extractEggMoves(preEvoPoke.moves, preEvoName)
            }
            const preEvoSpecies = await fetchSpeciesCached(preEvoName)
            if (requestIdRef.current !== myReq) return
            // Add pre-evo's egg groups to the chain set
            if (preEvoSpecies?.egg_groups) {
              preEvoSpecies.egg_groups.forEach(g => chainEggGroups.add(g.name))
            }
            currentSpecies = preEvoSpecies
          } catch {
            break
          }
        }

        // Moves only found on the evolved form (sources[0].from is null)
        // must still come from hatching the baby, so add baby as a source
        if (babyName) {
          eggs.forEach(e => {
            if (e.sources.every(s => s.from === null)) {
              e.sources.forEach(s => { s.from = babyName })
            }
          })
        }
      }

      setAllEggGroups(chainEggGroups)
      setEggMoves(eggs)

      if (eggs.length === 0) {
        setError(`${formatName(cleanName)} has no egg moves.`)
      }
    } catch (err) {
      if (requestIdRef.current === myReq) {
        setError(err.message || 'Failed to load Pokémon')
      }
    } finally {
      if (requestIdRef.current === myReq) {
        setLoadingPokemon(false)
      }
    }
  }, [])

  // Auto-load from URL params
  useEffect(() => {
    if (initialPokemon) loadPokemon(initialPokemon)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch parents for a specific egg move
  const fetchParentsForMove = useCallback(async (moveName) => {
    if (parentsByMove[moveName]) return // Already loaded

    setLoadingParents(prev => ({ ...prev, [moveName]: true }))

    try {
      // Fetch the move to get learned_by_pokemon
      const moveData = await fetchMoveCached(moveName)
      if (!moveData || !moveData.learned_by_pokemon) {
        setParentsByMove(prev => ({ ...prev, [moveName]: [] }))
        return
      }

      // Use egg groups from the entire evo chain for parent compatibility
      const targetEggGroups = allEggGroups.size > 0 ? allEggGroups : new Set(
        (speciesData?.egg_groups || []).map(g => g.name)
      )

      // If target is in "no-eggs" group (Undiscovered), show all learners
      const isUndiscovered = targetEggGroups.has('no-eggs')

      // Collect all learner names
      const learnerNames = moveData.learned_by_pokemon.map(p => p.name)

      // Filter out Gen 8+ pokemon (id >= 810) — quick pre-filter to avoid
      // fetching data for hundreds of Gen 8-9 Pokemon we'll never display.
      // The real generation check happens in getFilteredParents.
      const filteredLearners = moveData.learned_by_pokemon.filter(p => {
        const idMatch = p.url?.match(/\/pokemon\/(\d+)\/?$/)
        if (idMatch && Number(idMatch[1]) >= 810) return false
        return true
      })

      // Preload pokemon cache for batch IDB load
      await preloadPokemonCache(filteredLearners.map(p => p.name))

      // For each learner, check if they share an egg group with the target
      // and determine how they learn the move
      const parents = []
      const BATCH_SIZE = 20
      for (let i = 0; i < filteredLearners.length; i += BATCH_SIZE) {
        const batch = filteredLearners.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(batch.map(async (learner) => {
          try {
            const learnerPoke = await fetchPokemonCached(learner.name)
            if (!learnerPoke) return null

            const learnerSpeciesName = learnerPoke.species?.name || learner.name
            const learnerSpecies = await fetchSpeciesCached(learnerSpeciesName)
            if (!learnerSpecies) return null

            // Check egg group compatibility
            const learnerGroups = new Set((learnerSpecies.egg_groups || []).map(g => g.name))

            // Skip if no shared egg group (unless target is undiscovered)
            if (!isUndiscovered) {
              const shared = [...targetEggGroups].some(g => learnerGroups.has(g))
              if (!shared) return null
            }

            // Skip if learner is also in "no-eggs" group (can't breed)
            if (learnerGroups.has('no-eggs')) return null

            // Determine how this parent learns the move and in which version groups
            const moveEntry = learnerPoke.moves.find(m => m.move.name === moveName)
            if (!moveEntry) return null

            const methods = []
            const methodMap = new Map() // method → Set of version groups
            ;(moveEntry.version_group_details || []).forEach(vgd => {
              const method = vgd.move_learn_method?.name
              const vg = vgd.version_group?.name
              const level = vgd.level_learned_at
              if (!method || !vg) return

              const key = method === 'level-up' ? `level-up:${level}` : method
              if (!methodMap.has(key)) methodMap.set(key, { method, level: level || null, vgs: new Set() })
              methodMap.get(key).vgs.add(vg)
            })

            methodMap.forEach(({ method, level, vgs }) => {
              methods.push({ method, level, versionGroups: vgs })
            })

            if (methods.length === 0) return null

            // Store the generation this species was introduced in for
            // filtering: a parent can only appear when viewing its gen or later.
            const introGen = generationOrder[learnerSpecies.generation?.name] || 99

            return {
              name: learner.name,
              speciesName: learnerSpeciesName,
              methods,
              id: learnerPoke.id,
              introGen,
            }
          } catch {
            return null
          }
        }))

        results.forEach(r => { if (r) parents.push(r) })
      }

      // Second pass: add evolutions of parents as additional parents.
      // E.g. Skorupi learns twineedle (egg) → Drapion inherits it and can breed.
      // We check each parent's evolution chain for evolutions that share an egg
      // group with the target but aren't already in the parents list.
      const parentNames = new Set(parents.map(p => p.name))
      const chainCache = new Map() // chain URL → chain data
      const evoParents = []

      for (const parent of parents) {
        try {
          const sp = await fetchSpeciesCached(parent.speciesName)
          if (!sp?.evolution_chain?.url) continue

          let chainData = chainCache.get(sp.evolution_chain.url)
          if (!chainData) {
            const res = await fetch(sp.evolution_chain.url)
            if (!res.ok) continue
            chainData = await res.json()
            chainCache.set(sp.evolution_chain.url, chainData)
          }

          // Walk chain to find evolutions of this parent's species
          const findEvolutions = (node, collecting) => {
            const evos = []
            if (collecting && node.species.name !== parent.speciesName) {
              evos.push(node.species.name)
            }
            const startCollecting = collecting || node.species.name === parent.speciesName
            for (const child of node.evolves_to) {
              evos.push(...findEvolutions(child, startCollecting))
            }
            return evos
          }

          const evoNames = findEvolutions(chainData.chain, false)
          for (const evoName of evoNames) {
            if (parentNames.has(evoName)) {
              // Already a parent — merge pre-evo's methods so evolutions
              // inherit egg move availability from their baby form.
              // E.g. Mudkip has Avalanche as an egg move in Gen 5;
              // Marshtomp/Swampert inherit that egg move and are valid
              // chain-breed parents even if their own PokeAPI data only
              // lists the move via TM in later gens.
              const existing = parents.find(p => p.name === evoName)
              if (existing && !existing.viaEvolution) {
                for (const m of parent.methods) {
                  const alreadyHas = existing.methods.some(em =>
                    em.method === m.method &&
                    [...em.versionGroups].some(vg => m.versionGroups.has(vg))
                  )
                  if (!alreadyHas) {
                    existing.methods.push({ ...m, versionGroups: new Set(m.versionGroups) })
                  }
                }
              }
              continue
            }
            parentNames.add(evoName)

            try {
              const evoPoke = await fetchPokemonCached(evoName)
              if (!evoPoke) continue
              // Quick pre-filter: skip Gen 8+ (id >= 810) entirely to save fetches
              if (evoPoke.id >= 810) continue
              const evoSpecies = await fetchSpeciesCached(evoPoke.species?.name || evoName)
              if (!evoSpecies) continue

              const evoGroups = new Set((evoSpecies.egg_groups || []).map(g => g.name))
              if (evoGroups.has('no-eggs')) continue
              if (!isUndiscovered) {
                const shared = [...targetEggGroups].some(g => evoGroups.has(g))
                if (!shared) continue
              }

              // Inherit the pre-evo's methods since the evolved form retains the move
              const evoIntroGen = generationOrder[evoSpecies.generation?.name] || 99
              evoParents.push({
                name: evoName,
                speciesName: evoSpecies.name,
                methods: parent.methods.map(m => ({ ...m })),
                id: evoPoke.id,
                introGen: evoIntroGen,
                viaEvolution: parent.name, // track which pre-evo it came from
              })
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }

      parents.push(...evoParents)

      // Smeargle clause: Smeargle can Sketch almost any move and breed it.
      // Only applies if the target shares the Field egg group with Smeargle.
      // PokeAPI calls the Field egg group "ground".
      if (!parentNames.has('smeargle') && !isUndiscovered && targetEggGroups.has('ground')) {
        // Build version groups where the move CAN be Sketched (Gen 2-7, breeding-capable)
        const sketchVgs = new Set()
        for (let gen = 2; gen <= 7; gen++) {
          if (!isSketchable(moveName, gen)) continue
          const genVgs = generationVersionGroups[gen] || []
          for (const vg of genVgs) {
            if (!NO_BREEDING_VGS.has(vg)) sketchVgs.add(vg)
          }
        }
        if (sketchVgs.size > 0) {
          const smearglePoke = await fetchPokemonCached('smeargle')
          if (smearglePoke) {
            parents.push({
              name: 'smeargle',
              speciesName: 'smeargle',
              methods: [{ method: 'sketch', level: null, versionGroups: sketchVgs }],
              id: smearglePoke.id,
              introGen: 2, // Smeargle was introduced in Gen 2
            })
            parentNames.add('smeargle')
          }
        }
      }

      // Sort parents: by method priority, then by Pokedex number within each method
      const METHOD_PRIORITY = {
        'level-up': 1, 'machine': 2, 'tutor': 3, 'sketch': 4,
        'egg': 5, 'chain-breed': 5,
        'stadium-surfing-pikachu': 6, 'light-ball-egg': 6,
        'xd-purification': 7, 'colosseum-purification': 7, 'xd-shadow': 7,
        'form-change': 8,
      }
      const getPrimaryMethodPriority = (p) => {
        let best = 99
        p.methods.forEach(m => {
          const pri = METHOD_PRIORITY[m.method] ?? 90
          if (pri < best) best = pri
        })
        return best
      }
      parents.sort((a, b) => {
        const priA = getPrimaryMethodPriority(a)
        const priB = getPrimaryMethodPriority(b)
        if (priA !== priB) return priA - priB
        return (a.id || 999) - (b.id || 999)
      })

      setParentsByMove(prev => ({ ...prev, [moveName]: parents }))
    } catch (err) {
      console.error('Failed to fetch parents for', moveName, err)
      setParentsByMove(prev => ({ ...prev, [moveName]: [] }))
    } finally {
      setLoadingParents(prev => ({ ...prev, [moveName]: false }))
    }
  }, [speciesData, allEggGroups, parentsByMove])

  // Auto-fetch parents for all egg moves once they're loaded
  useEffect(() => {
    if (eggMoves.length === 0 || !speciesData) return
    eggMoves.forEach(m => {
      fetchParentsForMove(m.name)
    })
  }, [eggMoves, speciesData, allEggGroups]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand and scroll to a specific move if initialExpandMove was provided
  useEffect(() => {
    if (!expandMoveRef.current || scrolledToMoveRef.current) return
    if (eggMoves.length === 0) return
    const targetMove = expandMoveRef.current
    // Check the move exists in the egg moves list
    if (eggMoves.some(m => m.name === targetMove)) {
      setExpandedMoves(prev => ({ ...prev, [targetMove]: true }))
      // Scroll to the move row after a short delay to let DOM render
      scrolledToMoveRef.current = true
      setTimeout(() => {
        const row = document.querySelector(`[data-egg-move="${targetMove}"]`)
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [eggMoves])

  // Toggle egg move expansion
  const toggleMove = useCallback((moveName) => {
    setExpandedMoves(prev => ({ ...prev, [moveName]: !prev[moveName] }))
  }, [])

  // Filter egg moves to the selected version
  // Compute inheritedFrom dynamically: collect ALL pre-evo sources
  // that have the egg move in the selected gen's version groups
  const getFilteredEggMoves = () => {
    if (!selectedVersion || eggMoves.length === 0) return []

    const genVgs = getCompatibleGenVgs(selectedVersion)

    return eggMoves
      .filter(m => [...m.versionGroups].some(vg => genVgs.has(vg)))
      .map(m => {
        // Collect all distinct non-null sources that have VGs in the selected gen
        const matchingSources = m.sources
          .filter(s => s.from && [...s.versionGroups].some(vg => genVgs.has(vg)))
        const uniqueNames = [...new Set(matchingSources.map(s => s.from))]
        return { ...m, inheritedFrom: uniqueNames }
      })
  }

  const filteredMoves = getFilteredEggMoves()

  // Filter parents for selected version
  const getFilteredParents = (moveName) => {
    const parents = parentsByMove[moveName]
    if (!parents || parents.length === 0) return []

    const genVgs = getCompatibleGenVgs(selectedVersion)

    // Use the canonical transfer rules (Gen 1-2 only transfer to each other & Gen 7+, etc.)
    const vg = versionToVersionGroup[selectedVersion]
    const transferSourceVgs = getTransferSourceVersionGroups(selectedVersion, vg)

    const selectedGen = versionGeneration[selectedVersion]

    const filtered = parents
      .filter(parent => {
        // A parent can only appear if it existed in the selected generation.
        // E.g. Electivire (Gen 4) can't be a parent when viewing Gen 3.
        return !parent.introGen || parent.introGen <= selectedGen
      })
      .map(parent => {
        // Filter methods to those available in the selected gen
        // Separate non-egg (natural) methods from egg (chain breed) methods
        const currentGenNatural = parent.methods
          .filter(m => [...m.versionGroups].some(vg => genVgs.has(vg)))
          .filter(m => m.method !== 'egg')

        if (currentGenNatural.length > 0) {
          return { ...parent, methods: currentGenNatural }
        }

        // Check transfer natural methods BEFORE chain-breed, since a parent
        // that learns the move via tutor/purification in a prior gen is more
        // informative than one that only has it as an egg move in this gen
        if (transferSourceVgs) {
          const transferNatural = parent.methods
            .filter(m => [...m.versionGroups].some(v => transferSourceVgs.has(v)))
            .filter(m => m.method !== 'egg')
            .map(m => ({
              ...m,
              isTransfer: true,
              versionGroups: new Set([...m.versionGroups].filter(v => transferSourceVgs.has(v))),
            }))

          if (transferNatural.length > 0) {
            return { ...parent, methods: transferNatural, isTransfer: true }
          }
        }

        // Check for chain-breed: parent learns the move as an egg move in this gen
        const currentGenEgg = parent.methods
          .filter(m => [...m.versionGroups].some(vg => genVgs.has(vg)))
          .filter(m => m.method === 'egg')
          .map(m => ({ ...m, method: 'chain-breed' }))

        if (currentGenEgg.length > 0) {
          return { ...parent, methods: currentGenEgg, isChainBreed: true }
        }

        // Transfer chain-breed: parent learned it as egg move in a prior gen
        if (transferSourceVgs) {
          const transferEgg = parent.methods
            .filter(m => [...m.versionGroups].some(v => transferSourceVgs.has(v)))
            .filter(m => m.method === 'egg')
            .map(m => ({
              ...m,
              method: 'chain-breed',
              isTransfer: true,
              versionGroups: new Set([...m.versionGroups].filter(v => transferSourceVgs.has(v))),
            }))

          if (transferEgg.length > 0) {
            return { ...parent, methods: transferEgg, isTransfer: true, isChainBreed: true }
          }
        }

        return null
      })
      .filter(Boolean)

    // Detect transfer-only chain breeds: if NO parent can provide the move
    // natively in the current gen (all non-chain-breed parents require transfer),
    // then chain-breed parents are also transfer-dependent.
    const hasNativeSource = filtered.some(p => !p.isTransfer && !p.isChainBreed)
    if (!hasNativeSource) {
      filtered.forEach(p => {
        if (p.isChainBreed && !p.isTransfer) {
          p.isTransferDependent = true
        }
      })
    }

    return filtered
      .sort((a, b) => {
        const METHOD_PRIORITY = {
          'level-up': 1, 'machine': 2, 'tutor': 3, 'sketch': 4,
          'chain-breed': 5,
          'stadium-surfing-pikachu': 6, 'light-ball-egg': 6,
          'xd-purification': 7, 'colosseum-purification': 7, 'xd-shadow': 7,
          'form-change': 8,
        }
        const pri = (p) => {
          let best = 99
          p.methods.forEach(m => {
            const v = METHOD_PRIORITY[m.method] ?? 90
            if (v < best) best = v
          })
          return best
        }
        const pa = pri(a), pb = pri(b)
        if (pa !== pb) return pa - pb
        return (a.id || 999) - (b.id || 999)
      })
  }

  // Count distinct learn methods across all parents for an egg move
  const getDistinctMethodCount = (moveName) => {
    const parents = getFilteredParents(moveName)
    if (parents.length === 0) return 0
    const methodSet = new Set()
    parents.forEach(p => p.methods.forEach(m => methodSet.add(m.method)))
    return methodSet.size
  }

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
  }

  const sortedMoves = [...filteredMoves].sort((a, b) => {
    let result = 0
    switch (sortConfig.key) {
      case 'move':
        result = a.name.localeCompare(b.name)
        break
      case 'parents': {
        const aParents = getFilteredParents(a.name)
        const bParents = getFilteredParents(b.name)
        result = (aParents.length || 0) - (bParents.length || 0)
        break
      }
      case 'methods': {
        result = getDistinctMethodCount(a.name) - getDistinctMethodCount(b.name)
        break
      }
      default:
        result = a.name.localeCompare(b.name)
    }
    return sortConfig.direction === 'asc' ? result : -result
  })

  // Expand/collapse all
  const handleExpandAll = () => {
    const allExpanded = sortedMoves.every(m => expandedMoves[m.name])
    if (allExpanded) {
      setExpandedMoves({})
      setTableFullyExpanded(false)
    } else {
      const expanded = {}
      sortedMoves.forEach(m => {
        expanded[m.name] = true
      })
      setExpandedMoves(expanded)
      setTableFullyExpanded(true)
    }
  }

  // Format method for display
  const formatMethod = (method, level) => {
    if (method === 'level-up' && level != null) return `Level ${level}`
    if (method === 'level-up') return 'Level Up'
    if (method === 'machine') return 'TM/HM'
    if (method === 'tutor') return 'Tutor'
    if (method === 'chain-breed') return 'Chain Breed'
    if (method === 'sketch') return 'Sketch'
    if (method === 'xd-purification') return 'Purification'
    if (method === 'colosseum-purification') return 'Purification'
    if (method === 'xd-shadow') return 'Shadow'
    if (method === 'form-change') return 'Form Change'
    if (method === 'light-ball-egg') return 'Light Ball Egg'
    if (method === 'stadium-surfing-pikachu') return 'Surfing Pikachu'
    return formatName(method)
  }

  // Get version group tags for a method's versionGroups
  const renderMethodVgs = (vgs) => {
    const genVgs = getCompatibleGenVgs(selectedVersion)
    const filtered = [...vgs].filter(vg => genVgs.has(vg)).sort((a, b) => (versionGroupOrder[a] || 0) - (versionGroupOrder[b] || 0))
    if (filtered.length === genVgs.size) return null // All version groups — don't show tags
    return filtered.map(vg => versionGroupDisplayNames[vg] || vg).join(', ')
  }

  const handleSearchNavigate = useCallback((category, name) => {
    if (category === 'pokemon') {
      loadPokemon(name)
    } else if (onUnifiedNavigate) {
      onUnifiedNavigate(category, name)
    }
  }, [loadPokemon, onUnifiedNavigate])

  return (
    <div className="location-page egg-move-page">
      {/* Search + Version row */}
      <div className="page-search-row">
        {pokemonData && availableVersions.length > 0 && (
          <div className="page-version-inline">
            <label htmlFor="eggmove-version-select">Version:</label>
            <select
              id="eggmove-version-select"
              value={selectedVersion || ''}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="version-dropdown"
            >
              {availableVersions.map((group, idx) => {
                const genLabel = group[0]?.gen ? `Gen ${group[0].gen}` : 'Other'
                return (
                  <optgroup key={`${genLabel}-${idx}`} label={genLabel}>
                    {group.map(({ display, name }) => (
                      <option key={name} value={name}>{display}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>
        )}
        <div className="page-search-inline">
          <UnifiedSearch
            lists={searchLists}
            onNavigate={handleSearchNavigate}
            activeTab="eggmoves"
            initialQuery={initialPokemon || ''}
            loading={loadingPokemon}
          />
        </div>
      </div>

      {error && !loadingPokemon && eggMoves.length === 0 && <div className="error">{error}</div>}
      {loadingPokemon && <div className="loading"><video src="/simple_pokeball.webm" autoPlay loop muted className="loading-pokeball" /></div>}

      {pokemonData && eggMoves.length > 0 && (
        <>
          {/* Pokemon info header */}
          <div className="location-detail-card">
            <div className="location-detail-header">
              <h2 className="location-detail-name">{formatName(pokemonData.name)}</h2>
              {speciesData?.egg_groups && (
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Egg Groups: {speciesData.egg_groups.map(g => formatName(g.name)).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Egg Moves Table */}
          {selectedVersion ? (
            sortedMoves.length > 0 ? (
              <div className="location-encounters-section">
                <div className="location-encounters-header">
                  <h3>Egg Moves ({sortedMoves.length})</h3>
                  {sortedMoves.length > 1 && (
                    <button
                      type="button"
                      className="expand-toggle"
                      title={sortedMoves.every(m => expandedMoves[m.name]) ? 'Collapse all' : 'Expand all'}
                      onClick={handleExpandAll}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {sortedMoves.every(m => expandedMoves[m.name]) ? (
                          <line x1="5" y1="12" x2="19" y2="12" />
                        ) : (
                          <>
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </>
                        )}
                      </svg>
                    </button>
                  )}
                </div>
                <div className="location-encounters-table-wrapper" style={tableFullyExpanded ? { maxHeight: 'none' } : undefined}>
                  <table className="location-encounters-table egg-move-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35%' }}>
                          <button type="button" onClick={() => handleSort('move')}>
                            Egg Move{getSortIndicator('move')}
                          </button>
                        </th>
                        <th style={{ width: '15%' }}>
                          <button type="button" onClick={() => handleSort('parents')}>
                            Parents{getSortIndicator('parents')}
                          </button>
                        </th>
                        <th style={{ width: '15%' }}>
                          <button type="button" onClick={() => handleSort('methods')}>
                            Methods{getSortIndicator('methods')}
                          </button>
                        </th>
                        <th style={{ width: '20%' }}>Type</th>
                        <th style={{ width: '15%' }}>Power</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMoves.map(eggMove => {
                        const isExpanded = !!expandedMoves[eggMove.name]
                        const parents = getFilteredParents(eggMove.name)
                        const isLoadingParents = !!loadingParents[eggMove.name]
                        const rows = []

                        // Header row for the egg move
                        rows.push(
                          <tr
                            key={eggMove.name}
                            data-egg-move={eggMove.name}
                            className="location-header-row"
                            onClick={() => toggleMove(eggMove.name)}
                          >
                            <td className="location-pokemon-cell">
                              <span className="location-toggle">{isExpanded ? '▾' : '▸'}</span>
                              {onMoveClick ? (
                                <button
                                  type="button"
                                  className="pokemon-name-link"
                                  onClick={(e) => { e.stopPropagation(); onMoveClick(eggMove.name) }}
                                >
                                  {formatName(eggMove.name)}
                                </button>
                              ) : (
                                formatName(eggMove.name)
                              )}
                              {eggMove.inheritedFrom?.length > 0 && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'italic' }}>
                                  via {eggMove.inheritedFrom.map(n => formatName(n)).join(' / ')}
                                </span>
                              )}
                            </td>
                            <td className="location-method-cell" style={{ color: 'var(--text-muted)' }}>
                              {parentsByMove[eggMove.name]
                                ? `${parents.length} parent${parents.length !== 1 ? 's' : ''}`
                                : <video src="/simple_pokeball.webm" autoPlay loop muted className="egg-move-inline-loader" />
                              }
                            </td>
                            <td className="location-method-cell" style={{ color: 'var(--text-muted)' }}>
                              {parentsByMove[eggMove.name]
                                ? (() => {
                                    const count = getDistinctMethodCount(eggMove.name)
                                    return `${count} method${count !== 1 ? 's' : ''}`
                                  })()
                                : <video src="/simple_pokeball.webm" autoPlay loop muted className="egg-move-inline-loader" />
                              }
                            </td>
                            <td className="egg-move-type-cell">
                              <MoveTypeCell moveName={eggMove.name} />
                            </td>
                            <td className="egg-move-power-cell">
                              <MovePowerCell moveName={eggMove.name} />
                            </td>
                          </tr>
                        )

                        // Expanded parent rows
                        if (isExpanded) {
                          if (isLoadingParents) {
                            rows.push(
                              <tr key={`${eggMove.name}-loading`} className="location-detail-row">
                                <td colSpan="5" style={{ textAlign: 'center', padding: '8px' }}>
                                  <video src="/simple_pokeball.webm" autoPlay loop muted className="egg-move-inline-loader" />
                                </td>
                              </tr>
                            )
                          } else if (parents.length === 0 && parentsByMove[eggMove.name]) {
                            rows.push(
                              <tr key={`${eggMove.name}-none`} className="location-detail-row">
                                <td colSpan="5" style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>
                                  No compatible parents in this version
                                </td>
                              </tr>
                            )
                          } else {
                            parents.forEach((parent, idx) => {
                              const methodLabels = parent.methods.map(m => {
                                const label = formatMethod(m.method, m.level)
                                if (m.isTransfer) {
                                  // Show source version groups from past gens with Transfer tag
                                  const vgs = [...m.versionGroups]
                                    .sort((a, b) => (versionGroupOrder[a] || 0) - (versionGroupOrder[b] || 0))
                                  const vgLabel = vgs.map(vg => versionGroupDisplayNames[vg] || vg).join(', ')
                                  return vgLabel ? `${label} (${vgLabel}) [Transfer]` : `${label} [Transfer]`
                                }
                                // Transfer-dependent chain breed: the egg move itself
                                // can only originate from transferred Pokémon
                                if (parent.isTransferDependent && m.method === 'chain-breed') {
                                  const vgLabel = renderMethodVgs(m.versionGroups)
                                  return vgLabel ? `${label} (${vgLabel}) [Transfer]` : `${label} [Transfer]`
                                }
                                const vgLabel = renderMethodVgs(m.versionGroups)
                                return vgLabel ? `${label} (${vgLabel})` : label
                              })
                              // If this parent is an evolution of a learner, note that
                              const evoNote = parent.viaEvolution
                                ? ` (via ${formatName(parent.viaEvolution)})`
                                : ''

                              rows.push(
                                <tr key={`${eggMove.name}-${parent.name}-${idx}`} className="location-detail-row">
                                  <td></td>
                                  <td className="location-pokemon-cell egg-parent-cell">
                                    {onPokemonClick ? (
                                      <button
                                        type="button"
                                        className="pokemon-name-link"
                                        onClick={() => onPokemonClick(parent.name, selectedVersion)}
                                      >
                                        {formatName(parent.name)}
                                      </button>
                                    ) : (
                                      formatName(parent.name)
                                    )}
                                  </td>
                                  <td className="egg-parent-method-cell" colSpan="3">
                                    {methodLabels.join(', ')}{evoNote}
                                  </td>
                                </tr>
                              )
                            })
                          }
                        }

                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="location-no-encounters">No egg moves available in this version.</div>
            )
          ) : (
            <div className="location-no-encounters">Select a version to see egg moves.</div>
          )}
        </>
      )}
    </div>
  )
}

// Small helper components that lazy-fetch move data for type/power display
function MoveTypeCell({ moveName }) {
  const [type, setType] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchMoveCached(moveName).then(data => {
      if (!cancelled && data) setType(data.type?.name || null)
    })
    return () => { cancelled = true }
  }, [moveName])
  if (!type) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{
      backgroundColor: getTypeColor(type),
      color: getTypeTextColor(type),
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
      overflow: 'hidden',
    }}>
      {formatName(type)}
    </span>
  )
}

function MovePowerCell({ moveName }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchMoveCached(moveName).then(data => {
      if (!cancelled && data) setInfo({ power: data.power, category: data.damage_class?.name })
    })
    return () => { cancelled = true }
  }, [moveName])
  if (!info) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <span>{info.power || '—'}</span>
}
