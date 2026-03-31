import { versionGeneration } from './versionInfo'

/**
 * Defensive type effectiveness charts for each era of Pokémon games.
 *
 * Each type maps to { resists, weak, immune }.
 * "veryWeak" is always [] here — it is computed at dual-type combination time.
 *
 * Three eras:
 *   Gen 1       – No Dark, Steel, Fairy. Ghost cannot hit Psychic (Psychic immune to Ghost).
 *                  Poison is weak to Bug. Ice has no Fire resistance (unchanged).
 *   Gen 2–5     – Dark, Steel added. No Fairy. Steel resists Ghost and Dark.
 *   Gen 6+      – Fairy added. Steel loses Ghost/Dark resistances.
 */

// ── Gen 6+ (modern, current default) ──────────────────────────────────────────
const gen6Plus = {
  normal:   { resists: [],                                                          weak: ['fighting'],                          immune: ['ghost'] },
  fire:     { resists: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'],           weak: ['water', 'ground', 'rock'],           immune: [] },
  water:    { resists: ['fire', 'water', 'ice', 'steel'],                           weak: ['electric', 'grass'],                 immune: [] },
  electric: { resists: ['electric', 'flying', 'steel'],                             weak: ['ground'],                            immune: [] },
  grass:    { resists: ['water', 'electric', 'grass', 'ground'],                    weak: ['fire', 'ice', 'poison', 'flying', 'bug'], immune: [] },
  ice:      { resists: ['ice'],                                                     weak: ['fire', 'fighting', 'rock', 'steel'], immune: [] },
  fighting: { resists: ['rock', 'bug', 'dark'],                                    weak: ['flying', 'psychic', 'fairy'],        immune: [] },
  poison:   { resists: ['fighting', 'poison', 'bug', 'grass', 'fairy'],             weak: ['ground', 'psychic'],                 immune: [] },
  ground:   { resists: ['poison', 'rock'],                                          weak: ['water', 'grass', 'ice'],             immune: ['electric'] },
  flying:   { resists: ['fighting', 'bug', 'grass'],                                weak: ['electric', 'ice', 'rock'],           immune: ['ground'] },
  psychic:  { resists: ['fighting', 'psychic'],                                     weak: ['bug', 'ghost', 'dark'],              immune: [] },
  bug:      { resists: ['fighting', 'ground', 'grass'],                             weak: ['fire', 'flying', 'rock'],            immune: [] },
  rock:     { resists: ['normal', 'flying', 'poison', 'fire'],                      weak: ['water', 'grass', 'fighting', 'ground', 'steel'], immune: [] },
  ghost:    { resists: ['poison', 'bug'],                                           weak: ['ghost', 'dark'],                     immune: ['normal', 'fighting'] },
  dragon:   { resists: ['fire', 'water', 'electric', 'grass'],                      weak: ['ice', 'dragon', 'fairy'],            immune: [] },
  dark:     { resists: ['ghost', 'dark'],                                           weak: ['fighting', 'bug', 'fairy'],          immune: ['psychic'] },
  steel:    { resists: ['normal', 'flying', 'rock', 'bug', 'steel', 'grass', 'psychic', 'ice', 'dragon', 'fairy'], weak: ['fire', 'fighting', 'ground'], immune: ['poison'] },
  fairy:    { resists: ['fighting', 'bug', 'dark'],                                 weak: ['poison', 'steel'],                   immune: ['dragon'] },
}

// ── Gen 2–5 ───────────────────────────────────────────────────────────────────
// Changes from Gen 6+:
//   • No Fairy type
//   • Steel resists Ghost and Dark (lost in Gen 6)
//   • Fire does not resist Fairy (doesn't exist)
//   • Poison does not resist Fairy (doesn't exist)
//   • Bug is now resisted by Poison (was weak in Gen 1, but Poison resists Bug in Gen 2+)
//   • Poison is now neutral to bug (was weak in Gen 1, but Bug is neutral to Poison in Gen 2+)
//   • Dragon is not weak to Fairy / not immune to anything from Fairy
//   • Fighting not weak to Fairy
//   • Dark not weak to Fairy
//   • Steel resists: + ghost, dark; – fairy
const gen2to5 = {
  normal:   { resists: [],                                                          weak: ['fighting'],                          immune: ['ghost'] },
  fire:     { resists: ['fire', 'grass', 'ice', 'bug', 'steel'],                   weak: ['water', 'ground', 'rock'],           immune: [] },
  water:    { resists: ['fire', 'water', 'ice', 'steel'],                           weak: ['electric', 'grass'],                 immune: [] },
  electric: { resists: ['electric', 'flying', 'steel'],                             weak: ['ground'],                            immune: [] },
  grass:    { resists: ['water', 'electric', 'grass', 'ground'],                    weak: ['fire', 'ice', 'poison', 'flying', 'bug'], immune: [] },
  ice:      { resists: ['ice'],                                                     weak: ['fire', 'fighting', 'rock', 'steel'], immune: [] },
  fighting: { resists: ['rock', 'bug', 'dark'],                                    weak: ['flying', 'psychic'],                 immune: [] },
  poison:   { resists: ['fighting', 'poison', 'bug', 'grass'],                      weak: ['ground', 'psychic'],                 immune: [] },
  ground:   { resists: ['poison', 'rock'],                                          weak: ['water', 'grass', 'ice'],             immune: ['electric'] },
  flying:   { resists: ['fighting', 'bug', 'grass'],                                weak: ['electric', 'ice', 'rock'],           immune: ['ground'] },
  psychic:  { resists: ['fighting', 'psychic'],                                     weak: ['bug', 'ghost', 'dark'],              immune: [] },
  bug:      { resists: ['fighting', 'ground', 'grass'],                             weak: ['fire', 'flying', 'rock'],            immune: [] },
  rock:     { resists: ['normal', 'flying', 'poison', 'fire'],                      weak: ['water', 'grass', 'fighting', 'ground', 'steel'], immune: [] },
  ghost:    { resists: ['poison', 'bug'],                                           weak: ['ghost', 'dark'],                     immune: ['normal', 'fighting'] },
  dragon:   { resists: ['fire', 'water', 'electric', 'grass'],                      weak: ['ice', 'dragon'],                     immune: [] },
  dark:     { resists: ['ghost', 'dark'],                                           weak: ['fighting', 'bug'],                   immune: ['psychic'] },
  steel:    { resists: ['normal', 'flying', 'rock', 'bug', 'steel', 'grass', 'psychic', 'ice', 'dragon', 'ghost', 'dark'], weak: ['fire', 'fighting', 'ground'], immune: ['poison'] },
}

// ── Gen 1 ─────────────────────────────────────────────────────────────────────
// Changes from Gen 2–5:
//   • No Dark, Steel, or Fairy types
//   • Psychic is immune to Ghost (game bug — Ghost was supposed to be SE)
//   • Poison is weak to Bug (Bug SE vs Poison) and vice versa (Poison SE vs Bug)
//   • Bug does NOT resist Poison — instead it is weak to Poison
//   • Fire does NOT resist Ice (Ice is neutral vs Fire)
//   • Ghost not resistant to Poison (Poison neutral vs Ghost)
const gen1 = {
  normal:   { resists: [],                                                 weak: ['fighting'],                          immune: ['ghost'] },
  fire:     { resists: ['fire', 'grass', 'bug'],                          weak: ['water', 'ground', 'rock'],           immune: [] },
  water:    { resists: ['fire', 'water', 'ice'],                           weak: ['electric', 'grass'],                 immune: [] },
  electric: { resists: ['electric', 'flying'],                             weak: ['ground'],                            immune: [] },
  grass:    { resists: ['water', 'electric', 'grass', 'ground'],           weak: ['fire', 'ice', 'poison', 'flying', 'bug'], immune: [] },
  ice:      { resists: ['ice'],                                            weak: ['fire', 'fighting', 'rock'],          immune: [] },
  fighting: { resists: ['rock', 'bug'],                                    weak: ['flying', 'psychic'],                 immune: [] },
  poison:   { resists: ['fighting', 'poison', 'grass'],                    weak: ['ground', 'psychic', 'bug'],          immune: [] },
  ground:   { resists: ['poison', 'rock'],                                 weak: ['water', 'grass', 'ice'],             immune: ['electric'] },
  flying:   { resists: ['fighting', 'bug', 'grass'],                       weak: ['electric', 'ice', 'rock'],           immune: ['ground'] },
  psychic:  { resists: ['fighting', 'psychic'],                            weak: ['bug'],                               immune: ['ghost'] },
  bug:      { resists: ['fighting', 'ground', 'grass'],                    weak: ['fire', 'flying', 'rock', 'poison'],  immune: [] },
  rock:     { resists: ['normal', 'flying', 'poison', 'fire'],             weak: ['water', 'grass', 'fighting', 'ground'], immune: [] },
  ghost:    { resists: ['bug'],                                            weak: ['ghost'],                             immune: ['normal', 'fighting'] },
  dragon:   { resists: ['fire', 'water', 'electric', 'grass'],             weak: ['ice', 'dragon'],                     immune: [] },
}

/**
 * Return the correct defensive type-effectiveness chart for a given version.
 * Falls back to the Gen 6+ chart if version is null/unrecognised.
 */
export function getTypeEffectiveness(version) {
  const gen = version ? versionGeneration[version] : null
  if (gen === 1) return gen1
  if (gen >= 2 && gen <= 5) return gen2to5
  return gen6Plus
}
