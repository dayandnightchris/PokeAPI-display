import { useState, useEffect } from 'react'

const versionGroupMap = {
  'red': 'generation-i',
  'blue': 'generation-i',
  'yellow': 'generation-i',
  'gold': 'generation-ii',
  'silver': 'generation-ii',
  'crystal': 'generation-ii',
  'ruby': 'generation-iii',
  'sapphire': 'generation-iii',
  'firered': 'generation-iii',
  'leafgreen': 'generation-iii',
  'emerald': 'generation-iii',
  'diamond': 'generation-iv',
  'pearl': 'generation-iv',
  'platinum': 'generation-iv',
  'heartgold': 'generation-iv',
  'soulsilver': 'generation-iv',
  'black': 'generation-v',
  'white': 'generation-v',
  'black-2': 'generation-v',
  'white-2': 'generation-v',
  'x': 'generation-vi',
  'y': 'generation-vi',
  'omega-ruby': 'generation-vi',
  'alpha-sapphire': 'generation-vi',
  'sun': 'generation-vii',
  'moon': 'generation-vii',
  'ultra-sun': 'generation-vii',
  'ultra-moon': 'generation-vii',
  'lets-go-pikachu': 'generation-vii',
  'lets-go-eevee': 'generation-vii',
  'sword': 'generation-viii',
  'shield': 'generation-viii',
  'scarlet': 'generation-ix',
  'violet': 'generation-ix'
}

export function useVersionSprite(displayPokemon, selectedVersion) {
  const [versionSprite, setVersionSprite] = useState(null)

  useEffect(() => {
    if (!displayPokemon?.sprites?.versions || !selectedVersion) {
      setVersionSprite(null)
      return
    }

    // Map version names to version group keys
    const versionGroup = versionGroupMap[selectedVersion]
    if (versionGroup && displayPokemon.sprites.versions[versionGroup]) {
      const groupSprites = displayPokemon.sprites.versions[versionGroup]
      // Try to find a sprite for this version
      let sprite = null

      // Try different keys in the version group
      for (const key of Object.keys(groupSprites)) {
        if (key.includes(selectedVersion)) {
          const versionData = groupSprites[key]
          sprite = versionData?.front_default || null
          if (sprite) break
        }
      }

      setVersionSprite(sprite)
    } else {
      setVersionSprite(null)
    }
  }, [displayPokemon?.sprites?.versions, selectedVersion])

  return versionSprite
}
