// Builds the evolution tree for one Pokémon in one game from PokéAPI's
// evolution chain. Each evolution method in the API says which form it needs,
// which form it produces, the region it is tied to and the game that
// introduced it; this module turns that into "what can you actually do in the
// selected game, starting from the form being viewed".

import {
  versionGroupOrder, versionGroupToVersions, versionGeneration, versionHasDayNight,
  versionRegions, versionGroupRegions, latestVersionGroupOrder, gameIndexMeansAvailable,
  generationVersions, isSupportedVersion, canTradeBetween,
} from './versionInfo'

// Shown for an evolution that exists in the selected game's Pokédex but
// cannot be performed there (e.g. Magnezone in HeartGold).
export const NOT_POSSIBLE_HERE = 'Not possible in this game'

// ── Method text ──────────────────────────────────────────────────────────

export function formatEvolutionDetail(detail, hasDayNight = true) {
  if (!detail?.trigger?.name) return 'Unknown'

  const parts = []
  const trigger = detail.trigger.name

  if (trigger === 'level-up') {
    parts.push('Level up')
    if (detail.min_level) parts.push(`L${detail.min_level}`)
    if (detail.time_of_day && hasDayNight) parts.push(`(${detail.time_of_day})`)
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
    if (detail.time_of_day && hasDayNight) parts.push(`(${detail.time_of_day})`)
    return parts.join(' ')
  }

  if (trigger === 'trade') {
    parts.push('Trade')
    if (detail.held_item?.name) parts.push(`holding ${detail.held_item.name.replace(/-/g, ' ')}`)
    if (detail.trade_species?.name) parts.push(`for ${detail.trade_species.name}`)
    return parts.join(' ')
  }

  if (trigger === 'shed') return 'Shed'
  // The API renamed the catch-all 'other' trigger to 'unclassified' (Sept 2026)
  if (trigger === 'other' || trigger === 'unclassified') return 'Special'
  if (trigger === 'meltan-candies') return '400 Meltan Candy in Pokémon GO'

  // Gen 8 triggers
  if (trigger === 'spin') return 'Spin holding a Sweet'
  if (trigger === 'three-critical-hits') return 'Land 3 critical hits in one battle'
  if (trigger === 'take-damage') return 'Take 49+ damage and travel under the stone bridge in Dusty Bowl'
  if (trigger === 'tower-of-darkness') return 'Train in the Tower of Darkness'
  if (trigger === 'tower-of-waters') return 'Train in the Tower of Waters'

  return trigger.replace(/-/g, ' ')
}

export function formatEvolutionDetails(details, hasDayNight = true) {
  if (!Array.isArray(details) || details.length === 0) return 'Unknown'
  const seen = new Set()
  const unique = details.map(d => formatEvolutionDetail(d, hasDayNight)).filter(t => !seen.has(t) && seen.add(t))
  return unique.join(' OR ')
}

// ── Game rules ───────────────────────────────────────────────────────────

const REGION_SEGMENT = /-(alola|galar|hisui|paldea)(?=-|$)/

// The regional form a Pokémon name denotes ('slowpoke-galar' → 'galar',
// 'darmanitan-galar-standard' → 'galar'), or null. Pikachu's "Alola Cap" is a
// costume, not an Alolan form.
export function regionOfPokemon(name) {
  if (!name || name.endsWith('-cap')) return null
  return name.match(REGION_SEGMENT)?.[1] ?? null
}

// Outcomes decided by the game version itself, which the API doesn't record.
// Keyed by the evolved form or species; listed versions are where it happens.
const VERSION_LOCKED_RESULTS = {
  'solgaleo': ['sun', 'ultra-sun', 'sword'],
  'lunala': ['moon', 'ultra-moon', 'shield'],
  'lycanroc-midday': ['sun', 'ultra-sun', 'sword', 'shield'],
  'lycanroc-midnight': ['moon', 'ultra-moon', 'sword', 'shield'],
}

// Evolution spots the API dates to the first game of their region, though
// they only work in a later one: Blush Mountain's magnetic field is new to
// Ultra Sun and Ultra Moon.
const LOCATION_VERSIONS = {
  'blush-mountain': ['ultra-sun', 'ultra-moon'],
}

// In Ultra Sun and Ultra Moon, evolving inside Ultra Space gives the ordinary
// form where the rest of Alola gives the Alolan one.
const ULTRA_SPACE_VERSIONS = new Set(['ultra-sun', 'ultra-moon'])

// Games with no clock, where a time-of-day evolution can't happen at all
// (Espeon and Umbreon in FireRed/LeafGreen). XD also lacks a clock but has
// its own items for those two, so it is left alone.
const NO_CLOCK_EVOLUTION_VERSIONS = new Set(['firered', 'leafgreen', 'colosseum'])

// Alolan Marowak's totem is the one regional totem named without its region.
const FORM_ALIASES = { 'marowak-totem': 'marowak-alola' }

function gameContext(version) {
  if (!version) return null
  return {
    version,
    order: latestVersionGroupOrder(version),
    generation: versionGeneration[version] || null,
    regions: versionRegions[version] || [],
  }
}

const introducedBy = (detail, game) => {
  const group = detail.version_group?.name
  if (!group || game.order == null) return true
  return versionGroupOrder[group] <= game.order
}

// Whether one method can be carried out in the selected game, leaving aside
// which form of the Pokémon it applies to.
function methodWorksInGame(detail, game, resultNames) {
  if (!game) return true
  if (!introducedBy(detail, game)) return false
  if (detail.region?.name && !game.regions.includes(detail.region.name)) return false
  if (detail.location?.name) {
    const only = LOCATION_VERSIONS[detail.location.name]
    const reachable = only
      ? only.includes(game.version)
      : versionGroupRegions(detail.version_group?.name).some(r => game.regions.includes(r))
    if (!reachable) return false
  }
  // Affection (Pokémon-Amie / Refresh) only exists in Generations 6 and 7.
  if (detail.min_affection && game.generation !== 6 && game.generation !== 7) return false
  if (detail.time_of_day && NO_CLOCK_EVOLUTION_VERSIONS.has(game.version)) return false
  for (const name of resultNames) {
    const versions = VERSION_LOCKED_RESULTS[name]
    if (versions && !versions.includes(game.version)) return false
  }
  return true
}

// Sort one evolution step's methods into those that work in the game and
// those that don't. Where a method tied to the game's own region exists
// (Pikachu → Alolan Raichu in Alola), it replaces the ordinary one there.
function classifyMethods(details, game, resultNamesOf) {
  const regionalHere = !!game && details.some(d =>
    d.region?.name && game.regions.includes(d.region.name) && introducedBy(d, game))
  return details.map(detail => {
    let works = methodWorksInGame(detail, game, resultNamesOf(detail))
    let ultraSpace = false
    if (works && regionalHere && !detail.region?.name) {
      if (ULTRA_SPACE_VERSIONS.has(game.version)) ultraSpace = true
      else works = false
    }
    return { detail, works, ultraSpace }
  })
}

export function pokemonAvailableInVersion(pokemonData, version) {
  if (!pokemonData || !version) return false
  if (gameIndexMeansAvailable(version)
      && pokemonData.game_indices?.some(gi => gi.version?.name === version)) return true
  for (const move of pokemonData.moves || []) {
    for (const vgd of (move.version_group_details || [])) {
      if (versionGroupToVersions[vgd.version_group?.name]?.includes(version)) return true
    }
  }
  return false
}

// ── Tree ─────────────────────────────────────────────────────────────────

function findPath(node, speciesName, path = []) {
  if (!node?.species?.name) return null
  const next = [...path, node]
  if (node.species.name === speciesName) return next
  for (const evo of node.evolves_to || []) {
    const found = findPath(evo, speciesName, next)
    if (found) return found
  }
  return null
}

/**
 * Build the evolution tree shown on a Pokémon's page.
 *
 *   chain           the `chain` object of an evolution-chain response
 *   selectedVersion the game being viewed (null = no game-specific filtering)
 *   viewedSpecies   species name of the page's Pokémon
 *   viewedPokemon   the form being viewed (a pokemon or pokemon-form name), or null for the default
 *   getSpecies      async (speciesName) → pokemon-species data (varieties)
 *   getPokemon      async (pokemonName) → pokemon data (moves, game_indices)
 *
 * Returns root nodes shaped { name, species, current, url, children: [{ triggerText, node }] },
 * where `current` marks the node for the Pokémon being viewed.
 */
export async function buildEvolutionTree({ chain, selectedVersion, viewedSpecies, viewedPokemon, getSpecies, getPokemon }) {
  if (!chain?.species?.name) return []

  const game = gameContext(selectedVersion)
  const hasDayNight = versionHasDayNight(selectedVersion)

  const speciesInfo = new Map()
  const infoFor = async (speciesName) => {
    if (!speciesInfo.has(speciesName)) {
      const sp = await getSpecies(speciesName)
      const varieties = (sp?.varieties || []).map(v => v.pokemon?.name).filter(Boolean)
      const defaultName = sp?.varieties?.find(v => v.is_default)?.pokemon?.name || varieties[0] || speciesName
      speciesInfo.set(speciesName, { varieties, defaultName })
    }
    return speciesInfo.get(speciesName)
  }

  // The API names forms (pokemon-form) while the tree works with varieties
  // (pokemon): 'burmy-sandy' belongs to 'burmy'; 'darumaka-galar' is its own.
  const pokemonFor = async (speciesName, formName) => {
    const { varieties, defaultName } = await infoFor(speciesName)
    if (!formName) return defaultName
    let best = null
    for (const v of varieties) {
      if ((formName === v || formName.startsWith(v + '-')) && (!best || v.length > best.length)) best = v
    }
    return best || defaultName
  }
  const requiredOf = (speciesName, detail) =>
    detail.required_pokemon_form?.name ? pokemonFor(speciesName, detail.required_pokemon_form.name) : null
  const resultOf = (speciesName, detail) => pokemonFor(speciesName, detail.evolved_pokemon_form?.name)

  // ── What the chain's own data says about forms ──
  // Varieties some method names as required or produced.
  const requiredForms = new Set()
  const producedForms = new Set()
  const collect = async (node) => {
    for (const evo of node.evolves_to || []) {
      for (const d of evo.evolution_details || []) {
        const required = await requiredOf(node.species.name, d)
        if (required) requiredForms.add(required)
        if (d.evolved_pokemon_form?.name) producedForms.add(await resultOf(evo.species.name, d))
      }
      await collect(evo)
    }
  }
  await collect(chain)
  const isNamed = (form) => requiredForms.has(form) || producedForms.has(form)

  // Regional forms get their own node, and so does a form some method
  // specifically requires (Own Tempo Rockruff); every other form shares its
  // species' node.
  const nodeKey = (speciesName, form) => {
    if (regionOfPokemon(form)) return form
    const info = speciesInfo.get(speciesName)
    return requiredForms.has(form) && form !== info?.defaultName ? form : speciesName
  }

  const pokemonAvailable = async (pokemonName) => {
    if (!game) return true
    const data = await getPokemon(pokemonName)
    return !!data && pokemonAvailableInVersion(data, game.version)
  }
  const nodeAvailable = async (speciesName, form) => {
    if (!game) return true
    if (regionOfPokemon(form)) return pokemonAvailable(form)
    const { varieties } = await infoFor(speciesName)
    if (!varieties.length) return true
    return (await Promise.all(varieties.map(pokemonAvailable))).some(Boolean)
  }

  // The form whose line a viewed form sits on. A form the data names (or the
  // default) is its own line; one it doesn't name follows the form it is a
  // version of: Gigantamax Rapid Strike Urshifu → Rapid Strike, Galarian Zen
  // Mode → Galarian Standard, a costume or Mega → the ordinary form.
  const lineVariety = async (speciesName, form) => {
    const { varieties, defaultName } = await infoFor(speciesName)
    if (form === defaultName || isNamed(form)) return form
    const alias = FORM_ALIASES[form]
    if (alias && varieties.includes(alias)) return alias
    const region = regionOfPokemon(form)
    if (region) {
      return varieties.find(v => isNamed(v) && regionOfPokemon(v) === region) || form
    }
    let base = null
    for (const v of varieties) {
      if (v !== form && form.startsWith(v + '-') && (v === defaultName || isNamed(v)) && (!base || v.length > base.length)) base = v
    }
    return base || defaultName
  }

  // ── Which form of each ancestor leads to the Pokémon being viewed ──
  // Walk up from the viewed form: the method that produces it names the form
  // it needs (Perrserker needs Galarian Meowth; Alolan Raichu needs an
  // ordinary Pikachu).
  const lineForms = new Map()
  let viewedExact = null
  const path = findPath(chain, viewedSpecies)
  if (path) {
    viewedExact = viewedPokemon
      ? await pokemonFor(viewedSpecies, viewedPokemon)
      : (await infoFor(viewedSpecies)).defaultName
    lineForms.set(viewedSpecies, await lineVariety(viewedSpecies, viewedExact))

    for (let i = path.length - 1; i > 0; i--) {
      const parent = path[i - 1].species.name
      const child = path[i]
      const childForm = lineForms.get(child.species.name)
      const parentInfo = await infoFor(parent)
      let parentForm = null
      for (const d of child.evolution_details || []) {
        if (await resultOf(child.species.name, d) === childForm) {
          parentForm = (await requiredOf(parent, d)) || parentInfo.defaultName
          break
        }
      }
      if (!parentForm) {
        // Nothing produces this form directly: follow its region.
        const region = regionOfPokemon(childForm)
        parentForm = region && parentInfo.varieties.includes(`${parent}-${region}`)
          ? `${parent}-${region}`
          : parentInfo.defaultName
      }
      lineForms.set(parent, parentForm)
    }
  }
  const onViewedLine = (speciesName, key) =>
    lineForms.has(speciesName) && nodeKey(speciesName, lineForms.get(speciesName)) === key

  // ── Top-down build ──
  const build = async (node, form) => {
    const speciesName = node.species.name
    const edges = []

    // The node for the Pokémon being viewed evolves as that exact form does:
    // the data requires an ordinary Pikachu or Eevee, so a partner, costume
    // or Gigantamax one shows no evolution.
    const isViewed = speciesName === viewedSpecies && onViewedLine(speciesName, nodeKey(speciesName, form))
    const ownForm = isViewed ? viewedExact : form

    for (const evo of node.evolves_to || []) {
      const evoSpecies = evo.species.name
      const details = evo.evolution_details || []

      // The API links a few Pokémon without saying how (Phione → Manaphy).
      if (!details.length) {
        for (const child of await build(evo, (await infoFor(evoSpecies)).defaultName)) {
          edges.push({ triggerText: formatEvolutionDetails(details, hasDayNight), node: child })
        }
        continue
      }

      // Methods that apply to this form at all. One that names a required
      // form applies to that form only; one that doesn't is the ordinary
      // line's and never applies to a regional form (Galarian Yamask does
      // not become Cofagrigus).
      let forForm = []
      for (const d of details) {
        const required = await requiredOf(speciesName, d)
        if (required ? required === ownForm : !regionOfPokemon(ownForm)) forForm.push(d)
      }
      // Forms that share a variety (Antique and Phony Sinistea) are told
      // apart by the form name itself.
      if (isViewed && viewedPokemon) {
        const named = forForm.filter(d => d.required_pokemon_form?.name === viewedPokemon)
        if (named.length) forForm = named
      }
      if (!forForm.length) continue

      const methods = classifyMethods(forForm, game,
        d => [d.evolved_pokemon_form?.name, evoSpecies].filter(Boolean))

      // Group by the Pokémon each method produces.
      const groups = new Map()
      for (const m of methods) {
        const result = await resultOf(evoSpecies, m.detail)
        const key = nodeKey(evoSpecies, result)
        if (!groups.has(key)) groups.set(key, { key, form: result, methods: [] })
        groups.get(key).methods.push({ ...m, result })
      }

      // On the page of one particular form (Rapid Strike Urshifu, Female
      // Meowstic), show how that form is reached, not its siblings — unless
      // it can't be reached in this game while the species still evolves
      // here, where the working methods are the useful answer.
      const lineForm = lineForms.get(evoSpecies)
      for (const group of groups.values()) {
        const pick = (own) => {
          if (!own.length) return false
          if (!own.some(m => m.works) && group.methods.some(m => m.works)) return false
          group.methods = own
          return true
        }
        if (evoSpecies === viewedSpecies && viewedPokemon
            && pick(group.methods.filter(m => m.detail.evolved_pokemon_form?.name === viewedPokemon))) {
          group.form = lineForm
        } else if (lineForm && pick(group.methods.filter(m => m.result === lineForm))) {
          group.form = lineForm
        }
        group.working = group.methods.filter(m => m.works)
      }

      const anyDoable = [...groups.values()].some(g => g.working.length)
      for (const group of groups.values()) {
        let triggerText
        if (group.working.length) {
          triggerText = formatEvolutionDetails(group.working.map(m => m.detail), hasDayNight)
            + (group.working.every(m => m.ultraSpace) ? ' in Ultra Space' : '')
        } else {
          // Nothing works in this game. A regional sibling that can't be made
          // here is left out, unless it is the very line being viewed.
          if (anyDoable && !onViewedLine(evoSpecies, group.key)) continue
          if (!(await nodeAvailable(evoSpecies, group.form))) continue
          triggerText = NOT_POSSIBLE_HERE
        }
        for (const child of await build(evo, group.form)) {
          edges.push({ triggerText, node: child })
        }
      }
    }

    // A Pokémon missing from this game (a baby in Generation 1) drops out and
    // its evolutions take its place.
    if (!(await nodeAvailable(speciesName, form))) return edges.map(edge => edge.node)

    return [{
      name: nodeKey(speciesName, form),
      species: speciesName,
      current: isViewed,
      url: node.species.url,
      children: edges,
    }]
  }

  const rootName = chain.species.name
  return build(chain, lineForms.get(rootName) || (await infoFor(rootName)).defaultName)
}

// The evolution steps, read off a built tree, that lead from `fromSpecies`
// down to the Pokémon being viewed: [{ to, method }]. Null when the viewed
// Pokémon isn't below that species in the tree.
export function evolutionStepsTo(roots, fromSpecies) {
  const walk = (node, steps) => {
    const here = steps ?? (node.species === fromSpecies ? [] : null)
    if (node.current) return here
    for (const edge of node.children || []) {
      const found = walk(edge.node, here && [...here, { to: edge.node.name, method: edge.triggerText }])
      if (found) return found
    }
    return null
  }
  for (const root of roots || []) {
    const found = walk(root, null)
    if (found) return found
  }
  return null
}

// For an evolution that can't be done in the selected game: the games of its
// generation it can trade with in which the Pokémon being viewed can be
// evolved from `fromSpecies` (Magnezone in HeartGold → Diamond, Pearl,
// Platinum), with the steps as they work in the first of them.
export async function evolvableElsewhere({ chain, selectedVersion, fromSpecies, viewedSpecies, viewedPokemon, getSpecies, getPokemon }) {
  const siblings = (generationVersions[versionGeneration[selectedVersion]] || [])
    .filter(v => v !== selectedVersion && isSupportedVersion(v) && canTradeBetween(selectedVersion, v))

  const versions = []
  let steps = []
  for (const version of siblings) {
    const roots = await buildEvolutionTree({ chain, selectedVersion: version, viewedSpecies, viewedPokemon, getSpecies, getPokemon })
    const path = evolutionStepsTo(roots, fromSpecies)
    if (!path?.length || path.some(step => step.method === NOT_POSSIBLE_HERE)) continue
    if (!versions.length) steps = path
    versions.push(version)
  }
  return { versions, steps }
}
