# BlisyDex

A modern Pokémon information website built with React and Vite, powered by [PokéAPI](https://pokeapi.co/). Browse Pokémon, moves, abilities, items, locations, and egg move breeding chains with accurate version-specific data spanning Generations 1–7.

## Features

### Unified Search
- **Cross-category search bar** that searches Pokémon, moves, abilities, items, and locations simultaneously
- Results are grouped by category with the active tab's category prioritised
- Supports search by name, ID, or form name

### Pokémon Tab
- **Version-Aware Display**: Select a game version to see generation-accurate stats, moves, abilities, and sprites
- **Interactive Stats Calculator**: Adjust level, nature, IVs, and EVs to see calculated stats (supports both modern and legacy Gen 1–2 formulas)
- **Type Effectiveness**: Defensive type matchups that update per generation (Gen 1, Gen 2–5, Gen 6+ charts)
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

### Locations Tab
- **Location Search**: Look up any in-game location with autocomplete
- **Encounter Tables**: See which Pokémon appear at a location, grouped by area and sorted by encounter method, level range, conditions, and encounter rate
- **Version Filtering**: Select a game version to see only that version's encounters, with version availability tags on each row
- **Collapsible Rows**: Pokémon with multiple encounter methods are grouped into expandable rows

### Egg Moves Tab
- **Egg Move Lookup**: Search for any breedable Pokémon to see its full egg move list
- **Breeding Chain Parents**: Expand any egg move to see which Pokémon can pass it down, with learn method details (level-up, TM, tutor, chain breed, Smeargle Sketch)
- **Version-Aware Breeding**: Filters parents and learn methods to the selected version group, respecting isolated games (LGPE, BDSP, PLA) and cross-generation transfer rules
- **Version-Aware Egg Groups**: Collects egg groups from the entire evolutionary line for accurate parent matching

### Cross-Tab Navigation
- Click a move name on the Pokémon page → jumps to the Moves tab
- Click an ability name → jumps to the Abilities tab
- Click a held item name → jumps to the Items tab
- Click a location name → jumps to the Locations tab
- Click an egg move → jumps to the Egg Moves tab with the move pre-expanded
- Click a Pokémon name on any tab → jumps back to the Pokémon tab
- The selected game version carries across tab switches
- URL routing keeps deep links shareable (e.g. `/moves/emerald/thunderbolt`, `/locations/ultra-moon/mt-coronet`)

### General
- **Version Filtering**: Gen 8/9 excluded from selectors and autocomplete (Gens 1–7 focus)
- **Form Clamping**: Mega, Primal, G-Max, and Totem forms only appear in games where they exist
- **Caching**: Dual-layer cache (memory + localStorage with 7-day TTL) for fast repeat lookups, with batch preloading for egg move parents
- **Responsive Design**: Works on desktop and tablet
- **Dark Mode**: Solrock/Lunatone toggle for light/dark themes

## Project Structure

```
src/
├── main.jsx                        # React entry point
├── App.jsx                         # Main app with tab routing and cross-tab navigation
├── App.css                         # All app styles
├── index.css                       # Global styles
├── components/
│   ├── UnifiedSearch.jsx           # Cross-category search bar (Pokémon, moves, abilities, items, locations)
│   ├── PokemonCard.jsx             # Pokémon display (stats, types, moves, abilities, encounters)
│   ├── PokemonSearch.jsx           # Legacy search input with autocomplete
│   ├── StatsCalculator.jsx         # Interactive stat calculator (modern + legacy formulas)
│   ├── EvolutionTree.jsx           # Evolution chain visualization
│   ├── VersionSelector.jsx         # Game version dropdown
│   ├── MovePage.jsx                # Move lookup page
│   ├── AbilityPage.jsx             # Ability lookup page
│   ├── ItemPage.jsx                # Item lookup page
│   ├── LocationPage.jsx            # Location encounter lookup page
│   └── EggMoveTab.jsx              # Egg move breeding chain explorer
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
    ├── pokeCache.js                # Dual-layer caching (memory + localStorage) with batch preloading
    ├── tradebackMoves.js           # Gen 1 tradeback move compatibility data
    ├── typeEffectiveness.js        # Defensive type charts for Gen 1, Gen 2–5, and Gen 6+
    └── versionInfo.js              # Version/generation mappings, transfer rules, and egg group utilities
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

### Deploying to GitHub Pages

```bash
npm run deploy
```

## Tech Stack

- **React 18** — UI framework
- **Vite** — Build tool and dev server
- **PokéAPI v2** — Pokémon data source (no API key required)

## API

All data is fetched client-side from the free [PokéAPI](https://pokeapi.co/). No backend server is needed. Responses are cached in memory and localStorage to minimize API calls.

## Legal

Pokémon and all related names, characters, and imagery are trademarks and © of Nintendo, Game Freak, and The Pokémon Company. This is an unofficial project and is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.

Data provided by [PokéAPI](https://pokeapi.co/) under their terms of service.
