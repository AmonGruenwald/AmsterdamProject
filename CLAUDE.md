# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A small collection of browser games about Amsterdam. The flagship is the
**Amsterdam Simulator** (`simulator.html`) — a 3D game/simulation built with
Three.js. You cycle through a procedurally generated Amsterdam canal district:
collect stroopwafels, ring your bell at tourists, ride the bus (if the QR
scanner cooperates — it's 50/50 by design), visit De Wallen, dodge trams and
NPC cyclists, and try not to ride into a canal (you will ride into a canal).
`index.html` hosts a separate, self-contained 2D game so the repo root works
as a GitHub Pages landing page.

## Workflow conventions

- **Push straight to `main`.** No feature branches, no PRs, unless explicitly
  requested otherwise.
- **This repo is a game of telephone.** Different people (and agents) take
  turns building on it. Pull `main`, understand what's there, and build on it —
  but when reporting your work, describe only your **own** changes. Never
  recount, summarize, or editorialize what previous contributors did.
- No build step, no bundler, no package.json. Keep it that way unless there is a
  strong reason not to — the project is plain ES modules loaded via an import map.
- Three.js is **vendored** at `vendor/three.module.js` (r160) so the game runs
  fully offline with no CDN dependency. The import map in `index.html` maps
  `three` to it. Don't reintroduce CDN imports.

## Running it

Serve the repo root over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8741
# then open http://localhost:8741/simulator.html
```

Optional URL param: `?seed=123` — deterministic city generation (mulberry32 RNG).

## Verifying changes

There is no test suite; verify by rendering headlessly. In the remote dev
environment, Chromium + Playwright are pre-installed:

```bash
python3 -m http.server 8741 &
# drive the page with playwright-core, click #start-btn, hold KeyW, screenshot
```

A change is not verified until a screenshot shows the scene rendering and the
page reports no console errors. The HUD clock (`#s-time`) advancing is a quick
proxy for "the game loop is running".

## Architecture

| File | Responsibility |
|---|---|
| `simulator.html` | Simulator HUD, splash screen, import map. All simulator CSS lives here. |
| `index.html` | Landing page / separate self-contained 2D game. Don't couple the simulator to it. |
| `src/main.js` | Bootstrap, game loop, HUD wiring, seeded RNG. Owns all cross-module wiring. |
| `src/city.js` | Procedural city gen + spatial queries (`isOverWater`, `collide`, `WORLD` constants). De Wallen zone (`REDLIGHT`, `inRedLight`) and its neon/facade dressing. |
| `src/player.js` | Player bike model, arcade physics, canal-dunk handling, chase camera. |
| `src/npcs.js` | NPC cyclists, tourists (bell-scatter logic), canal boats, the tram. |
| `src/transit.js` | Buses, bus stops, and the QR ticket scanner (50% success rate — this is intentional satire, do not "fix" it). Boarding/riding/alighting state machine. |
| `src/weather.js` | Markov-chain weather + rain particles; `DayCycle` for sun/sky/clock. |
| `src/pickups.js` | Stroopwafel spawning/collection. |

Key invariants:

- **World layout is data, not geometry**: `WORLD` in `city.js` (canal centerlines,
  bridge X positions, widths) is the single source of truth. Gameplay queries
  (`isOverWater`, etc.) derive from it, and the meshes are built from it. If you
  move a canal, everything follows.
- **Collision is 2D AABB** on the ground plane (`colliders` array from
  `buildCity`). No physics engine; keep it that way.
- Agents/systems expose `update(dt, ...)` and are ticked from `main.js`. HUD
  side effects flow through callbacks (`player.onSplash`, `weather.onChange`)
  rather than modules touching the DOM.
- The RNG is seeded (mulberry32); use the passed-in `rng`, never `Math.random`,
  so a given `?seed=` always produces the same city.
- `window.__ams` exposes `{ player, day, transit, weather }` as a debug hook for
  headless verification (teleporting the player, fast-forwarding buses, setting
  the time of day). Keep it working; tests depend on it.
- Headless Chromium runs the sim at ~4x slow motion (low FPS + the 0.05s dt
  cap), so timed gameplay (bus dwell, QR scan) takes ~4x longer in wall-clock
  time than the constants suggest. Poll from Playwright (`waitForTimeout`), not
  with `setTimeout` inside `page.evaluate`.

## Tone

Flavour text (toasts, splash copy) is affectionately deadpan about Amsterdam:
bikes in canals, tourists in bike lanes, weather-based suffering. Keep new copy
in that register.
