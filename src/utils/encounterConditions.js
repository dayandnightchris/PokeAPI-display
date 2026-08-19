import { titleCase } from './format'

// Human labels for PokeAPI encounter condition-value names (Gen 1-7 families).
// Unknown values fall back to title-casing so new API additions degrade nicely.
const CONDITION_LABELS = {
  'time-morning': 'Morning',
  'time-day': 'Day',
  'time-night': 'Night',
  'season-spring': 'Spring',
  'season-summer': 'Summer',
  'season-autumn': 'Autumn',
  'season-winter': 'Winter',
  'swarm-yes': 'During swarm',
  'swarm-no': 'No swarm',
  'radar-on': 'PokéRadar',
  'radar-off': 'No PokéRadar',
  'slot2-none': 'No GBA game inserted',
  'slot2-ruby': 'Ruby in GBA slot',
  'slot2-sapphire': 'Sapphire in GBA slot',
  'slot2-emerald': 'Emerald in GBA slot',
  'slot2-firered': 'FireRed in GBA slot',
  'slot2-leafgreen': 'LeafGreen in GBA slot',
  'radio-on': 'Radio on',
  'radio-off': 'No radio',
  'radio-hoenn': 'Hoenn Sound radio',
  'radio-sinnoh': 'Sinnoh Sound radio',
}

export function formatEncounterCondition(name) {
  if (!name) return ''
  if (CONDITION_LABELS[name]) return CONDITION_LABELS[name]
  if (name.startsWith('story-progress-')) {
    return `Story: ${titleCase(name.slice('story-progress-'.length))}`
  }
  return titleCase(name)
}
