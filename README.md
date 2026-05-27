<div align="center">

# Super Diddler Sis

**Superdiddle me timbers** — a Smash-style 2D platform fighter with rhythm, dance battles, and way too much personality.

[![Play in browser](https://img.shields.io/badge/play-browser-00d4ff?style=for-the-badge)](https://github.com/CosmicSlothOracle/Super_Diddler_Sis#quick-start)
[![License](https://img.shields.io/badge/license-ISC-purple?style=for-the-badge)](LICENSE)
[![JavaScript](https://img.shields.io/badge/stack-HTML5%20·%20WebGL%20·%20Electron-f5a623?style=for-the-badge)](package.json)

<img src="docs/readme/brand.png" alt="Super Diddler Sis — play milch, it's milked" width="720">

</div>

<p align="center">
  <img src="docs/readme/header.gif" alt="Late-night coding vibe — Dim Sum neon through the rain" width="100%">
</p>

---

Knock opponents off the stage, chase the beat, and learn the movement tech — wall slides, aerial dashes, double jumps — on stages that swing from birch forests to rainy neon *Dim Sum* alleys.

<table>
<tr>
<td width="50%">

**Fight** — platform-fighter damage %, stocks, and character-specific kits.

**Move** — double jump, wall slide/jump, aerial dash (tutorial in-game).

**Feel the beat** — rhythm-synced attacks and dance-zone mechanics.

</td>
<td width="50%">

**Explore** — forests, pools, beaches, dojo banners, cyberpunk interiors.

**Roster** — eclectic cast (more fighters on the way).

**Ship anywhere** — browser via Netlify, or native with Electron.

</td>
</tr>
</table>

## Screenshots

<p align="center">
  <img src="docs/readme/overview.png" alt="Gameplay collage — forest stage, stage select, Dim Sum fight, movement tutorial" width="100%">
</p>

<p align="center">
  <img src="docs/readme/forest-fight.png" alt="Forest stage combat" width="49%">
  <img src="docs/readme/dim-sum-fight.png" alt="Dim Sum neon stage at night" width="49%">
</p>

<p align="center">
  <img src="docs/readme/stage-select.png" alt="Stage select screen" width="49%">
  <img src="docs/readme/roster.png" alt="Character select roster" width="49%">
</p>

## Quick start

```bash
git clone https://github.com/CosmicSlothOracle/Super_Diddler_Sis.git
cd Super_Diddler_Sis
npm install
npm run dev          # Electron + dev tools
# npm run dev:web    # Netlify dev server (browser)
# npm run build:web  # production web build → dist/
```

No build? From the repo root: `npx serve .` or `python -m http.server 8000`, then open `index.html` (add `?dev` for debug overlays).

## Docs

| Topic | Link |
| --- | --- |
| Architecture | [ARCHITECTURE_GUIDELINES.md](ARCHITECTURE_GUIDELINES.md) |
| Deploy (Netlify) | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) |
| Web deployment notes | [WEB_DEPLOYMENT_ANALYSIS.md](WEB_DEPLOYMENT_ANALYSIS.md) |

## Stack

HTML5 · Canvas2D · WebGL · Web Audio API · Webpack · Electron

---

<p align="center">
  <sub>Built with love, pixels, and questionable amounts of milk.</sub><br>
  <a href="https://github.com/CosmicSlothOracle/Super_Diddler_Sis/issues">Issues</a> ·
  <a href="https://github.com/CosmicSlothOracle/Super_Diddler_Sis">Repository</a>
</p>
