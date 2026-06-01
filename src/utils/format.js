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
