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
  7: ['sun', 'moon', 'ultra-sun', 'ultra-moon', 'lets-go-pikachu', 'lets-go-eevee'],
  8: ['sword', 'shield', 'brilliant-diamond', 'shining-pearl', 'legends-arceus'],
  9: ['scarlet', 'violet', 'legends-za'],
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
  'lets-go-pikachu': 7, 'lets-go-eevee': 7,
  'sword': 8, 'shield': 8, 'brilliant-diamond': 8, 'shining-pearl': 8, 'legends-arceus': 8,
  'scarlet': 9, 'violet': 9, 'legends-za': 9,
}

// Map version name to display name
export const versionDisplayNames = {
  'red': 'Red', 'blue': 'Blue', 'yellow': 'Yellow',
  'gold': 'Gold', 'silver': 'Silver', 'crystal': 'Crystal',
  'ruby': 'Ruby', 'sapphire': 'Sapphire', 'emerald': 'Emerald',
  'firered': 'Fire Red', 'leafgreen': 'Leaf Green',
  'colosseum': 'Colosseum', 'xd': 'XD',
  'diamond': 'Diamond', 'pearl': 'Pearl', 'platinum': 'Platinum',
  'heartgold': 'Heart Gold', 'soulsilver': 'Soul Silver',
  'black': 'Black', 'white': 'White', 'black-2': 'Black 2', 'white-2': 'White 2',
  'x': 'X', 'y': 'Y', 'omega-ruby': 'Omega Ruby', 'alpha-sapphire': 'Alpha Sapphire',
  'sun': 'Sun', 'moon': 'Moon', 'ultra-sun': 'Ultra Sun', 'ultra-moon': 'Ultra Moon',
  'lets-go-pikachu': "Let's Go Pikachu", 'lets-go-eevee': "Let's Go Eevee",
  'sword': 'Sword', 'shield': 'Shield',
  'brilliant-diamond': 'Brilliant Diamond', 'shining-pearl': 'Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'scarlet': 'Scarlet', 'violet': 'Violet',
  'legends-za': 'Legends: Z-A',
}

// Map individual version name to abbreviated display name
export const versionAbbreviations = {
  'red': 'R', 'blue': 'B', 'yellow': 'Y',
  'gold': 'G', 'silver': 'S', 'crystal': 'C',
  'ruby': 'R', 'sapphire': 'S', 'emerald': 'E',
  'firered': 'FR', 'leafgreen': 'LG',
  'colosseum': 'Col', 'xd': 'XD',
  'diamond': 'D', 'pearl': 'P', 'platinum': 'Pt',
  'heartgold': 'HG', 'soulsilver': 'SS',
  'black': 'B', 'white': 'W', 'black-2': 'B2', 'white-2': 'W2',
  'x': 'X', 'y': 'Y',
  'omega-ruby': 'OR', 'alpha-sapphire': 'AS',
  'sun': 'S', 'moon': 'M', 'ultra-sun': 'US', 'ultra-moon': 'UM',
  'lets-go-pikachu': 'LGP', 'lets-go-eevee': 'LGE',
  'sword': 'Sw', 'shield': 'Sh',
  'brilliant-diamond': 'BD', 'shining-pearl': 'SP',
  'legends-arceus': 'LA',
  'scarlet': 'Sc', 'violet': 'Vi',
  'legends-za': 'LZ-A',
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
  'legends-za': 'LZ-A',
  'mega-dimension': 'MD',
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
  9: ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk', 'legends-za', 'mega-dimension'],
}

// Version group canonical ordering for comparisons
export const versionGroupOrder = {
  'red-blue': 1, 'yellow': 2,
  'gold-silver': 3, 'crystal': 4,
  'ruby-sapphire': 5, 'emerald': 6, 'firered-leafgreen': 7, 'colosseum': 7.5, 'xd': 7.6,
  'diamond-pearl': 8, 'platinum': 9, 'heartgold-soulsilver': 10,
  'black-white': 11, 'black-2-white-2': 12,
  'x-y': 13, 'omega-ruby-alpha-sapphire': 14,
  'sun-moon': 15, 'ultra-sun-ultra-moon': 16, 'lets-go-pikachu-lets-go-eevee': 17,
  'sword-shield': 18, 'the-isle-of-armor': 19, 'the-crown-tundra': 20,
  'brilliant-diamond-and-shining-pearl': 21, 'legends-arceus': 22,
  'scarlet-violet': 23, 'the-teal-mask': 24, 'the-indigo-disk': 25,
  'legends-za': 26, 'mega-dimension': 27,
}

// Color for each version, used for version tags in the location page
export const versionColors = {
  // Gen 1
  'red': '#EF4444',
  'blue': '#3B82F6',
  'yellow': '#EAB308',
  // Gen 2
  'gold': '#D97706',
  'silver': '#94A3B8',
  'crystal': '#22D3EE',
  // Gen 3
  'ruby': '#DC2626',
  'sapphire': '#2563EB',
  'emerald': '#10B981',
  'firered': '#F97316',
  'leafgreen': '#22C55E',
  'colosseum': '#CA8A04',
  'xd': '#7C3AED',
  // Gen 4
  'diamond': '#60A5FA',
  'pearl': '#F472B6',
  'platinum': '#94A3B8',
  'heartgold': '#EAB308',
  'soulsilver': '#9CA3AF',
  // Gen 5
  'black': '#6B7280',
  'white': '#D1D5DB',
  'black-2': '#6B7280',
  'white-2': '#D1D5DB',
  // Gen 6
  'x': '#6366F1',
  'y': '#EF4444',
  'omega-ruby': '#DC2626',
  'alpha-sapphire': '#2563EB',
  // Gen 7
  'sun': '#F59E0B',
  'moon': '#8B5CF6',
  'ultra-sun': '#EA580C',
  'ultra-moon': '#7C3AED',
  'lets-go-pikachu': '#EAB308',
  'lets-go-eevee': '#92400E',
  // Gen 8
  'sword': '#38BDF8',
  'shield': '#EC4899',
  'brilliant-diamond': '#60A5FA',
  'shining-pearl': '#F472B6',
  'legends-arceus': '#0EA5E9',
  // Gen 9
  'scarlet': '#DC2626',
  'violet': '#7C3AED',
  'legends-za': '#059669',
}

// Determine which version groups can provide transfer-only moves for the selected version.
// Returns a Set of version group names, or null if no transfers are possible.
export function getTransferSourceVersionGroups(selectedVersion, versionGroup) {
  if (!selectedVersion || !versionGroup) return null

  const gen = versionGeneration[selectedVersion]
  if (!gen) return null

  // Gen 3: hard cutoff, no transfers
  if (gen === 3) return null

  // LGPE, BDSP, PLA, Gen 9+: no transfers
  const noTransferVersionGroups = new Set([
    'lets-go-pikachu-lets-go-eevee',
    'brilliant-diamond-and-shining-pearl',
    'legends-arceus',
    'scarlet-violet', 'the-teal-mask', 'the-indigo-disk',
    'legends-za', 'mega-dimension',
  ])
  if (noTransferVersionGroups.has(versionGroup)) return null

  const sources = new Set()

  // Gen 1-2: bidirectional transfers between Gen 1 and Gen 2
  if (gen === 1 || gen === 2) {
    const otherGen = gen === 1 ? 2 : 1
    for (const vg of (generationVersionGroups[otherGen] || [])) {
      sources.add(vg)
    }
    return sources.size > 0 ? sources : null
  }

  // Gen 4-6: forward from Gen 3+
  if (gen >= 4 && gen <= 6) {
    for (let g = 3; g < gen; g++) {
      for (const vg of (generationVersionGroups[g] || [])) {
        sources.add(vg)
      }
    }
    return sources.size > 0 ? sources : null
  }

  // SM/USUM (Gen 7, but NOT LGPE): Gen 3+ forward AND Gen 1-2 via Virtual Console
  if (gen === 7) {
    for (let g = 1; g <= 6; g++) {
      for (const vg of (generationVersionGroups[g] || [])) {
        sources.add(vg)
      }
    }
    return sources.size > 0 ? sources : null
  }

  // SWSH (Gen 8, sword-shield / IoA / CT only): same as SM/USUM
  if (gen === 8) {
    const swshVgs = new Set(['sword-shield', 'the-isle-of-armor', 'the-crown-tundra'])
    if (!swshVgs.has(versionGroup)) return null
    for (let g = 1; g <= 7; g++) {
      for (const vg of (generationVersionGroups[g] || [])) {
        sources.add(vg)
      }
    }
    return sources.size > 0 ? sources : null
  }

  return null
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
