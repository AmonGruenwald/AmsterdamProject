# CLAUDE.md

Guidance for Claude Code when working in this repository.

## 📣 Note to the next contributor (yes, you — read this first)

**The two games are now ONE fully integrated project.** At the repo owner's
request, the 2D snake game was rewritten INTO the simulator as a native module:

- `index.html` is the **3D Amsterdam Simulator** — the single entry point.
- The 2D game's entire logic now lives in **`src/deslang.js`** (an ES module,
  the `DeSlang` class); its markup and CSS live in `index.html` under
  `#deslang` (all ids/classes prefixed `ds-`). `snake.html` is **gone** — the
  port preserved every mechanic: combo multiplier, golden wafels, the in-game
  koffieshop shop and all four power-ups, particles, screen shake, procedural
  audio, touch/swipe/D-pad input, pause/mute, the `?dev` hook
  (`window.snakeDev`), the flavour lines, **and the Tulip Mania secret**
  (Konami code or 7 rapid taps on the 🧇 counter — the code listener is global,
  it works even while cycling the 3D street, and unlocking it now also blooms
  tulips along every quay of the 3D city via `plantTulips`).
- **The economy is shared**: `DeSlang` has no wallet of its own — it borrows
  the street stroopwafels through `getWallet`/`setWallet` callbacks wired in
  `main.js`. Points earned inside are stroopwafels outside, and shop purchases
  spend them for real. `amsterdam-snake-best` / `amsterdam-snake-muted`
  localStorage keys are unchanged.
- If you are the contributor who has been developing the 2D game: **your game
  is all still here — develop it in `src/deslang.js` now.** Same rules, same
  rendering code (adapted to class fields), same feel. In-game reach it via
  the Koffieshop De Slang storefront (`G`), or headlessly via
  `__ams.deslang.open()`.
- **From now on, always `git pull origin main` and build on the merged state
  before pushing** — everything is one entangled codebase now. If you get a
  conflict, merge it; don't force-push over it.

## What this is

**One game, two Amsterdams.** The outer layer is the **Amsterdam Simulator**
(`index.html`) — a 3D game/simulation built with Three.js. You cycle through a
procedurally generated Amsterdam canal district: collect stroopwafels, ring
your bell at tourists, ride the bus (if the QR scanner cooperates — it's 50/50
by design), eat and survive, give boat tours, visit De Wallen, and try not to
ride into a canal (you will ride into a canal). The inner layer is **Amsterdam
Snake** (`src/deslang.js`) — the 2D arcade game, now a native module, reached
in-world through Koffieshop De Slang (`G` at the door). One shared stroopwafel
economy. One secret (see the note above; don't spoil it in user-facing copy —
the README only hints at 1637).

## Workflow conventions

- **Push straight to `main`.** No feature branches, no PRs, unless explicitly
  requested otherwise.
- **This repo is a game of telephone.** Different people (and agents) take
  turns building on it. Pull `main`, understand what's there, and build on it —
  but when reporting your work, describe only your **own** changes. Never
  recount, summarize, or editorialize what previous contributors did.
- **Pull/merge before every push.** The 3D and 2D layers are one project now;
  never push from a stale base, never force-push.
- No build step, no bundler, no package.json. Keep it that way unless there is a
  strong reason not to — the project is plain ES modules loaded via an import map.
- Three.js is **vendored** at `vendor/three.module.js` (r160) so the game runs
  fully offline with no CDN dependency. The import map in `index.html` maps
  `three` to it. Don't reintroduce CDN imports.

## Running it

Serve the repo root over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8741
# then open http://localhost:8741/ (simulator) or /snake.html (2D game alone)
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
| `index.html` | Simulator HUD, splash, import map, plus the `#deslang` back-room markup and CSS (all `ds-` prefixed). |
| `simulator.html` | Redirect stub for old links. Leave it. |
| `src/deslang.js` | The entire 2D snake game as a native module (`DeSlang` class): grid logic, shop, particles, procedural audio, secret. Wallet comes from `main.js` callbacks. |
| `src/koffieshop.js` | The De Slang storefront in the 3D city (`near()` gates the `G` interaction) and `plantTulips` for when the secret escapes. |

Also: `city.js` marks ~85% of inner-city houses (`KOFFIE_ZONE`) as koffieshops
(green neon + glowing window, fronts returned as `koffieshopFronts`). All of
them open the same De Slang back room via `G` — this is a deliberate joke
(`enteredVia` in main.js picks the exit toast). Don't give them separate
interiors.
| `src/main.js` | Bootstrap, game loop, HUD wiring, seeded RNG. Owns all cross-module wiring. |
| `src/city.js` | Procedural city gen + spatial queries (`isOverWater`, `collide`, `WORLD` constants). De Wallen zone (`REDLIGHT`, `inRedLight`) and its neon/facade dressing. |
| `src/player.js` | Player bike model, arcade physics, canal-dunk handling, chase camera. |
| `src/npcs.js` | NPC cyclists, tourists (bell-scatter logic), canal boats, the tram. |
| `src/transit.js` | Buses, bus stops, and the QR ticket scanner (50% success rate — this is intentional satire, do not "fix" it). Boarding/riding/alighting state machine. |
| `src/cuisine.js` | Snack carts, krul urinoirs, and the `Survival` meters (hunger → hongerklop slowdown via `player.speedFactor`; bowels → the inevitable). |
| `src/wallen.js` | De Wallen inhabitants: window dancers (with twirls), heart-particle kisses, charm streaks, water shimmer, `WallenMuziek` — the district's procedural Web Audio groove (init needs a user gesture; main.js calls it from the start button) — and the `Q` dance-off minigame (beat clock locked to `DANCE_BEAT` = the muziek tempo; DOM strip is `#dans` in index.html; rewards wired via `onDanceEnd`). |
| `src/boating.js` | Sloop rental docks, player boat driving (canal-clamped, ducks under bridges), narrated tours with a stroopwafel payout. Sets `player.external` while driving — see below. |
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
- `player.external = true` hands ownership of `player.pos`/`heading` to another
  system (the boat) and skips bike physics AND the canal-splash check — without
  it, driving a boat would count as drowning. The bus doesn't need it (its route
  crosses canals on bridges), but any new vehicle over water does.
- `window.__ams` exposes `{ player, day, transit, weather, survival, wallen,
  stalls, toilets, boating, koffieshop, deslang, stats }` as a debug hook for
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

De Wallen content stays at silhouette-and-wink level: suggestion, neon, and
deadpan humour — never explicit. Bodily-function humour (the bowel meter) stays
deadpan and implied, never graphic. If in doubt, funnier and subtler wins.
