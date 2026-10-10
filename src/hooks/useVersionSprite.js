import { useMemo } from 'react'

// Maps each game version to its exact sprite key path: [generation, spriteGroupKey]
// Sprite group keys come from PokeAPI's sprites.versions structure
const versionSpriteMap = {
  'red':              ['generation-i',    'red-blue'],
  'blue':             ['generation-i',    'red-blue'],
  'yellow':           ['generation-i',    'yellow'],
  'gold':             ['generation-ii',   'gold'],
  'silver':           ['generation-ii',   'silver'],
  'crystal':          ['generation-ii',   'crystal'],
  'ruby':             ['generation-iii',  'ruby-sapphire'],
  'sapphire':         ['generation-iii',  'ruby-sapphire'],
  'emerald':          ['generation-iii',  'emerald'],
  'firered':          ['generation-iii',  'firered-leafgreen'],
  'leafgreen':        ['generation-iii',  'firered-leafgreen'],
  'colosseum':        ['generation-iii',  'ruby-sapphire'],
  'xd':               ['generation-iii',  'ruby-sapphire'],
  'diamond':          ['generation-iv',   'diamond-pearl'],
  'pearl':            ['generation-iv',   'diamond-pearl'],
  'platinum':         ['generation-iv',   'platinum'],
  'heartgold':        ['generation-iv',   'heartgold-soulsilver'],
  'soulsilver':       ['generation-iv',   'heartgold-soulsilver'],
  'black':            ['generation-v',    'black-white'],
  'white':            ['generation-v',    'black-white'],
  'black-2':          ['generation-v',    'black-white'],
  'white-2':          ['generation-v',    'black-white'],
  'x':                ['generation-vi',   'x-y'],
  'y':                ['generation-vi',   'x-y'],
  // Renamed from 'omegaruby-alphasapphire' in the API (and the sprites repo
  // folder) on 2026-10-07 to match the version-group name.
  'omega-ruby':       ['generation-vi',   'omega-ruby-alpha-sapphire'],
  'alpha-sapphire':   ['generation-vi',   'omega-ruby-alpha-sapphire'],
  'sun':              ['generation-vii',  'ultra-sun-ultra-moon'],
  'moon':             ['generation-vii',  'ultra-sun-ultra-moon'],
  'ultra-sun':        ['generation-vii',  'ultra-sun-ultra-moon'],
  'ultra-moon':       ['generation-vii',  'ultra-sun-ultra-moon'],
  // Switch-era games have their own animated in-game sprite sets (added to
  // the API in Oct 2026). A Pokémon missing from its game's set falls back to
  // the HOME renders, never to an older generation's sprites — see
  // HOME_FALLBACK_SETS below.
  'lets-go-pikachu':  ['generation-vii',  'lets-go-pikachu-lets-go-eevee'],
  'lets-go-eevee':    ['generation-vii',  'lets-go-pikachu-lets-go-eevee'],
  'sword':            ['generation-viii', 'sword-shield'],
  'shield':           ['generation-viii', 'sword-shield'],
  'brilliant-diamond':['generation-viii',  'brilliant-diamond-shining-pearl'],
  'shining-pearl':    ['generation-viii',  'brilliant-diamond-shining-pearl'],
  'legends-arceus':   ['home', null],
  'scarlet':          ['generation-ix',   'scarlet-violet'],
  'violet':           ['generation-ix',   'scarlet-violet'],
  'legends-za':       ['generation-ix',   null],
}

// Sprite sets whose only fallback is the HOME renders (Switch-era games).
const HOME_FALLBACK_SETS = new Set(['sword-shield', 'lets-go-pikachu-lets-go-eevee'])

// Ordered from newest to oldest for fallback
const generationFallback = [
  'generation-ix',
  'generation-viii',
  'generation-vii',
  'generation-vi',
  'generation-v',
  'generation-iv',
  'generation-iii',
  'generation-ii',
  'generation-i',
]

function findSprite(versions, genKey, spriteKey) {
  const genSprites = versions[genKey]
  if (!genSprites) return null
  if (!spriteKey) return null
  const group = genSprites[spriteKey]
  return group?.front_default || null
}

function findShinySprite(versions, genKey, spriteKey) {
  const genSprites = versions[genKey]
  if (!genSprites) return null
  if (!spriteKey) return null
  const group = genSprites[spriteKey]
  return group?.front_shiny || null
}

function findAnySprite(versions, genKey) {
  const genSprites = versions[genKey]
  if (!genSprites) return null
  for (const key of Object.keys(genSprites)) {
    if (key === 'icons') continue
    const sprite = genSprites[key]?.front_default
    if (sprite) return sprite
  }
  return null
}

function findAnyShinySprite(versions, genKey) {
  const genSprites = versions[genKey]
  if (!genSprites) return null
  for (const key of Object.keys(genSprites)) {
    if (key === 'icons') continue
    const sprite = genSprites[key]?.front_shiny
    if (sprite) return sprite
  }
  return null
}

function findFemaleSprite(versions, genKey, spriteKey) {
  const genSprites = versions[genKey]
  if (!genSprites) return null
  if (!spriteKey) return null
  const group = genSprites[spriteKey]
  return group?.front_female || null
}

function findAnyFemaleSprite(versions, genKey) {
  const genSprites = versions[genKey]
  if (!genSprites) return null
  for (const key of Object.keys(genSprites)) {
    if (key === 'icons') continue
    const sprite = genSprites[key]?.front_female
    if (sprite) return sprite
  }
  return null
}

const NO_SPRITES = {
  versionSprite: null,
  versionShinySprite: null,
  versionFemaleSprite: null,
  versionAnimSprite: null,
  versionAnimShiny: null,
  versionAnimFemale: null,
}

// The sprites a Pokémon uses in one game version, read from its sprite data.
function resolveVersionSprites(sprites, selectedVersion) {
  const versions = sprites?.versions
  const mapping = versionSpriteMap[selectedVersion]
  if (!versions || !mapping) return NO_SPRITES

  const [genKey, spriteKey] = mapping

  // Switch-era versions: the game's own sprite set when this Pokémon has
  // one, otherwise the HOME renders — no cross-gen fallback, so a SWSH page
  // never shows a 3DS-era sprite. Normal and shiny always come from the same
  // set so the carousel doesn't mix art styles. If both are missing,
  // everything stays null and the consumer falls back to official artwork.
  if (genKey === 'home' || HOME_FALLBACK_SETS.has(spriteKey)) {
    const home = sprites.other?.home
    const inGame = genKey === 'home' ? null : versions[genKey]?.[spriteKey]
    const set = inGame?.front_default ? inGame : home
    return {
      ...NO_SPRITES,
      versionSprite: set?.front_default || null,
      versionShinySprite: set?.front_shiny || null,
      versionFemaleSprite: set?.front_female || home?.front_female || null,
    }
  }

  // Only use Gen 5 BW animated sprites when the selected version IS Gen 5
  const bwAnimated = versions['generation-v']?.['black-white']?.animated
  const useAnimated = genKey === 'generation-v' && bwAnimated
  const resolved = {
    ...NO_SPRITES,
    versionAnimSprite: useAnimated ? (bwAnimated.front_default || null) : null,
    versionAnimShiny: useAnimated ? (bwAnimated.front_shiny || null) : null,
    versionAnimFemale: useAnimated ? (bwAnimated.front_female || null) : null,
  }
  const withStills = (sprite, shiny, female) => ({
    ...resolved,
    versionSprite: sprite,
    versionShinySprite: shiny,
    versionFemaleSprite: female,
  })

  // 1. Try the exact sprite key for this version
  let sprite = findSprite(versions, genKey, spriteKey)
  if (sprite) {
    return withStills(sprite, findShinySprite(versions, genKey, spriteKey), findFemaleSprite(versions, genKey, spriteKey))
  }

  // 2. Try any sprite in the same generation
  sprite = findAnySprite(versions, genKey)
  if (sprite) {
    return withStills(sprite, findAnyShinySprite(versions, genKey), findAnyFemaleSprite(versions, genKey))
  }

  // 3. Fall back through earlier generations
  const startIdx = generationFallback.indexOf(genKey)
  if (startIdx !== -1) {
    for (let i = startIdx + 1; i < generationFallback.length; i++) {
      sprite = findAnySprite(versions, generationFallback[i])
      if (sprite) {
        return withStills(sprite, findAnyShinySprite(versions, generationFallback[i]), findAnyFemaleSprite(versions, generationFallback[i]))
      }
    }
  }

  return resolved
}

export function useVersionSprite(displayPokemon, selectedVersion) {
  const sprites = displayPokemon?.sprites
  // Derived during render, so the sprites always belong to the Pokémon and
  // version on screen — never to the previous page for a frame.
  const resolved = useMemo(() => resolveVersionSprites(sprites, selectedVersion), [sprites, selectedVersion])

  // False only until a version has been selected; until then the consumer has
  // nothing but its artwork fallbacks to show.
  return { ...resolved, spritesReady: !!selectedVersion }
}
