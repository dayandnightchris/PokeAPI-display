const versionInfoCache = new Map()

export const generationOrder = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9
}

// Map generation number to the list of version names in that generation
export const generationVersions = {
  1: ['red', 'blue', 'yellow'],
  2: ['gold', 'silver', 'crystal'],
  3: ['ruby', 'sapphire', 'emerald', 'firered', 'leafgreen', 'colosseum', 'xd'],
  4: ['diamond', 'pearl', 'platinum', 'heartgold', 'soulsilver'],
  5: ['black', 'white', 'black-2', 'white-2'],
  6: ['x', 'y', 'omega-ruby', 'alpha-sapphire'],
  7: ['sun', 'moon', 'ultra-sun', 'ultra-moon'],
  8: ['sword', 'shield', 'brilliant-diamond', 'shining-pearl', 'legends-arceus'],
  9: ['scarlet', 'violet'],
}

// Map version name to generation number
export const versionGeneration = {
  'red': 1, 'blue': 1, 'yellow': 1,
  'gold': 2, 'silver': 2, 'crystal': 2,
  'ruby': 3, 'sapphire': 3, 'emerald': 3, 'firered': 3, 'leafgreen': 3,
  'colosseum': 3, 'xd': 3,
  'diamond': 4, 'pearl': 4, 'platinum': 4, 'heartgold': 4, 'soulsilver': 4,
  'black': 5, 'white': 5, 'black-2': 5, 'white-2': 5,
  'x': 6, 'y': 6, 'omega-ruby': 6, 'alpha-sapphire': 6,
  'sun': 7, 'moon': 7, 'ultra-sun': 7, 'ultra-moon': 7,
  'sword': 8, 'shield': 8, 'brilliant-diamond': 8, 'shining-pearl': 8, 'legends-arceus': 8,
  'scarlet': 9, 'violet': 9,
}

// Map version name to display name
export const versionDisplayNames = {
  'red': 'Red', 'blue': 'Blue', 'yellow': 'Yellow',
  'gold': 'Gold', 'silver': 'Silver', 'crystal': 'Crystal',
  'ruby': 'Ruby', 'sapphire': 'Sapphire', 'emerald': 'Emerald',
  'firered': 'FireRed', 'leafgreen': 'LeafGreen',
  'colosseum': 'Colosseum', 'xd': 'XD',
  'diamond': 'Diamond', 'pearl': 'Pearl', 'platinum': 'Platinum',
  'heartgold': 'HeartGold', 'soulsilver': 'SoulSilver',
  'black': 'Black', 'white': 'White', 'black-2': 'Black 2', 'white-2': 'White 2',
  'x': 'X', 'y': 'Y', 'omega-ruby': 'Omega Ruby', 'alpha-sapphire': 'Alpha Sapphire',
  'sun': 'Sun', 'moon': 'Moon', 'ultra-sun': 'Ultra Sun', 'ultra-moon': 'Ultra Moon',
  'sword': 'Sword', 'shield': 'Shield',
  'brilliant-diamond': 'Brilliant Diamond', 'shining-pearl': 'Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'scarlet': 'Scarlet', 'violet': 'Violet',
}

// Map version group name to display name
export const versionGroupDisplayNames = {
  'red-blue': 'R/B', 'yellow': 'Y',
  'gold-silver': 'G/S', 'crystal': 'C',
  'ruby-sapphire': 'R/S', 'emerald': 'E',
  'firered-leafgreen': 'FR/LG', 'colosseum': 'Col', 'xd': 'XD',
  'diamond-pearl': 'D/P', 'platinum': 'Pt', 'heartgold-soulsilver': 'HG/SS',
  'black-white': 'B/W', 'black-2-white-2': 'B2/W2',
  'x-y': 'X/Y', 'omega-ruby-alpha-sapphire': 'OR/AS',
  'sun-moon': 'S/M', 'ultra-sun-ultra-moon': 'US/UM',
  'lets-go-pikachu-lets-go-eevee': 'LGPE',
  'sword-shield': 'Sw/Sh', 'the-isle-of-armor': 'IoA', 'the-crown-tundra': 'CT',
  'brilliant-diamond-and-shining-pearl': 'BD/SP', 'legends-arceus': 'LA',
  'scarlet-violet': 'S/V', 'the-teal-mask': 'TM', 'the-indigo-disk': 'ID',
}

// Map generation number to list of version group names
export const generationVersionGroups = {
  1: ['red-blue', 'yellow'],
  2: ['gold-silver', 'crystal'],
  3: ['ruby-sapphire', 'emerald', 'firered-leafgreen', 'colosseum', 'xd'],
  4: ['diamond-pearl', 'platinum', 'heartgold-soulsilver'],
  5: ['black-white', 'black-2-white-2'],
  6: ['x-y', 'omega-ruby-alpha-sapphire'],
  7: ['sun-moon', 'ultra-sun-ultra-moon', 'lets-go-pikachu-lets-go-eevee'],
  8: ['sword-shield', 'the-isle-of-armor', 'the-crown-tundra', 'brilliant-diamond-and-shining-pearl', 'legends-arceus'],
  9: ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk'],
}

export async function getVersionInfo(versionName) {
  if (!versionName) return null

  const key = String(versionName).trim().toLowerCase()
  if (!key) return null

  if (versionInfoCache.has(key)) return versionInfoCache.get(key)

  try {
    const versionRes = await fetch(`https://pokeapi.co/api/v2/version/${key}/`)
    if (!versionRes.ok) return null
    const versionData = await versionRes.json()

    const versionGroupName = versionData?.version_group?.name || null
    const versionGroupUrl = versionData?.version_group?.url || null

    let generationName = null
    if (versionGroupUrl) {
      const groupRes = await fetch(versionGroupUrl)
      if (groupRes.ok) {
        const groupData = await groupRes.json()
        generationName = groupData?.generation?.name || null
      }
    }

    const info = { versionGroup: versionGroupName, generation: generationName }
    versionInfoCache.set(key, info)
    return info
  } catch (err) {
    console.error('Failed to fetch version info:', key, err)
    return null
  }
}
