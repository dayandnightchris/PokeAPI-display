# PokeAPI Display

A modern and clean Pokémon information website developed with React and Vite. It displays Pokémon data from PokéAPI.co, featuring an improved user interface and experience.

## Features

- **Clean Layout**: Information organized by importance - stats, evolution, and catch details right at the top
- **Interactive Stats Calculator**: Change Pokemon level and nature to see calculated stats
- **Evolution Chain**: Visual display of Pokémon evolution paths
- **Comprehensive Data**: Stats, moves, abilities, height, weight, and more
- **Type Badges**: Color-coded Pokemon types
- **Responsive Design**: Works on desktop and tablet

## Project Structure

```
src/
├── main.jsx          # React entry point
├── App.jsx          # Main app component with search
├── App.css          # App-specific styles
├── index.css        # Global styles
└── components/
    ├── PokemonSearch.jsx    # Search input component
    ├── PokemonCard.jsx     # Pokemon display component
    └── StatsCalculator.jsx # Interactive stats component
```

## Getting Started

### Prerequisites
- Node.js 18+ (or higher, though the project was tested with Node 18)
- npm

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**: 
   Navigate to `http://localhost:5173` (or the URL shown in the terminal)

### Building for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` folder.

## How to Use

1. Enter a Pokémon name or ID in the search box
2. Click "Search" or press Enter
3. View the Pokémon's information:
   - **Header**: Image, name, type badges
   - **Critical Info**: Stats (with level/nature calculator), evolution chain, basic details
   - **Moves**: List of all learnable moves
   - **Additional Info**: Species description and habitat

### Stats Calculator

- **Level**: Adjust 1-100 to see stats at different levels
- **Nature**: Select different natures to see stat modifiers (nature affects stats by ±10%)

## API

This project uses the free [PokéAPI](https://pokeapi.co/) - no API key required.

## Layout Inspiration

The layout prioritizes actually useful information:
- ✅ Most important info visible at top (stats, evolution, catch details)
- ✅ Organized sections instead of walls of text
- ✅ Interactive features (stat calculator with level/nature)
- ✅ No useless filler at the top
- ✅ Search autocomplete

## Next Steps to Enhance (maybe)

- [ ] Add Pokemon list/grid browse view
- [ ] Save favorite Pokémon
- [ ] Add filtering by type
- [ ] Item/ability information pages
- [ ] Dark mode toggle


## Development

The project uses:
- **React 18** - UI framework
- **Vite** - Fast build tool and dev server
- **PokéAPI v2** - Pokemon data source

## Notes

- Pokémon data is fetched on-demand from PokéAPI (no backend server needed!)
- Stats calculation follows official Pokémon formula with IV=31, EV=63
- Some older Pokémon have limited art in official-artwork; those will show available sprites

## License

This is a learning project. PokéAPI data is provided under their terms of service. Thinking about adding one later.
