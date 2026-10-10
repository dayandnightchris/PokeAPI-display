import { versionGroupOrder } from './versionInfo'

// A move's values as they were at a given point in the version-group order,
// resolved from PokeAPI's past_values.
//
// Each past_values entry is a change point: its non-null fields are the values
// that were in effect BEFORE that version group, and a null field means that
// field didn't change there. A field that changed more than once has several
// entries (Tackle: power 35 before black-white, 50 before sun-moon), and the
// value in force for a version is the one from the NEAREST change point after
// it — not the last one listed. The API lists entries oldest first, so apply
// the later change points first and let the nearest one win.
//
// Returns the same object when nothing applies, else an adjusted shallow copy.
export function applyPastValues(move, selectedOrder) {
  if (!move || selectedOrder == null || !move.past_values?.length) return move

  const applicable = move.past_values
    .map(entry => ({ entry, order: versionGroupOrder[entry.version_group?.name] }))
    .filter(({ order }) => order != null && selectedOrder < order)
    .sort((a, b) => b.order - a.order)
  if (!applicable.length) return move

  const adjusted = { ...move }
  for (const { entry } of applicable) {
    if (entry.power != null) adjusted.power = entry.power
    if (entry.pp != null) adjusted.pp = entry.pp
    if (entry.accuracy != null) adjusted.accuracy = entry.accuracy
    if (entry.effect_chance != null) adjusted.effect_chance = entry.effect_chance
    if (entry.type != null) adjusted.type = entry.type
    if (entry.effect_entries?.length) adjusted.effect_entries = entry.effect_entries
  }
  return adjusted
}

// In Gens 1-3 move category was determined by type, not per-move.
const physicalTypes = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])
const specialTypes = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'])

export function getMoveCategoryForGen(move, generationNum) {
  // Gens 1-3: category is based on type, not the move's own damage_class
  if (generationNum && generationNum <= 3) {
    const typeName = move.details?.type?.name
    if (!typeName) return move.details?.damage_class?.name || null
    // Status moves remain status regardless of generation
    if (move.details?.damage_class?.name === 'status') return 'status'
    if (physicalTypes.has(typeName)) return 'physical'
    if (specialTypes.has(typeName)) return 'special'
  }
  return move.details?.damage_class?.name || null
}
