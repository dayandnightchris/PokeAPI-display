import { useState, useEffect } from 'react'

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
  'omega-ruby':       ['generation-vi',   'omegaruby-alphasapphire'],
  'alpha-sapphire':   ['generation-vi',   'omegaruby-alphasapphire'],
  'sun':              ['generation-vii',  'ultra-sun-ultra-moon'],
  'moon':             ['generation-vii',  'ultra-sun-ultra-moon'],
  'ultra-sun':        ['generation-vii',  'ultra-sun-ultra-moon'],
  'ultra-moon':       ['generation-vii',  'ultra-sun-ultra-moon'],
  'lets-go-pikachu':  ['generation-vii',  'ultra-sun-ultra-moon'],
  'lets-go-eevee':    ['generation-vii',  'ultra-sun-ultra-moon'],
  'sword':            ['generation-viii',  null],
  'shield':           ['generation-viii',  null],
  'brilliant-diamond':['generation-viii',  'brilliant-diamond-shining-pearl'],
  'shining-pearl':    ['generation-viii',  'brilliant-diamond-shining-pearl'],
  'legends-arceus':   ['generation-viii',  null],
  'scarlet':          ['generation-ix',   'scarlet-violet'],
  'violet':           ['generation-ix',   'scarlet-violet'],
  'legends-za':       ['generation-ix',   null],
}

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

export function useVersionSprite(displayPokemon, selectedVersion) {
  const [versionSprite, setVersionSprite] = useState(null)
  const [versionShinySprite, setVersionShinySprite] = useState(null)

  useEffect(() => {
    if (!displayPokemon?.sprites?.versions || !selectedVersion) {
      setVersionSprite(null)
      setVersionShinySprite(null)
      return
    }

    const versions = displayPokemon.sprites.versions
    const mapping = versionSpriteMap[selectedVersion]

    if (!mapping) {
      setVersionSprite(null)
      setVersionShinySprite(null)
      return
    }

    const [genKey, spriteKey] = mapping

    // 1. Try the exact sprite key for this version
    let sprite = findSprite(versions, genKey, spriteKey)
    let shiny = findShinySprite(versions, genKey, spriteKey)
    if (sprite) {
      setVersionSprite(sprite)
      setVersionShinySprite(shiny)
      return
    }

    // 2. Try any sprite in the same generation
    sprite = findAnySprite(versions, genKey)
    shiny = findAnyShinySprite(versions, genKey)
    if (sprite) {
      setVersionSprite(sprite)
      setVersionShinySprite(shiny)
      return
    }

    // 3. Fall back through earlier generations
    const startIdx = generationFallback.indexOf(genKey)
    if (startIdx !== -1) {
      for (let i = startIdx + 1; i < generationFallback.length; i++) {
        sprite = findAnySprite(versions, generationFallback[i])
        shiny = findAnyShinySprite(versions, generationFallback[i])
        if (sprite) {
          setVersionSprite(sprite)
          setVersionShinySprite(shiny)
          return
        }
      }
    }

    setVersionSprite(null)
    setVersionShinySprite(null)
  }, [displayPokemon?.sprites?.versions, selectedVersion])

  return { versionSprite, versionShinySprite }
}
