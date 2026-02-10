import { useState, useEffect } from 'react'
import { fetchPokemonCached } from '../utils/pokeCache'

export function usePokemonForms({ species, pokemon, selectedVersion }) {
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [formPokemon, setFormPokemon] = useState(null)

  // Extract forms and set initial selected form, filtered by game version
  useEffect(() => {
    if (!species?.varieties?.length || !pokemon) return

    const getVersionAvailability = async (formName) => {
      try {
        const data = await fetchPokemonCached(formName)
        if (!data) return false
        // Check if this form exists in the selected version
        return data.game_indices?.some(gi => gi.version.name === selectedVersion) || false
      } catch (err) {
        console.error('Failed to check form availability:', formName, err)
        return false
      }
    }

    // Get all distinct form names from varieties
    let formList = species.varieties
      .map(v => v.pokemon.name)
      .filter(name => {
        // Filter to only forms of the current pokemon's evolution line
        const baseName = pokemon.name.split('-')[0]
        return name.startsWith(baseName)
      })
      .sort()

    // Filter forms by version availability
    if (selectedVersion) {
      const filterByVersion = async () => {
        const availableForms = []
        for (const form of formList) {
          const isAvailable = await getVersionAvailability(form)
          if (isAvailable) {
            availableForms.push(form)
          }
        }
        setForms(availableForms)

        // Auto-select the base form (without hyphen) or first form
        const baseForm = availableForms.find(f => !f.includes('-')) || availableForms[0]
        if (baseForm && baseForm !== selectedForm) {
          setSelectedForm(baseForm)
        }
      }
      filterByVersion()
    } else {
      setForms(formList)
      const baseForm = formList.find(f => !f.includes('-')) || formList[0]
      if (baseForm && baseForm !== selectedForm) {
        setSelectedForm(baseForm)
      }
    }
  }, [species?.varieties, pokemon, selectedVersion])

  // Fetch selected form's pokemon data
  useEffect(() => {
    if (!selectedForm || !pokemon || selectedForm === pokemon.name) {
      setFormPokemon(null)
      return
    }

    fetch(`https://pokeapi.co/api/v2/pokemon/${selectedForm}/`)
      .then(res => res.json())
      .then(data => setFormPokemon(data))
      .catch(err => console.error('Failed to fetch form pokemon:', selectedForm, err))
  }, [selectedForm, pokemon?.name])

  return { forms, selectedForm, setSelectedForm, formPokemon }
}
