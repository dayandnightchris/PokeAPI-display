import { versionGroupOrder, versionGroupForVersion } from './versionInfo'

// An ability's English effect text as it was in a given version, resolved
// from PokeAPI's effect_changes.
//
// Each effect_changes entry is a change point, like a move's past_values: its
// text is the ability's full effect BEFORE that version group (Trace has one
// at diamond-pearl for Gen 3 and one at black-white for Gen 4). The text in
// force for a version is the one from the NEAREST change point after it; with
// none after it, the current effect_entries apply.
//
// Returns null when the ability has no English effect text.
export function abilityEffectForVersion(ability, version) {
  if (!ability) return null
  const current = ability.effect_entries?.find(e => e.language?.name === 'en')
  const currentText = current?.effect || current?.short_effect || null

  const vg = version ? versionGroupForVersion(version) : null
  const selectedOrder = vg ? versionGroupOrder[vg] : null
  if (selectedOrder == null || !ability.effect_changes?.length) return currentText

  let nearest = null
  for (const change of ability.effect_changes) {
    const order = versionGroupOrder[change.version_group?.name]
    if (order == null || selectedOrder >= order) continue
    if (nearest && nearest.order <= order) continue
    const text = change.effect_entries?.find(e => e.language?.name === 'en')?.effect
    if (text) nearest = { order, text }
  }
  return nearest ? nearest.text : currentText
}
