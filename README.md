# 3D City Drive — Vite / StackBlitz

This project is the uploaded single-file game migrated to a Vite project.

## Structure

- `index.html` — HTML shell and game UI markup
- `src/style.css` — original game styles
- `src/main.js` — original game logic
- `package.json` — Three.js is now installed through npm instead of being embedded in HTML

## Important

The uploaded `index.html` referenced an external `ichigo-character.js`, but that file was not among the provided uploads. The core game is therefore migrated without that optional extension. Add the original file later under `src/character/` and import/initialize it after `window.CARGAME_API` is created.

## Run

```bash
npm install
npm run dev
```

StackBlitz will install the dependencies automatically.
