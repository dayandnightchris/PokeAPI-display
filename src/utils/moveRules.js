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
