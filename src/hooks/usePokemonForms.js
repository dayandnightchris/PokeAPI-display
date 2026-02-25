import { useState, useEffect, useRef } from 'react'
import { versionGeneration } from '../utils/versionInfo'
import { fetchPokemonCached } from '../utils/pokeCache'

// Map version groups to individual version names for API-based availability checks
const versionGroupToVersions = {
  'red-blue': ['red', 'blue'],
  'yellow': ['yellow'],
  'gold-silver': ['gold', 'silver'],
  'crystal': ['crystal'],
  'ruby-sapphire': ['ruby', 'sapphire'],
  'emerald': ['emerald'],
  'firered-leafgreen': ['firered', 'leafgreen'],
  'colosseum': ['colosseum'],
  'xd': ['xd'],
  'diamond-pearl': ['diamond', 'pearl'],
  'platinum': ['platinum'],
  'heartgold-soulsilver': ['heartgold', 'soulsilver'],
  'black-white': ['black', 'white'],
  'black-2-white-2': ['black-2', 'white-2'],
  'x-y': ['x', 'y'],
  'omega-ruby-alpha-sapphire': ['omega-ruby', 'alpha-sapphire'],
  'sun-moon': ['sun', 'moon'],
  'ultra-sun-ultra-moon': ['ultra-sun', 'ultra-moon'],
  'lets-go-pikachu-lets-go-eevee': ['lets-go-pikachu', 'lets-go-eevee'],
  'sword-shield': ['sword', 'shield'],
  'brilliant-diamond-shining-pearl': ['brilliant-diamond', 'shining-pearl'],
  'legends-arceus': ['legends-arceus'],
  'scarlet-violet': ['scarlet', 'violet'],
  'the-teal-mask': ['scarlet', 'violet'],
  'the-indigo-disk': ['scarlet', 'violet'],
  'legends-za': ['legends-za'],
  'mega-dimension': ['legends-za'],
  'the-isle-of-armor': ['sword', 'shield'],
  'the-crown-tundra': ['sword', 'shield'],
}

/**
 * Module-level cache: form name → Set of available version names.
 * Populated by fetching the form's /pokemon/ endpoint and inspecting
 * game_indices + moves version_group_details.
 */
const formVersionCache = new Map()

async function getFormAvailableVersions(formName) {
  if (formVersionCache.has(formName)) return formVersionCache.get(formName)

  const data = await fetchPokemonCached(formName)

  // If the pokemon entry has game_indices or moves, derive versions from those
  if (data) {
    const available = new Set()
    if (data.game_indices) {
      data.game_indices.forEach(gi => {
        if (gi.version?.name) available.add(gi.version.name)
      })
    }
    if (data.moves) {
      data.moves.forEach(move => {
        move.version_group_details?.forEach(vgd => {
          const vgName = vgd.version_group?.name
          const versions = versionGroupToVersions[vgName]
          if (versions) versions.forEach(v => available.add(v))
        })
      })
    }
    // If we found versions from the pokemon data, use them
    if (available.size > 0) {
      formVersionCache.set(formName, available)
      return available
    }
  }

  // Fallback: check /pokemon-form/ endpoint for version_group
  // This handles PLZA megas and other forms with empty moves/game_indices
  try {
    const formRes = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${formName}/`)
    if (formRes.ok) {
      const formData = await formRes.json()
      const vgName = formData?.version_group?.name
      if (vgName) {
        const versions = versionGroupToVersions[vgName]
        const available = new Set(versions || [])
        formVersionCache.set(formName, available)
        return available
      }
    }
  } catch (err) {
    console.error('Failed to fetch form:', formName, err)
  }

  return null
}

/**
 * Determine if a form should be shown for the selected game version.
 * Used for forms that DON'T need an API lookup (non-mega forms).
 * Mega forms are checked via getFormAvailableVersions instead.
 */
function isFormAvailable(formName, basePokemonName, selectedVersion) {
  const gen = versionGeneration[selectedVersion]
  if (!gen) return true // unknown version, show all

  // Base form is always available
  if (formName === basePokemonName) return true

  const lowerForm = formName.toLowerCase()

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

  // Starter forms: exclusive to Let's Go games
  if (lowerForm === 'pikachu-starter' || lowerForm === 'eevee-starter') {
    return ['lets-go-pikachu', 'lets-go-eevee'].includes(selectedVersion)
  }

  // Spiky-eared Pichu: HeartGold/SoulSilver only
  if (lowerForm === 'pichu-spiky-eared') {
    return ['heartgold', 'soulsilver'].includes(selectedVersion)
  }

  // Default: show the form. The user can only select versions where
  // the pokemon exists, so cosmetic forms (Unown letters, Vivillon
  // patterns, etc.) are safe to show.
  return true
}

/**
 * For version-exclusive non-mega forms, return the best version to switch to.
 * Used when a searched form isn't available in the current version.
 */
function getFormFallbackVersion(formName) {
  const lower = formName.toLowerCase()
  if (lower === 'pikachu-starter' || lower === 'eevee-starter') return 'lets-go-pikachu'
  if (lower === 'pichu-spiky-eared') return 'heartgold'
  const cosplayForms = ['-rock-star', '-belle', '-pop-star', '-phd', '-libre', '-cosplay']
  if (cosplayForms.some(suffix => lower.endsWith(suffix))) return 'omega-ruby'
  if (lower.includes('-gmax')) return 'sword'
  if (lower.includes('-totem')) return 'sun'
  return null
}

/**
 * For version-exclusive forms, return the set of versions they're restricted to.
 * Returns null for non-exclusive forms (no restriction).
 */
function getFormExclusiveVersions(formName) {
  const lower = formName.toLowerCase()
  if (lower === 'pikachu-starter' || lower === 'eevee-starter')
    return new Set(['lets-go-pikachu', 'lets-go-eevee'])
  if (lower === 'pichu-spiky-eared')
    return new Set(['heartgold', 'soulsilver'])
  const cosplayForms = ['-rock-star', '-belle', '-pop-star', '-phd', '-libre', '-cosplay']
  if (cosplayForms.some(suffix => lower.endsWith(suffix)))
    return new Set(['omega-ruby', 'alpha-sapphire'])
  if (lower.includes('-gmax'))
    return new Set(['sword', 'shield'])
  if (lower.includes('-totem'))
    return new Set(['sun', 'moon', 'ultra-sun', 'ultra-moon'])
  return null
}

export function usePokemonForms({ species, pokemon, selectedVersion, initialForm }) {
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [formPokemon, setFormPokemon] = useState(null)
  const [formSuggestedVersion, setFormSuggestedVersion] = useState(null)
  const [formVersionFilter, setFormVersionFilter] = useState(null)
  const prevPokemonIdRef = useRef(null)
  // Tracks which initialForm value has been successfully applied, so we
  // keep trying across async re-renders (e.g. when species loads) but
  // don't re-apply after the user manually changes forms.
  const initialFormAppliedRef = useRef(null)

  // Extract forms and set initial selected form, filtered by game version
  useEffect(() => {
    if (!pokemon) return

    let active = true
    const pokemonChanged = prevPokemonIdRef.current !== pokemon.id
    prevPokemonIdRef.current = pokemon.id

    // When initialForm is cleared (start of a new search), reset the applied
    // tracking so the same form name can be re-applied on the next search.
    if (!initialForm) {
      initialFormAppliedRef.current = null
    }

    const baseName = pokemon.name.split('-')[0]
    const varietyForms = (species?.varieties || [])
      .map(v => v.pokemon?.name)
      .filter(Boolean)
      .filter(name => name.startsWith(baseName))

    const pokemonForms = (pokemon.forms || [])
      .map(f => f.name)
      .filter(Boolean)

    const formList = Array.from(new Set([...varietyForms, ...pokemonForms]))
      .filter(name => {
        const lower = name.toLowerCase()
        // Hide Pikachu cap forms (too many cosmetic variants)
        if (lower.startsWith('pikachu-') && lower.endsWith('-cap')) return false
        // Hide Alcremie cosmetic variants (63 cream/swirl+sweet combos)
        if (lower.startsWith('alcremie-') && lower !== 'alcremie-gmax') return false
        return true
      })
      .sort()

    if (formList.length === 0) {
      setForms([])
      setSelectedForm(null)
      return
    }

    // Identify mega forms that need API-based availability checks
    const megaForms = formList.filter(f => f.toLowerCase().includes('-mega'))

    const applyFilteredForms = (megaAvailMap) => {
      if (!active) return

      let availableForms = selectedVersion
        ? formList.filter(form => {
            // Mega forms: use API-sourced version data
            if (megaAvailMap.has(form)) {
              return megaAvailMap.get(form).has(selectedVersion)
            }
            // Everything else: synchronous rules
            return isFormAvailable(form, pokemon.name, selectedVersion)
          })
        : formList

      // When the user explicitly searched for a form, force-include it so it can be selected.
      // Use initialFormAppliedRef to keep trying across async re-renders (species load)
      // without re-applying after the user manually changes forms.
      const needsInitialForm = initialForm && initialFormAppliedRef.current !== initialForm
      const wantedForm = needsInitialForm
        ? initialForm
        : (pokemonChanged && pokemon.name.includes('-') ? pokemon.name : null)

      if (wantedForm && !availableForms.includes(wantedForm) && formList.includes(wantedForm)) {
        availableForms = [...availableForms, wantedForm]

        // If the wanted form has known version availability that doesn't match
        // the current version, suggest a switch (e.g. PLZA megas → legends-za)
        const formVersions = megaAvailMap.get(wantedForm) || formVersionCache.get(wantedForm)
        if (formVersions && formVersions.size > 0 && selectedVersion && !formVersions.has(selectedVersion)) {
          setFormSuggestedVersion(Array.from(formVersions)[0])
        } else if (selectedVersion && !isFormAvailable(wantedForm, pokemon.name, selectedVersion)) {
          // Non-mega exclusive forms (starters, spiky-eared pichu, cosplay, etc.)
          const fallback = getFormFallbackVersion(wantedForm)
          setFormSuggestedVersion(fallback)
        } else {
          setFormSuggestedVersion(null)
        }
      } else {
        setFormSuggestedVersion(null)
      }

      setForms(availableForms)

      const baseForm = availableForms.find(f => !f.includes('-')) || availableForms[0]

      // Mark initialForm as applied if it's in the available list
      if (needsInitialForm && availableForms.includes(initialForm)) {
        initialFormAppliedRef.current = initialForm
      }

      setSelectedForm(prev => {
        // When only version/species changed (not the pokemon), keep current form if still valid
        // But don't skip if we still need to apply an initialForm
        if (!pokemonChanged && !needsInitialForm && prev && availableForms.includes(prev)) {
          return prev
        }
        // Explicit initialForm from search (form-only endpoints)
        if (initialForm && availableForms.includes(initialForm)) {
          return initialForm
        }
        // Pokemon.name itself is a form (e.g. searched "avalugg-hisui" directly)
        if (availableForms.includes(pokemon.name)) {
          return pokemon.name
        }
        return baseForm
      })
    }

    if (megaForms.length > 0 && selectedVersion) {
      // Fetch mega availability from API (cached after first call)
      Promise.all(megaForms.map(async (form) => {
        const versions = await getFormAvailableVersions(form)
        return [form, versions]
      })).then(results => {
        const megaAvailMap = new Map()
        for (const [form, versions] of results) {
          // If API fetch failed (null), use empty set → hides the form
          megaAvailMap.set(form, versions || new Set())
        }
        applyFilteredForms(megaAvailMap)
      })
    } else {
      // No megas — fast synchronous path
      applyFilteredForms(new Map())
    }

    return () => { active = false }
  }, [species?.varieties, pokemon, selectedVersion, initialForm])

  // Fetch selected form's pokemon data and update version filter
  useEffect(() => {
    if (!selectedForm || !pokemon || selectedForm === pokemon.name) {
      setFormPokemon(null)
      setFormVersionFilter(null)
      return
    }

    // Compute version restriction for the selected form
    setFormVersionFilter(getFormExclusiveVersions(selectedForm))

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

  return { forms, selectedForm, setSelectedForm, formPokemon, formSuggestedVersion, formVersionFilter }
}
