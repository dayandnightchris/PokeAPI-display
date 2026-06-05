// Convert a kebab-case API name to a human-readable Title Case label.
// e.g. "ultra-moon" → "Ultra Moon", "high-jump-kick" → "High Jump Kick"
export function titleCase(str) {
  if (!str) return str
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Title-case a location-area API name, dropping the trailing "-area" suffix
// and fixing up multi-word version names embedded in the string.
export function formatLocationName(name) {
  if (!name) return name
  return titleCase(name.replace(/-area$/, ''))
    .replace(/Firered/g, 'Fire Red')
    .replace(/Leafgreen/g, 'Leaf Green')
    .replace(/Heartgold/g, 'Heart Gold')
    .replace(/Soulsilver/g, 'Soul Silver')
}

// Pokémon height — PokéAPI gives decimetres. → "0.6 m (2′00″)"
// Imperial is rounded to the nearest inch, matching the in-game display.
export function formatHeight(decimetres) {
  if (!decimetres) return 'N/A'
  const meters = (decimetres / 10).toFixed(1)
  const totalInches = Math.round(decimetres * 3.93701)
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${meters} m (${feet}′${String(inches).padStart(2, '0')}″)`
}

// Pokémon weight — PokéAPI gives hectograms. → "8.5 kg (18.7 lbs)"
export function formatWeight(hectograms) {
  if (!hectograms) return 'N/A'
  const kg = (hectograms / 10).toFixed(1)
  const lbs = (hectograms / 10 * 2.20462).toFixed(1)
  return `${kg} kg (${lbs} lbs)`
}
