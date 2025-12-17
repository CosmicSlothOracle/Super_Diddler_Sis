# Super Diddler Sis

Epic fighting game with rhythm mechanics - A Smash Bros inspired 2D platformer with dance battle elements.

## About

Super Diddler Sis is a fast-paced 2D fighting game that combines platform fighter mechanics with rhythm-based gameplay. Players battle on dynamic stages while syncing their moves to the beat of the music.

## Features

- **2D Platform Fighter**: Smash Bros-inspired combat with unique character abilities
- **Rhythm Mechanics**: Sync attacks and movements to the beat for enhanced effects
- **Multiple Characters**: Each with unique movesets, combos, and special abilities
- **Dynamic Stages**: Interactive environments with animated backgrounds and stage hazards
- **WebGL Rendering**: High-performance graphics with WebGL and Canvas2D support
- **Cross-Platform**: Play in browser or as native Electron application

## Tech Stack

- **Frontend**: HTML5, Canvas2D, WebGL
- **Runtime**: Electron (for native builds) or Browser (for web deployment)
- **Build Tools**: Webpack, Babel
- **Audio**: Web Audio API with advanced effects and rhythm synchronization

## Quick Start

### Web Version (Recommended for Testing)

The game is deployed and playable in your browser:
- **Live Demo**: [Deploy to Netlify and add link here]

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/CosmicSlothOracle/Super_Diddler_Sis.git
   cd Super_Diddler_Sis
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build:prod
   ```

### Browser Testing (No Build Required)

For quick browser testing without Electron:
```bash
# Using Python
python -m http.server 8000

# Using Node.js serve
npx serve .

# Then open http://localhost:8000 in your browser
```

## Project Structure

```
Super_Diddler_Sis/
├── assets/           # Game assets (characters, audio, effects, UI)
├── data/             # Game data (characters.json, stages.json)
├── js/               # Game logic and systems
├── levels/           # Stage definitions and assets
├── electron-main/    # Electron main process
├── index.html        # Entry point
└── netlify.toml      # Netlify deployment configuration
```

## Key Systems

- **Attack System**: Modular attack catalog with combo support
- **Physics Engine**: Custom 2D physics with collision detection
- **Audio System**: Rhythm-synchronized music and sound effects
- **Renderer**: WebGL and Canvas2D rendering pipeline
- **Input Handler**: Keyboard and gamepad support with customizable bindings

## Documentation

- [Architecture Guidelines](ARCHITECTURE_GUIDELINES.md)
- [Attack System Guide](docs/ATTACK_SYSTEM_GUIDE.md)
- [Web Deployment Analysis](WEB_DEPLOYMENT_ANALYSIS.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)

## Development

### Dev Mode

Enable dev mode for debugging:
- **Electron**: Use `npm run dev` (automatically enables dev mode)
- **Browser**: Add `?dev` to URL or set `localStorage.setItem('devMode', 'true')`

### Building

- **Development Build**: `npm run build:dev`
- **Production Build**: `npm run build:prod` (includes Electron packaging)

## Deployment

The project is configured for deployment on Netlify. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

### Netlify Deployment

1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: (leave empty)
   - Publish directory: `.` (root)
3. Deploy automatically on every push to `main` branch

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Links

- **Repository**: https://github.com/CosmicSlothOracle/Super_Diddler_Sis
- **Issues**: https://github.com/CosmicSlothOracle/Super_Diddler_Sis/issues
