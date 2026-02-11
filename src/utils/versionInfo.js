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
