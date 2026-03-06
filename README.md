# GRID.IO — Territory Game

A browser-based multiplayer-style territory game inspired by Paper.io.

## How to Run

**Option 1 — Python (recommended):**
```bash
cd paperio-game
python3 -m http.server 8080
# Open http://localhost:8080 in your browser
```

**Option 2 — Node.js:**
```bash
cd paperio-game
npx serve .
# Open the URL shown in terminal
```

**Option 3 — VS Code:**
Install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

> ⚠️ Do NOT open `index.html` directly as a `file://` URL — Google Fonts won't load (minor visual issue only, game still works).

---

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move Up |
| `S` / `↓` | Move Down |
| `A` / `←` | Move Left |
| `D` / `→` | Move Right |
| `Enter` / `Space` | Start / Restart |

---

## File Structure

```
paperio-game/
├── index.html       — Entry point, HTML structure, UI overlays
├── style.css        — All visual styles, HUD, screens
├── main.js          — Bootstrap: wires screens + starts game
└── js/
    ├── utils.js     — Math helpers, flood-fill, color palette
    ├── input.js     — Keyboard input handler
    ├── grid.js      — Grid data structure (territory/trail state)
    ├── camera.js    — Smooth camera follow + visible-cell culling
    ├── player.js    — Player class: movement, trail, capture logic
    ├── bot.js       — Bot AI: expand/return/roam/hunt states + BFS
    ├── renderer.js  — Canvas rendering, particles, minimap
    └── game.js      — Central game loop, collision, HUD updates
```

---

## Gameplay

- **Your player** is the **blue** circle with a white ring.
- Leave your territory to draw a trail. Return to close a loop and **capture everything inside**.
- **Die if:** you hit a wall, your own trail, or an enemy trail.
- **Eliminate bots** by cutting across their active trails.
- The minimap (top-right) shows the full arena.

---

## Architecture Notes

- **Grid**: 160×160 cells, `Uint8Array` for owner/state — O(1) lookups.
- **Rendering**: Only visible cells are drawn each frame (camera frustum culling).
- **Capture**: Flood-fill from arena borders; unreached cells = interior = claimed.
- **Bot AI**: Simple FSM with 4 states (ROAM → EXPAND → RETURN → HUNT) + BFS pathfinding back to territory.
- **Particles**: Lightweight point-based burst system for capture feedback.
