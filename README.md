# PokéAPI Display

A modern Pokémon information website built with React and Vite, powered by [PokéAPI](https://pokeapi.co/). Browse Pokémon, moves, abilities, and items with accurate version-specific data spanning Generations 1–7.

## Features

### Pokémon Tab
- **Search with Autocomplete**: Find any Pokémon by name, ID, or form name
- **Version-Aware Display**: Select a game version to see generation-accurate stats, moves, abilities, and sprites
- **Interactive Stats Calculator**: Adjust level, nature, IVs, and EVs to see calculated stats (supports both modern and legacy Gen 1–2 formulas)
- **Evolution Chain**: Visual tree of all evolution paths with clickable navigation
- **Form Selector**: Switch between alternate forms (Mega, Alolan, Galarian, etc.)
- **Grouped Move List**: Moves organized by learn method, filtered to the selected version
- **Encounter Data**: Wild held items, catch rate, EV yield, and location details per version

### Moves Tab
- **Move Search**: Look up any move with autocomplete (Gen 1–7)
- **Move Details**: Type, category, power, accuracy, PP, priority, and version-specific flavor text
- **Learner Table**: Every Pokémon that can learn the move in the selected version, sortable by ID, name, type, or learn method

### Abilities Tab
- **Ability Search**: Look up any main-series ability with autocomplete (Gen 3–7)
- **Ability Details**: Effect description, generation badge, and version-specific flavor text
- **Pokémon Table**: All Pokémon with the ability in the selected generation, accounting for past ability changes via `past_abilities` data

### Items Tab
- **Item Search**: Look up any item with autocomplete
- **Item Details**: Sprite, category, cost, fling power, effect, and version-specific description
- **Wild Holders Table**: Pokémon that hold the item in the wild for the selected version, with hold chance percentages

### Cross-Tab Navigation
- Click a move name on the Pokémon page → jumps to the Moves tab
- Click an ability name → jumps to the Abilities tab
- Click a held item name → jumps to the Items tab
- Click a Pokémon name on any tab → jumps back to the Pokémon tab
- URL routing keeps deep links shareable (e.g. `/moves/emerald/thunderbolt`)

### General
- **Version Filtering**: Gen 8/9 excluded from selectors and autocomplete (Gens 1–7 focus)
- **Form Clamping**: Mega, Primal, G-Max, and Totem forms only appear in games where they exist
- **Caching**: Dual-layer cache (memory + localStorage with 7-day TTL) for fast repeat lookups
- **Responsive Design**: Works on desktop and tablet
- **Dark mode**: For those who appreciate it

## Project Structure

```
src/
├── main.jsx                        # React entry point
├── App.jsx                         # Main app with tab routing and cross-tab navigation
├── App.css                         # All app styles
├── index.css                       # Global styles
├── components/
│   ├── PokemonCard.jsx             # Pokémon display (stats, moves, abilities, encounters)
│   ├── PokemonSearch.jsx           # Search input with autocomplete
│   ├── StatsCalculator.jsx         # Interactive stat calculator (modern + legacy formulas)
│   ├── EvolutionTree.jsx           # Evolution chain visualization
│   ├── VersionSelector.jsx         # Game version dropdown
│   ├── MovePage.jsx                # Move lookup page
│   ├── AbilityPage.jsx             # Ability lookup page
│   └── ItemPage.jsx                # Item lookup page
├── hooks/
│   ├── useAbilityDescriptions.js   # Fetch and cache ability flavor text
│   ├── useEvolutionChain.js        # Fetch and process evolution chains
│   ├── useGroupedMoves.js          # Group moves by learn method per version
│   ├── usePokemonForms.js          # Fetch alternate forms
│   ├── usePokemonSpecies.js        # Fetch species data (flavor text, habitat, etc.)
│   ├── usePreEvolutionCheck.js     # Check pre-evolution move inheritance
│   ├── useVersionSprite.js         # Select version-appropriate sprites
│   └── index.js                    # Hook barrel export
└── utils/
    ├── pokeCache.js                # Dual-layer caching (memory + localStorage)
    ├── tradebackMoves.js           # Gen 1 tradeback move compatibility data
    └── versionInfo.js              # Version/generation mappings and utilities
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open `http://localhost:5173` (or the URL shown in the terminal).

### Building for Production

```bash
npm run build
```

The optimized production build will be output to the `dist/` folder.

## Tech Stack

- **React 18** — UI framework
- **Vite** — Build tool and dev server
- **PokéAPI v2** — Pokémon data source (no API key required)

## API

All data is fetched client-side from the free [PokéAPI](https://pokeapi.co/). No backend server is needed. Responses are cached in memory and localStorage to minimize API calls.

## Legal

Pokémon and all related names, characters, and imagery are trademarks and © of Nintendo, Game Freak, and The Pokémon Company. This is an unofficial project and is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.

Data provided by [PokéAPI](https://pokeapi.co/) under their terms of service.
