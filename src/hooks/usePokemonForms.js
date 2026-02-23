import { useState, useEffect } from 'react'
import { versionGeneration } from '../utils/versionInfo'

/**
 * Determine if a form should be shown for the selected game version.
 * Uses generation-based rules instead of unreliable game_indices checks.
 */
function isFormAvailable(formName, basePokemonName, selectedVersion) {
  const gen = versionGeneration[selectedVersion]
  if (!gen) return true // unknown version, show all

  // Base form is always available
  if (formName === basePokemonName) return true

  const lowerForm = formName.toLowerCase()

  // --- Mega evolutions: Gen 6-7 + LGPE + Legends Z-A (Gen 9) ---
  if (lowerForm.includes('-mega')) {
    if (gen >= 6 && gen <= 7) return true
    if (gen === 9) return true // Legends Z-A
    return false
  }

  // --- Gigantamax: Sword/Shield only ---
  if (lowerForm.includes('-gmax')) {
    return ['sword', 'shield'].includes(selectedVersion)
  }

  // --- Totem forms: Gen 7 (SM/USUM) only ---
  if (lowerForm.includes('-totem')) {
    return gen === 7
  }

  // --- Regional forms ---
  // Alolan: Gen 7+ (LGPE included), but in PLA only Vulpix/Ninetales
  if (lowerForm.includes('-alola')) {
    if (selectedVersion === 'legends-arceus') {
      return lowerForm === 'vulpix-alola' || lowerForm === 'ninetales-alola'
    }
    return gen >= 7
  }

  // Galarian: SwSh + Gen 9+ (not in BDSP or PLA)
  if (lowerForm.includes('-galar')) {
    return gen >= 9 || ['sword', 'shield'].includes(selectedVersion)
  }

  // Hisuian: PLA + Gen 9+ (not in SwSh or BDSP)
  if (lowerForm.includes('-hisui')) {
    return selectedVersion === 'legends-arceus' || gen >= 9
  }

  // Paldean: Gen 9
  if (lowerForm.includes('-paldea')) return gen >= 9

  // --- Pikachu special forms ---
  // Cosplay Pikachu: ORAS only
  const cosplayForms = ['-rock-star', '-belle', '-pop-star', '-phd', '-libre', '-cosplay']
  if (cosplayForms.some(suffix => lowerForm.endsWith(suffix))) {
    return ['omega-ruby', 'alpha-sapphire'].includes(selectedVersion)
  }

  // Cap Pikachu: Gen 7+
  const capForms = ['-original-cap', '-hoenn-cap', '-sinnoh-cap', '-unova-cap', '-kalos-cap', '-alola-cap', '-partner-cap']
  if (capForms.some(suffix => lowerForm.endsWith(suffix))) {
    return gen >= 7
  }

  if (lowerForm.endsWith('-world-cap')) return gen >= 8
  if (lowerForm.endsWith('-starter')) return gen >= 7

  // Default: show the form. The user can only select versions where
  // the pokemon exists, so cosmetic forms (Unown letters, Vivillon
  // patterns, etc.) are safe to show.
  return true
}

export function usePokemonForms({ species, pokemon, selectedVersion, initialForm }) {
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [formPokemon, setFormPokemon] = useState(null)

  // Extract forms and set initial selected form, filtered by game version
  useEffect(() => {
    if (!pokemon) return

    const baseName = pokemon.name.split('-')[0]
    const varietyForms = (species?.varieties || [])
      .map(v => v.pokemon?.name)
      .filter(Boolean)
      .filter(name => name.startsWith(baseName))

    const pokemonForms = (pokemon.forms || [])
      .map(f => f.name)
      .filter(Boolean)

    const formList = Array.from(new Set([...varietyForms, ...pokemonForms])).sort()

    if (formList.length === 0) {
      setForms([])
      setSelectedForm(null)
      return
    }

    // Filter forms by selected version using synchronous rules
    const availableForms = selectedVersion
      ? formList.filter(form => isFormAvailable(form, pokemon.name, selectedVersion))
      : formList

    setForms(availableForms)

    const baseForm = availableForms.find(f => !f.includes('-')) || availableForms[0]
    const preferredForm = initialForm && availableForms.includes(initialForm)
      ? initialForm
      : baseForm

    if (preferredForm && preferredForm !== selectedForm) {
      setSelectedForm(preferredForm)
    }
  }, [species?.varieties, pokemon, selectedVersion, initialForm])

  // Fetch selected form's pokemon data
  useEffect(() => {
    if (!selectedForm || !pokemon || selectedForm === pokemon.name) {
      setFormPokemon(null)
      return
    }

    let active = true

    const loadForm = async () => {
      try {
        const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${selectedForm}/`)
        if (pokemonResponse.ok) {
          const data = await pokemonResponse.json()
          if (active) setFormPokemon(data)
          return
        }

        const formResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${selectedForm}/`)
        if (formResponse.ok) {
          const formData = await formResponse.json()
          if (active) {
            setFormPokemon({
              ...pokemon,
              name: formData?.name || selectedForm,
              sprites: formData?.sprites || pokemon.sprites,
              types: formData?.types?.length ? formData.types : pokemon.types
            })
          }
          return
        }

        if (active) setFormPokemon(null)
      } catch (err) {
        console.error('Failed to fetch form data:', selectedForm, err)
        if (active) setFormPokemon(null)
      }
    }

    loadForm()

    return () => {
      active = false
    }
  }, [selectedForm, pokemon])

  return { forms, selectedForm, setSelectedForm, formPokemon }
}
