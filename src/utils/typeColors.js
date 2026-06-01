// Type color map and readable-text helpers, shared across components.
export const typeColors = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
  unknown: '#4D7A70'
}

export const getTypeColor = (typeName) => typeColors[typeName?.toLowerCase()] || '#999'

// Returns dark or white text based on background luminance for readability
export const getTypeTextColor = (typeName) => {
  const hex = getTypeColor(typeName)
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lum = 0.2126 * (r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4)
            + 0.7152 * (g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4)
            + 0.0722 * (b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4)
  return lum > 0.35 ? '#333' : '#fff'
}
