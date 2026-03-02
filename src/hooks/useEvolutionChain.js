import { useState, useEffect } from 'react'
import { fetchPokemonCached } from '../utils/pokeCache'

const speciesCache = new Map()

async function fetchSpeciesByName(speciesName) {
  if (speciesCache.has(speciesName)) return speciesCache.get(speciesName)
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesName}/`)
    if (!res.ok) return null
    const data = await res.json()
    speciesCache.set(speciesName, data)
    return data
  } catch (err) {
    console.error('Failed to fetch species:', speciesName, err)
    return null
  }
}

function formatEvolutionDetail(detail) {
  if (!detail?.trigger?.name) return 'Unknown'

  const parts = []
  const trigger = detail.trigger.name

  if (trigger === 'level-up') {
    parts.push('Level up')
    if (detail.min_level) parts.push(`L${detail.min_level}`)
    if (detail.time_of_day) parts.push(`(${detail.time_of_day})`)
    if (detail.held_item?.name) parts.push(`holding ${detail.held_item.name.replace(/-/g, ' ')}`)
    if (detail.known_move?.name) parts.push(`knowing ${detail.known_move.name.replace(/-/g, ' ')}`)
    if (detail.known_move_type?.name) parts.push(`knowing a ${detail.known_move_type.name} move`)
    if (detail.location?.name) parts.push(`at ${detail.location.name.replace(/-/g, ' ')}`)
    if (detail.min_happiness) parts.push(`happiness ${detail.min_happiness}`)
    if (detail.min_affection) parts.push(`affection ${detail.min_affection}`)
    if (detail.min_beauty) parts.push(`beauty ${detail.min_beauty}`)
    if (detail.party_species?.name) parts.push(`with ${detail.party_species.name} in party`)
    if (detail.party_type?.name) parts.push(`with ${detail.party_type.name} type in party`)
    if (detail.needs_overworld_rain) parts.push(`(raining)`)
    if (detail.turn_upside_down) parts.push(`(turn device upside down)`)
    if (detail.gender === 1) parts.push(`(female)`)
    if (detail.gender === 2) parts.push(`(male)`)
    if (typeof detail.relative_physical_stats === 'number') {
      const rps = detail.relative_physical_stats
      if (rps === 1) parts.push('(Atk > Def)')
      if (rps === 0) parts.push('(Atk = Def)')
      if (rps === -1) parts.push('(Atk < Def)')
    }
    return parts.join(' ')
  }

  if (trigger === 'use-item') {
    parts.push('Use')
    if (detail.item?.name) parts.push(detail.item.name.replace(/-/g, ' '))
    if (detail.time_of_day) parts.push(`(${detail.time_of_day})`)
    return parts.join(' ')
  }

  if (trigger === 'trade') {
    parts.push('Trade')
    if (detail.held_item?.name) parts.push(`holding ${detail.held_item.name.replace(/-/g, ' ')}`)
    if (detail.trade_species?.name) parts.push(`for ${detail.trade_species.name}`)
    return parts.join(' ')
  }

  if (trigger === 'shed') return 'Shed'
  if (trigger === 'other') return 'Special'

  return trigger.replace(/-/g, ' ')
}

function formatEvolutionDetails(details) {
  if (!Array.isArray(details) || details.length === 0) return 'Unknown'
  return details.map(formatEvolutionDetail).join(' OR ')
}

// Map version groups to individual version names (for Gen 6+ where game_indices is empty)
const versionGroupToVersions = {
  'red-blue': ['red', 'blue'],
  'yellow': ['yellow'],
  'gold-silver': ['gold', 'silver'],
  'crystal': ['crystal'],
  'ruby-sapphire': ['ruby', 'sapphire'],
  'emerald': ['emerald'],
  'firered-leafgreen': ['firered', 'leafgreen'],
  'colosseum': ['colosseum'],
  'xd': ['xd'],
  'diamond-pearl': ['diamond', 'pearl'],
  'platinum': ['platinum'],
  'heartgold-soulsilver': ['heartgold', 'soulsilver'],
  'black-white': ['black', 'white'],
  'black-2-white-2': ['black-2', 'white-2'],
  'x-y': ['x', 'y'],
  'omega-ruby-alpha-sapphire': ['omega-ruby', 'alpha-sapphire'],
  'sun-moon': ['sun', 'moon'],
  'ultra-sun-ultra-moon': ['ultra-sun', 'ultra-moon'],
  'lets-go-pikachu-lets-go-eevee': ['lets-go-pikachu', 'lets-go-eevee'],
  'sword-shield': ['sword', 'shield'],
  'brilliant-diamond-shining-pearl': ['brilliant-diamond', 'shining-pearl'],
  'legends-arceus': ['legends-arceus'],
  'scarlet-violet': ['scarlet', 'violet'],
  'the-teal-mask': ['scarlet', 'violet'],
  'the-indigo-disk': ['scarlet', 'violet'],
  'legends-za': ['legends-za'],
  'mega-dimension': ['legends-za'],
  'the-isle-of-armor': ['sword', 'shield'],
  'the-crown-tundra': ['sword', 'shield'],
}

// Region suffixes we recognise, in priority order
const REGION_SUFFIXES = ['alola', 'galar', 'hisui', 'paldea']

/**
 * Map region suffixes to the generation that introduced them.
 * Used to detect regional-exclusive evolved species (e.g. Obstagoon gen 8 = Galar gen 8).
 */
const REGION_GENERATION = {
  'alola': 7,
  'galar': 8,
  'hisui': 8,
  'paldea': 9,
}

/**
 * Parse a generation number from the API's generation name string.
 * e.g. "generation-viii" → 8
 */
function parseGeneration(genName) {
  if (!genName) return 0
  const roman = genName.replace('generation-', '')
  const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }
  return map[roman] || 0
}

/**
 * Items / methods that are exclusively for regional form evolutions. When the
 * base form is selected these methods should NOT appear in the evolution tree
 * because they only apply when evolving the regional variant.
 *
 * The key is the item/trigger identifier from the API; the value is which
 * regional suffix it belongs to so we can match it to forms.
 */
const REGIONAL_ITEMS = {
  'galarica-cuff': 'galar',
  'galarica-wreath': 'galar',
}

/**
 * Some evolutions use an overlapping trigger (same item for base AND regional,
 * or same level-up) but the second method in evolution_details is the regional
 * version.  We handle those by checking if the evolved species has a regional
 * variant AND an evolution_details array > 1 where one method maps to a
 * regional item or trigger.
 */

/**
 * Return the regional suffix for a pokemon name, or null.
 * e.g. "slowpoke-galar" → "galar", "raichu-alola" → "alola"
 */
function getRegionSuffix(pokemonName) {
  if (!pokemonName) return null
  for (const suffix of REGION_SUFFIXES) {
    if (pokemonName.endsWith('-' + suffix)) return suffix
  }
  return null
}

/**
 * Given a species name and a region suffix, check if that species has a
 * regional variant — i.e. a variety named `<species>-<region>`.
 */
async function getRegionalVariantName(speciesName, regionSuffix) {
  const sp = await fetchSpeciesByName(speciesName)
  if (!sp?.varieties) return null
  const target = `${speciesName}-${regionSuffix}`
  const match = sp.varieties.find(v => v.pokemon?.name === target)
  return match ? target : null
}

/**
 * Check if an evolution detail is identifiably for a regional form.
 *
 * Returns the region suffix string (e.g. 'galar', 'hisui') if the detail
 * uses a known regional item or trigger, or null for unidentifiable methods.
 */
function isRegionalEvolutionDetail(detail) {
  // Check if evolution uses a known regional item
  const itemName = detail.item?.name || detail.held_item?.name
  if (itemName && REGIONAL_ITEMS[itemName]) return REGIONAL_ITEMS[itemName]

  // Triggers that are exclusively Hisui mechanics
  const trigger = detail.trigger?.name
  if (trigger === 'agile-style-move' || trigger === 'strong-style-move') return 'hisui'
  if (trigger === 'recoil-damage') return 'hisui'
  if (trigger === 'three-critical-hits') return 'galar'

  return null
}

/**
 * For Pokémon whose evolution_details contain BOTH base and regional methods
 * from the API (e.g. Slowpoke → Slowbro has [Level 37, Galarica Cuff]),
 * split the details into base-only and regional-only sets.
 *
 * When isTypeA is true (both pre-evo and evo have regional variants), we use
 * two strategies:
 *   1. Item/trigger identification (explicit regional markers)
 *   2. Positional fallback: the API lists the base method first and regional
 *      method(s) second, so when no explicit markers are found we split by
 *      position — first detail = base, rest = regional.
 */
function splitEvolutionDetails(details, isTypeA = false) {
  if (!Array.isArray(details) || details.length <= 1) {
    return { baseDetails: details || [], regionalDetails: [], regionalSuffix: null }
  }

  const baseDetails = []
  const regionalDetails = []
  let regionalSuffix = null

  // First pass: try to identify regional details by item/trigger
  for (const d of details) {
    const region = isRegionalEvolutionDetail(d)
    if (region) {
      regionalDetails.push(d)
      regionalSuffix = region
    } else {
      baseDetails.push(d)
    }
  }

  // If we found explicit regional markers, use them
  if (regionalDetails.length > 0) {
    return { baseDetails, regionalDetails, regionalSuffix }
  }

  // Positional fallback for Type A species with multiple methods but no
  // identifiable regional markers (e.g. Darumaka [Level 35, Use ice-stone],
  // Cubone [Level 28, Level 28 (night)]).  The API consistently places the
  // base method first and the regional method second.
  if (isTypeA && details.length >= 2) {
    return {
      baseDetails: [details[0]],
      regionalDetails: details.slice(1),
      regionalSuffix: 'positional'
    }
  }

  return { baseDetails: details, regionalDetails: [], regionalSuffix: null }
}

function pokemonAvailableInVersion(pokemonData, version) {
  if (!pokemonData || !version) return false
  // Check game_indices (works for Gen 1-5)
  if (pokemonData.game_indices?.some(gi => gi.version?.name === version)) return true
  // Check moves version_group_details (works for all gens)
  if (pokemonData.moves) {
    for (const move of pokemonData.moves) {
      for (const vgd of (move.version_group_details || [])) {
        const vgName = vgd.version_group?.name
        const versions = versionGroupToVersions[vgName]
        if (versions?.includes(version)) return true
      }
    }
  }
  return false
}

export function useEvolutionChain({ species, selectedVersion, selectedForm }) {
  const [tree, setTree] = useState([])

  useEffect(() => {
    if (!species?.evolution_chain?.url) return
    let active = true

    // Detect which regional line we're currently viewing (if any)
    const activeRegion = getRegionSuffix(selectedForm)

    const checkSpeciesAvailableInVersion = async (speciesName) => {
      if (!selectedVersion) return true

      const sp = await fetchSpeciesByName(speciesName)
      if (!sp?.varieties?.length) return true

      const varieties = sp.varieties.map(v => v.pokemon?.name).filter(Boolean)

      const results = await Promise.all(
        varieties.map(async (vname) => {
          const p = await fetchPokemonCached(vname)
          if (!p) return false
          return pokemonAvailableInVersion(p, selectedVersion)
        })
      )

      return results.some(Boolean)
    }

    /**
     * Determines what display name to use for a species node in the evo tree.
     *
     * Type A — the base species itself has a regional variant (e.g. slowpoke-galar):
     *   When activeRegion matches, use the regional variant name in the tree.
     *
     * Type B — only the evolved species has a regional variant (e.g. raichu-alola,
     *   marowak-alola): the pre-evolution stays as-is, the evolved form gets an
     *   additional branch.
     */
    const resolveDisplayName = async (speciesName) => {
      if (!activeRegion) return speciesName
      const regionalName = await getRegionalVariantName(speciesName, activeRegion)
      return regionalName || speciesName
    }

    /**
     * Build an evolution tree node.
     *
     * When a regional form is selected (activeRegion is set):
     *   - Type A species: use regional variant names, show only regional methods
     *   - Type B evolved species: add as extra branch under base pre-evo
     *   - Regional-exclusive species (e.g. Obstagoon, Overqwil): include only
     *     when activeRegion is set and pre-evo is regional
     *
     * When base form is selected (activeRegion is null):
     *   - Strip regional-only methods from evolution_details
     *   - Add Type B branches (species whose evolved form has a regional variant
     *     but the pre-evo does NOT)
     */
    const buildNodes = async (chainNode, forceBaseName = false) => {
      if (!active || !chainNode?.species?.name) return []

      const speciesName = chainNode.species.name
      const displayName = forceBaseName ? speciesName : await resolveDisplayName(speciesName)

      const childEdges = []

      for (const evo of chainNode.evolves_to || []) {
        const evoSpeciesName = evo.species.name

        // Determine if this evolved species has its own regional variant (Type A at this stage)
        const evoSp = await fetchSpeciesByName(evoSpeciesName)
        const evoHasOwnRegionalVariant = (variantSuffix) => {
          if (!variantSuffix || !evoSp?.varieties) return false
          return evoSp.varieties.some(v => v.pokemon?.name === `${evoSpeciesName}-${variantSuffix}`)
        }

        // Check if the pre-evo species has a regional variant (determines Type A vs Type B)
        const preEvoSp = await fetchSpeciesByName(speciesName)
        const preEvoHasRegionalVariant = (variantSuffix) => {
          if (!variantSuffix || !preEvoSp?.varieties) return false
          return preEvoSp.varieties.some(v => v.pokemon?.name === `${speciesName}-${variantSuffix}`)
        }

        // Determine Type A: both pre-evo AND evo have a regional variant for any region
        // This is needed before splitting so the positional fallback can kick in
        const isTypeA = REGION_SUFFIXES.some(
          suffix => preEvoHasRegionalVariant(suffix) && evoHasOwnRegionalVariant(suffix)
        )

        const { baseDetails, regionalDetails, regionalSuffix } = splitEvolutionDetails(evo.evolution_details, isTypeA)

        if (activeRegion) {
          // === REGIONAL FORM SELECTED ===

          // Check if the pre-evo itself has a regional variant for this region
          const preEvoIsRegional = preEvoHasRegionalVariant(activeRegion)
          const evoIsRegional = evoHasOwnRegionalVariant(activeRegion)

          if (preEvoIsRegional && evoIsRegional) {
            // Type A — both pre-evo and evo have regional variants.
            // Show regional methods and use regional display names.
            const childRoots = await buildNodes(evo)
            const detailsToUse = regionalDetails.length > 0 ? regionalDetails : evo.evolution_details
            for (const child of childRoots) {
              childEdges.push({
                triggerText: formatEvolutionDetails(detailsToUse),
                node: child
              })
            }
          } else if (preEvoIsRegional && !evoIsRegional) {
            // Pre-evo has a regional variant but the evo does NOT.
            // Two sub-cases:
            //   a) Evo is a regional-exclusive new species (e.g. Obstagoon, Runerigus,
            //      Perrserker, Cursola, Mr. Rime, Sirfetch'd) — introduced in the
            //      same generation as the regional form → INCLUDE in regional line
            //   b) Evo is an older base-form species (e.g. Cofagrigus for Yamask,
            //      Persian for Meowth) — introduced before the regional form → EXCLUDE
            //
            // Additional constraint: for pre-evos with multiple regional variants
            // (e.g. Meowth has -alola and -galar), we must confirm the evo belongs
            // to THIS region specifically. We do this by matching the evo's intro
            // generation to the activeRegion's generation.
            const evoGen = parseGeneration(evoSp?.generation?.name)
            const regionGen = REGION_GENERATION[activeRegion] || 0

            if (evoGen === regionGen) {
              // Regional-exclusive new species from THIS region — include it
              const childRoots = await buildNodes(evo)
              for (const child of childRoots) {
                childEdges.push({
                  triggerText: formatEvolutionDetails(evo.evolution_details),
                  node: child
                })
              }
            }
            // else: base-form evolution — skip in regional view
          } else if (!preEvoIsRegional && evoIsRegional) {
            // Type B: pre-evo is base, but evolved form has a regional variant
            // Show the regional branch (e.g. Pikachu → Raichu-Alola)
            const regionalEvoName = `${evoSpeciesName}-${activeRegion}`
            const regionalAvailable = await checkSpeciesAvailableInVersion(evoSpeciesName)
            if (regionalAvailable) {
              const detailsToUse = regionalDetails.length > 0 ? regionalDetails : evo.evolution_details
              childEdges.push({
                triggerText: formatEvolutionDetails(detailsToUse),
                node: { name: regionalEvoName, url: evo.species.url, children: [] }
              })
            }
            // Also include base child for Type B (base form still exists alongside)
            // forceBaseName=true prevents resolveDisplayName from renaming the
            // base evo to the regional name (which would cause duplicates)
            const baseChildRoots = await buildNodes(evo, true)
            const baseDetailsToUse = baseDetails.length > 0 ? baseDetails : evo.evolution_details
            for (const child of baseChildRoots) {
              childEdges.push({
                triggerText: formatEvolutionDetails(baseDetailsToUse),
                node: child
              })
            }
          } else {
            // Neither pre-evo nor evo have regional variants for activeRegion.
            // This can happen when the selectedForm is a regional form for a
            // species not in this part of the chain (e.g. viewing raichu-alola
            // but pichu→pikachu link). Include normally.
            const evoAvailable = await checkSpeciesAvailableInVersion(evoSpeciesName)
            if (evoAvailable) {
              const childRoots = await buildNodes(evo)
              for (const child of childRoots) {
                childEdges.push({
                  triggerText: formatEvolutionDetails(evo.evolution_details),
                  node: child
                })
              }
            }
          }
        } else {
          // === BASE FORM SELECTED ===

          // Check if this evolved species is a regional-exclusive new species
          // (e.g. Runerigus from G-Yamask, Obstagoon from G-Linoone, Perrserker
          // from G-Meowth). These should NOT appear in the base form evolution line.
          // Detection: evolved species has no regional variant, but the pre-evo
          // DOES have a regional variant, and the evo was introduced in the same
          // generation as (or after) the regional form.
          let isRegionalExclusive = false
          for (const suffix of REGION_SUFFIXES) {
            if (preEvoHasRegionalVariant(suffix) && !evoHasOwnRegionalVariant(suffix)) {
              const evoGen = parseGeneration(evoSp?.generation?.name)
              const regionGen = REGION_GENERATION[suffix] || 0
              if (evoGen >= regionGen) {
                isRegionalExclusive = true
                break
              }
            }
          }

          if (isRegionalExclusive) {
            // Skip regional-exclusive species in base form view
            // (they only exist for the regional variant line)
          } else {
            // Filter out regional-only methods, keep base methods
            const detailsToShow = baseDetails.length > 0 && regionalDetails.length > 0
              ? baseDetails
              : evo.evolution_details

            const childRoots = await buildNodes(evo)
            for (const child of childRoots) {
              childEdges.push({
                triggerText: formatEvolutionDetails(detailsToShow),
                node: child
              })
            }

            // Type B branches: if the evolved species has a regional variant but
            // the current (pre-evo) species does NOT, add the regional form as
            // an extra branch when it's available in the selected version.
            if (selectedVersion) {
              for (const suffix of REGION_SUFFIXES) {
                if (evoHasOwnRegionalVariant(suffix) && !preEvoHasRegionalVariant(suffix)) {
                  const regionalEvoName = `${evoSpeciesName}-${suffix}`
                  const regPokemon = await fetchPokemonCached(regionalEvoName)
                  if (regPokemon && pokemonAvailableInVersion(regPokemon, selectedVersion)) {
                    // Find the regional method for this suffix
                    const { regionalDetails: regDets } = splitEvolutionDetails(evo.evolution_details, false)
                    const triggerDets = regDets.length > 0 ? regDets : evo.evolution_details
                    childEdges.push({
                      triggerText: formatEvolutionDetails(triggerDets),
                      node: { name: regionalEvoName, url: evo.species.url, children: [] }
                    })
                  }
                }
              }
            }
          }
        }
      }

      const ok = await checkSpeciesAvailableInVersion(speciesName)
      if (!ok) {
        return childEdges.map(edge => edge.node)
      }

      return [{ name: displayName, url: chainNode.species.url, children: childEdges }]
    }

    const run = async () => {
      try {
        const res = await fetch(species.evolution_chain.url)
        const data = await res.json()
        const built = await buildNodes(data.chain)
        if (active) setTree(built)
      } catch (e) {
        console.error('Failed to fetch evolution chain:', e)
        if (active) setTree([])
      }
    }

    run()
    return () => { active = false }
  }, [species?.evolution_chain?.url, selectedVersion, selectedForm])

  return tree
}
