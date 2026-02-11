import { useState, useEffect } from 'react'
import { fetchPokemonCached } from '../utils/pokeCache'
import { getVersionInfo } from '../utils/versionInfo'

export function usePokemonForms({ species, pokemon, selectedVersion, initialForm }) {
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [formPokemon, setFormPokemon] = useState(null)

  // Extract forms and set initial selected form, filtered by game version
  useEffect(() => {
    if (!pokemon) return

    let active = true

    const getVersionAvailability = async (formName, versionInfo) => {
      try {
        const data = await fetchPokemonCached(formName)
        if (!data) {
          if (!versionInfo?.versionGroup) return true
          const formRes = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${formName}/`)
          if (!formRes.ok) return false
          const formData = await formRes.json()
          if (formData?.version_group?.name === versionInfo.versionGroup) return true

          if (versionInfo.generation && formData?.version_group?.url) {
            const groupRes = await fetch(formData.version_group.url)
            if (!groupRes.ok) return false
            const groupData = await groupRes.json()
            return groupData?.generation?.name === versionInfo.generation
          }

          return false
        }
        // Check if this form exists in the selected version
        return data.game_indices?.some(gi => gi.version.name === selectedVersion) || false
      } catch (err) {
        console.error('Failed to check form availability:', formName, err)
        return false
      }
    }

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
      if (active) {
        setForms([])
        setSelectedForm(null)
      }
      return () => {
        active = false
      }
    }

    if (selectedVersion) {
      const filterByVersion = async () => {
        const versionInfo = await getVersionInfo(selectedVersion)
        const availableForms = []
        for (const form of formList) {
          if (!active) return
          const isAvailable = await getVersionAvailability(form, versionInfo)
          if (isAvailable) {
            availableForms.push(form)
          }
        }
        if (active) {
          setForms(availableForms)

          const baseForm = availableForms.find(f => !f.includes('-')) || availableForms[0]
          const preferredForm = initialForm && availableForms.includes(initialForm)
            ? initialForm
            : baseForm

          if (preferredForm && preferredForm !== selectedForm) {
            setSelectedForm(preferredForm)
          }
        }
      }
      filterByVersion()
    } else {
      setForms(formList)
      const baseForm = formList.find(f => !f.includes('-')) || formList[0]
      const preferredForm = initialForm && formList.includes(initialForm)
        ? initialForm
        : baseForm

      if (preferredForm && preferredForm !== selectedForm) {
        setSelectedForm(preferredForm)
      }
    }

    return () => {
      active = false
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
              types: formData?.types || pokemon.types
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
