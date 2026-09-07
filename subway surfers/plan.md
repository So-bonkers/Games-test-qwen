# Subway Surfers Clone: Phasewise Development Plan

## Overview
This plan outlines the development of a 3D endless runner clone using **Three.js**, **Vite**, and vanilla TypeScript, based on successful open-source references like the "Cave Runner" series and `web-runner-game`. Key improvements over v1 include: architecture-first approach, mobile-first design, performance budgeting, difficulty progression, asset pipeline, and re-ordered phases for incremental delivery.

---

### Phase 0: Architecture & Project Scaffold
**Goal:** Define project structure, coding conventions, and scaffold the build pipeline before writing game code.
* **Tasks:**
  1. Initialize Vite + TypeScript project (`npm create vite@latest --template vanilla-ts`).
  2. Install dependencies: `three`, `@types/three`.
  3. Define folder structure:
     ```
     src/
       core/          — GameLoop, SceneController, AssetManager
       input/         — Keyboard + Touch/Swipe handlers
       entities/      — Player, Obstacle, Coin, PowerUp base classes
       systems/       — CollisionSystem, Spawner, ScoreSystem, AudioSystem
       ui/            — HUD, Menus, overlays (HTML/CSS)
       assets/        — Models (.glb), textures, audio files
       types/         — Shared TypeScript interfaces & enums
     ```
  4. Set up a central `GameConfig` module (constants for lane width, gravity, speeds, colors).
  5. Create shared type definitions:
     - `Lane = 0 | 1 | 2`, `GameState = 'menu' | 'playing' | 'paused' | 'gameover'`, `EntityType`, `PowerUpType`.
  6. Install dev dependencies: `vite-plugin-glsl` (for shader support if needed), `three/examples/jsm/controls/OrbitControls` (debug camera).
* **Success Criteria:** Project builds, runs, and renders a blank Three.js scene at 60 FPS on desktop and mobile browsers.

---

### Phase 1: Core Engine & Render Loop
**Goal:** Establish the Three.js scene, camera, lighting, and game loop.
* **Tasks:**
  1. Set up `PerspectiveCamera` with a fixed forward-facing angle (Subway Surfers style — behind-and-above character).
  2. Implement responsive canvas: handle `resize` events, adjust camera aspect ratio and renderer size.
  3. Add directional light + ambient light for basic scene illumination.
  4. Create a ground plane that visually scrolls toward the player (or keep ground static and move world toward player).
  5. Implement the **GameLoop** using `requestAnimationFrame` with delta-time accumulation for frame-rate-independent movement.
  6. Add a simple debug overlay showing FPS, score, and speed (uses DOM, not canvas).
* **Success Criteria:** A visible ground plane scrolls continuously; camera follows player; FPS counter works.

---

### Phase 2: Character & Animation System
**Goal:** Create a playable character with smooth animations for all movement states.
* **Assets:** Download rigged characters from Mixamo (Run, Jump, Slide/Roll, Crash/Fall animations). Export as `.glb`.
* **Tasks:**
  1. Implement an `AssetManager` that loads `.glb` models asynchronously and caches them.
  2. Create a `Player` class extending `THREE.Group` containing the loaded character mesh.
  3. Set up `AnimationMixer` + `AnimationAction` for each state (Run, Jump, Slide, Crash).
  4. Build a simple animation state machine: only one action plays at a time; transitions use crossfade duration (~0.15s).
  5. Position the player at a fixed Z position (e.g., Z = 0) — the world moves toward them, not vice versa (this simplifies collision math and floating-point precision).
* **Success Criteria:** Character appears in scene, runs in place with loop animation, can transition to jump/slide states on keypress.

---

### Phase 3: Movement Mechanics & Controls
**Goal:** Implement lane switching, jumping, sliding, and touch input for mobile.
* **Tasks:**
  1. **Input System (`input/`):**
     - Keyboard: Arrow keys / WASD for desktop.
     - Touch: Swipe detection (threshold-based gesture recognizer) + tap for jump.
     - Normalize all input into a single `InputState` object consumed by the game loop.
  2. **Lane Switching:** Three lanes at fixed X positions (e.g., -3, 0, +3). Smooth interpolation using `lerp` with configurable speed (~8 units/sec). Prevent out-of-bounds movement.
  3. **Jumping:** Gravity-based vertical physics (`velocity.y -= gravity * dt`). On ground → allow jump; in air → block jump (unless Super Sneakers active).
  4. **Sliding:** Shrink player height (Y scale to ~0.5) for a fixed duration (~0.6s) or until animation ends. Prevent jumping while sliding.
  5. **Physics constraints:** Ground check via raycast downward; clamp velocity; prevent tunneling at high speeds.
* **Success Criteria:** Player responds instantly to input, switches lanes smoothly, jumps and slides correctly, works on both desktop keyboard and mobile touch.

---

### Phase 4: Procedural Environment & Obstacle Spawning
**Goal:** Create an infinite, randomized track with varied obstacles and coins.
* **Tasks:**
  1. **Object Pooling:** Pre-allocate pools for obstacles and coins (e.g., pool of 20 obstacle meshes) to avoid GC spikes from create/destroy.
  2. **Chunk System:** Spawn ground segments in chunks of ~50 units ahead of the player; recycle segments behind the player back into the spawn queue.
  3. **Obstacle Types** (each defined in a data config):
     - **Low barrier** (red) — requires jump. Hitbox: low, spans one lane.
     - **High barrier** (blue) — requires slide. Hitbox: high, spans one lane.
     - **Full block / train** (gray) — requires lane switch. Hitbox: full height, spans one lane, ~10 units long.
     - **Mixed patterns:** e.g., low barrier in lane 0 + train in lane 2 → forces jump AND lane change.
  4. **Coin Placement:** Scatter coins in arcs, lines, or risky patterns (e.g., coins behind a full block requiring lane switch). Use coin pool.
  5. **Spawn Manager:** Determines next spawn position based on `gameSpeed` and `spawnDistance`. Ensures no impossible combinations (at least one lane is always passable).
* **Success Criteria:** Obstacles and coins spawn procedurally, recycle correctly, and never create an unbeatable configuration.

---

### Phase 5: Collision Detection & Gameplay Loop
**Goal:** Handle collisions, scoring, game over, and high score persistence.
* **Tasks:**
  1. **Collision System:** Axis-aligned bounding box (AABB) checks between player hitbox and all active obstacles/coins. Use `THREE.Box3` for each frame. Optimize by only checking objects within a ~15-unit radius.
  2. **Coin Collection:** On coin collision → remove coin from scene, return to pool, increment coin counter, play chime sound.
  3. **Obstacle Collision:**
     - If Hoverboard active → destroy hoverboard, knock player back slightly, no game over.
     - Otherwise → trigger crash animation, transition to `gameover` state.
  4. **Scoring:** Score = distance meters traveled + (coins × 10). Display live score in HUD.
  5. **Game Speed Progression:** Start at base speed (e.g., 10 units/sec), increase by 0.5 every 30 seconds, capped at 25. Obstacle density also scales with speed.
  6. **Game Over Screen:** Show final score, high score, and "Play Again" button. Transition back to menu on restart.
  7. **Persistence:** Save `{ highScore, totalCoins }` to `localStorage`. Load on startup.
* **Success Criteria:** Coins collect with visual/audio feedback; obstacles trigger game over correctly; speed increases over time; high score persists across reloads.

---

### Phase 6: Power-Ups & Collectibles
**Goal:** Add signature Subway Surfers power-ups with timed effects and visual indicators.
* **Tasks:**
  1. **Power-Up Data Schema:** Each power-up has `type`, `duration` (seconds), `icon`, and an `activate()` / `deactivate()` handler.
  2. **Coin Magnet:** When active, coins within a ~8-unit radius accelerate toward the player. Visual: subtle magnetic field ring around player.
  3. **Super Sneakers:** Double jump height (multiply jump velocity by 1.8). Visual: green glow on character feet.
  4. **Jetpack:** Lift player upward for ~4 seconds, ignore gravity, collect all overhead coins. Visual: rocket trail particles.
  5. **Hoverboard:** "Life saver." Active until hit by an obstacle. Visual: board mesh under player's feet with glow effect.
  6. **Multiplier (2x / 3x):** Doubles or triples score for a duration. Visual: floating number above player.
  7. **HUD Timer Bar:** Each active power-up shows a shrinking timer bar in the HUD top bar.
* **Success Criteria:** All five power-ups function correctly with proper activation, visual feedback, and expiration.

---

### Phase 7: UI Menus & Polish
**Goal:** Deliver a complete user experience with menus, audio, and visual polish.
* **Tasks:**
  1. **HUD Overlay (HTML/CSS overlay on top of canvas):**
     - Top bar: live score (left), coin count (right).
     - Active power-up timer bars (center-top).
  2. **Main Menu Screen:**
     - Title banner with animated character preview.
     - "Play" button, "Character Select" button, "Settings" button.
     - High score display at bottom.
  3. **Character Select Screen:**
     - Grid of unlocked characters (initially 1 locked, rest unlockable via coin count).
     - Click to select → preview animation → confirm.
  4. **Game Over Screen:** Final score, coins collected this run, high score, "Play Again" + "Menu" buttons.
  5. **Audio System:**
     - Web Audio API or Three.js `Sound` for background music loop, jump/land/chime/crash sounds.
     - Volume controls in Settings (Music, SFX).
     - Mute toggle.
  6. **Settings Screen:** Volume sliders, mute toggle, fullscreen button.
  7. **Visual Polish:**
     - Particle system for coin collection (small sparkle burst).
     - Screen shake on crash (camera offset + return).
     - Fog or gradient background to hide world edge.
     - Skybox or gradient sky dome.
* **Success Criteria:** Full menu flow (Menu → Play → Game Over → Menu) works; audio plays correctly; UI is responsive on mobile and desktop.

---

### Phase 8: Performance Optimization & Testing
**Goal:** Ensure smooth 60 FPS performance and polish edge cases.
* **Tasks:**
  1. **Frustum Culling:** Rely on Three.js built-in frustum culling (enabled by default); verify with renderer stats.
  2. **Geometry Reuse:** Share geometries across all instances of the same obstacle/coin type. Only materials differ.
  3. **Texture Optimization:** Compress textures; use reasonable resolution (512×512 max for most assets).
  4. **Draw Call Batching:** Merge static geometry where possible; keep material count low.
  5. **Profiling:** Use Three.js `Stats` addon in debug mode to monitor FPS, draw calls, and triangles.
  6. **Edge Case Testing:**
     - Rapid lane switching (no input debounce issues).
     - Jump while sliding, slide while jumping.
     - Power-up expiration mid-animation.
     - Fast scroll on mobile (prevent overscroll / page bounce).
  7. **Responsive Layout Testing:** Test on multiple screen sizes (phone portrait/landscape, tablet, desktop).
* **Success Criteria:** Stable 60 FPS on mid-range devices; no memory leaks over 10-minute runs; no input glitches.

---

## Key Resources to Reference
1. **Cave Runner Tutorial (Hashnode):** [Link](https://kingdavvid.hashnode.dev/building-an-endless-runner-game-with-threejs-mixamo-vite-and-planetscale-part-one) — Three.js/Vite setup and Mixamo integration.
2. **Web Runner Game (GitHub):** `gnurtuv/web-runner-game` — Lane logic, obstacle patterns, power-up implementations.
3. **Mixamo:** Free rigged characters and animations (.glb export).
4. **Three.js Docs:** [threejs.org](https://threejs.org/docs) — AnimationMixer, Box3, ObjectPool patterns.

## Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | Vite + TypeScript | Fast HMR, type safety for Three.js |
| Rendering | Three.js r160+ | Industry standard for WebGL |
| Input | Custom keyboard + swipe recognizer | No heavy framework needed |
| State | Custom ECS-lite (entities + systems) | Lightweight, transparent |
| Audio | Web Audio API / Three.js Sound | Built-in, no extra deps |
| Persistence | `localStorage` | Simple, no server needed |
| Hosting | GitHub Pages or Netlify | Free, easy CI/CD |

## Assumptions & Decisions
- **World moves toward player** (player stays at fixed Z) — simplifies collision math and avoids floating-point drift.
- **No physics engine** — custom AABB collision + gravity is sufficient for this game's simplicity and keeps bundle small.
- **Mobile-first** — touch controls are primary; keyboard is secondary. UI scales to viewport.
- **All assets bundled** — no external asset CDN; everything ships with the app for offline play.
- **Single-player only** — no multiplayer or leaderboards (can be added later).

## Success Criteria Summary
1. Playable endless runner with 3-lane movement, jump, slide mechanics.
2. Procedural infinite track with varied obstacles and coins.
3. Score system with distance + coins, high score persistence.
4. Five power-ups with timed effects and visual feedback.
5. Full UI flow: Main Menu → Character Select → Gameplay → Game Over → Menu.
6. 60 FPS on mid-range devices; responsive on mobile and desktop.
7. Audio (music + SFX) with volume controls.
