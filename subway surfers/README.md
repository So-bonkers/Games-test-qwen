# Subway Surfers Clone (v3)

A three-lane endless runner built with **Three.js 0.170**, **Vite 6.4**, and **TypeScript 5.6**. The simulation runs on a fixed 1/120 s timestep, decoupled from the render loop, with all randomness driven by a seeded `mulberry32` generator (`Math.random()` is banned repo-wide).

The project is executed milestone-by-milestone against the frozen spine in [`plan.md`](plan.md). Every milestone ships with a permanent Playwright spec; the full suite is the pass/fail gate. Screenshots are never gates — tests drive the game deterministically through the `window.__GAME__` debug hook (`seed` / `setPaused` / `step` / `enqueue`) and assert on plain-JSON snapshots, so no test uses a wall-clock wait.

## Setup

Prerequisites: **Node v24** (pinned toolchain — exact versions in `package.json`, do not substitute) and npm.

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

The game loads on a menu screen over the live 3D scene; click **Play** to start a run. On the game-over screen, **Restart** reloads back to the menu.

Controls: **A/D or ←/→** switch lanes, **W / ↑ / Space** jump, **S / ↓** slide (slide in the air fast-falls).

### Character model (required for M8+)

The Mixamo character and its seven animation clips are binary FBX files that a human downloads — they are intentionally **not committed** (`/public/models/` is gitignored). The game expects them at:

```
public/models/character.fbx
public/models/anim-run.fbx        anim-jump.fbx     anim-slide.fbx
public/models/anim-land.fbx       anim-crash-legs.fbx
anim-crash-trip.fbx               anim-crash-fall.fbx
```

Without them the game still runs — it falls back to the capsule placeholder and logs `CharacterRig load failed` in the console. Raw Mixamo downloads live untracked in `model/`.

## Testing

```bash
npm run gate       # typecheck (both tsconfig projects) + build + full Playwright suite
npm test           # just the Playwright suite
```

- The suite runs **one worker at a time** against a production build: Playwright's `webServer` hook runs `vite build --mode staging && vite preview` on port 4173 automatically. Staging mode keeps the dev-only debug hook exposed while exercising the real build pipeline.
- Headless Chromium needs specific WebGL flags or it gets a null context (Chrome 119+ behavior, discovered in M0). They live in [`test/gl-profile.json`](test/gl-profile.json) — `--use-gl=angle --use-angle=gl --enable-unsafe-swiftshader` — and are read by `playwright.config.ts`. Edit that file to switch headless/headed; do not hardcode flags.
- Render liveness is asserted numerically: the debug hook samples a 64×64 downsample via `gl.readPixels` and checks luma spread across frames, so a dead or frozen renderer fails the gate without anyone looking at a screenshot.

## Progress timeline

The initial commit (`1fc1d10`, 2026-09-07) was an earlier attempt that died on an unexplained black screen; v3 is a clean rewrite that instruments the render pipeline first, then builds the game on top of it. All v3 work landed 2026-09-13 and is pushed to `origin/main`.

| Milestone | Commit | What shipped | Tests (cumulative) |
|---|---|---|---|
| **M0** Environment gate | [`29bcadc`](https://github.com/So-bonkers/Games-test-qwen/commit/29bcadc) | Probe ladder proving the GPU/driver/headless-WebGL path works before any game code; wrote `test/gl-profile.json` | — |
| **M1** Contracts + harness | [`29bcadc`](https://github.com/So-bonkers/Games-test-qwen/commit/29bcadc) | Frozen contracts in `src/contracts/`, `window.__GAME__` debug hook, app skeleton, render-liveness tiers | smoke |
| **M2** Core loop | [`efb7139`](https://github.com/So-bonkers/Games-test-qwen/commit/efb7139) | Split modules (`Renderer`, `SceneRoot`, `Loop`, `Input`), fixed 1/120 s timestep, deterministic step drivers | +loop |
| **M3** Player kinematics | [`2dc710b`](https://github.com/So-bonkers/Games-test-qwen/commit/2dc710b) | Lane lerp, jump, slide, fast-fall — scripted input ⇒ exact positions at named frames | 16 |
| **M4** Elevation state machine | [`0531637`](https://github.com/So-bonkers/Games-test-qwen/commit/0531637) | GROUND / AIRBORNE / ON_PLATFORM / ON_TRAIN_ROOF against a hand-authored fixture track; transition events asserted exactly | 18 |
| **M5** Collision, death, score | [`9d5d1ce`](https://github.com/So-bonkers/Games-test-qwen/commit/9d5d1ce) | Box3 collision at all elevations, gameover + high-score persistence, landing on landable surfaces is safe | 24 |
| **M6a** Track streaming & spawner | [`38e6128`](https://github.com/So-bonkers/Games-test-qwen/commit/38e6128) | Procedural spawner with object pools (32 obstacles / 150 coins), `relativeSpeed` closing trains | 26 |
| **M6b** Spawn fairness | [`8208df5`](https://github.com/So-bonkers/Games-test-qwen/commit/8208df5) | Lead distance scales with closing speed; 5 seeds × 3000 ticks with a scripted optimal bot ⇒ 0 deaths | 32 |
| **M7** Coins & power-ups | [`bc926f4`](https://github.com/So-bonkers/Games-test-qwen/commit/bc926f4) | Magnet, sneakers, jetpack, hoverboard — each asserted via snapshot deltas; hoverboard converts one fatal hit into survival | 37 |
| **M8** Mixamo character rig | [`2bca6d1`](https://github.com/So-bonkers/Games-test-qwen/commit/2bca6d1) | FBX + 7 clips loaded via `FBXLoader`, `animState` state machine (RUN/JUMP/SLIDE/LAND + crash mapping), capsule hidden on attach | 43 |
| **M9** UI + HUD | [`7c38e27`](https://github.com/So-bonkers/Games-test-qwen/commit/7c38e27) | Menu screen, live HUD (score, coins, power-up timers), game-over + restart flow; rendering decoupled from pause so the scene stays live behind the menu. Audio deliberately deferred to M9b pending asset selection | 47 |

## What's next

Per `plan.md`: **M9b** audio (wires in `public/audio/*` once files land — Human Queue item 2), **M10** environment art & lighting, **M11** post-FX. No credits screen was added in M9: Mixamo is royalty-free with no attribution requirement and no CC-BY assets are in use yet (Human Queue item 3, decided skip-for-now).

## Project layout

```
src/contracts/   frozen interfaces every milestone codes against — do not edit
src/core/        Sim, Loop, Renderer, SceneRoot, PlayerController, CharacterRig, DebugHook, GameConfig
src/fixtures/    static fixture track (M4) and M5 collision fixture sets
src/spawner/     procedural spawner + object pools
src/input/       input queue + keyboard mapping
src/ui/          menu/HUD/game-over DOM layer (M9)
src/util/        seeded RNG (the only place Math.random is legal)
test/            Playwright specs (one per milestone, all permanent) + WebGL probes
microplan/       per-milestone atomic task lists generated from plan.md
model/           raw Mixamo FBX downloads (untracked)
public/models/   processed character + clips served to the app (gitignored)
```

## Psyche

The v3 rewrite is driven by one post-mortem: the previous attempt (~2,600 LOC) built for days and died on an unexplained black screen because **the project had no way to tell a dead renderer from a crashed script from a zero-size canvas**. The rules that follow from that:

- **Instrument before you build.** M0 is zero game code — a probe ladder proving each layer of the stack (deps install → GLX direct rendering → headed WebGL2 → headless WebGL2 → Vite serving modules with correct MIME over a path containing a space → a Three.js cube passing the luma probe) before anything else is allowed to start.
- **No verification step requires eyes.** The executing model cannot see a screen, so every gate is a command with an exit code and numeric assertions (luma p99, distinct tonal buckets, frame-to-frame deltas). Screenshots are artifacts, never gates.
- **Determinism is the test strategy.** Seeded RNG + `setPaused` + `step(n)` means any behavior can be reproduced to the tick; no test waits on wall-clock time.
- **No open questions.** Every decision is frozen in `plan.md` or the milestone's microplan; the executor never chooses, and old code contributes *values* but never architecture.
- **Risk front-loading.** The two hardest systems (elevation state machine, collision) land first against a hand-authored fixture track, before any procedural content exists to confuse a failure.

## Key decisions

| Decision | Why |
|---|---|
| Fixed 1/120 s timestep, decoupled from RAF | Deterministic simulation; rendering is just sampling it |
| Seeded `mulberry32`; `Math.random()` banned repo-wide | Grep-enforced by the gate; every run reproducible |
| String unions, never `const enum` | `const enum` is an `isolatedModules`/esbuild hazard — part of the old crash lineage |
| Playwright; Puppeteer removed entirely | One runner; the old Puppeteer harness was the tool that manufactured the black screen |
| `preserveDrawingBuffer: true` on every renderer | On this GPU/driver path, `gl.readPixels` returns stale/frozen values without it |
| Gradient sky texture, never a flat color background | A flat fill left the tonal-spread render gate unsatisfiable on this driver path |
| Contracts frozen in `src/contracts/` | Every milestone codes against the same interfaces; no drift |
| Pinned toolchain (three 0.170.0, TS 5.6.3, Vite 6.4.3, Playwright 1.63.0, Node v24) | No silent upgrade changing behavior mid-run |

## Errors encountered and how they were solved

1. **The original black screen** (commit `1fc1d10`). Days of work, no visible output. Post-mortem: the GPU was never the problem — the *diagnostic harness* was broken. It launched Chromium with `--disable-gpu`, which since Chrome 119 yields a null WebGL context unless `--enable-unsafe-swiftshader` is also passed, and it called `page.waitForTimeout`, removed in Puppeteer v22. A real app bug (a missing import) and a manual cache-buster (`?v=2`) compounded the confusion. **Fix:** M0's probe ladder plus Tier 1/2/3 numeric render verification — the luma-spread assertion would have caught the black screen on day one.
2. **Frozen luma samples** (M1). `gl.readPixels` returned stale values from a live, animating scene on this Mesa/ANGLE path. **Fix:** frozen decision that every `WebGLRenderer` passes `preserveDrawingBuffer: true`.
3. **Unsatisfiable tonal-spread gate** (M0/M1). A flat `THREE.Color` background could not produce enough tonal variety for the render-liveness check on this driver path. **Fix:** `createSkyGradientTexture()` in `src/core/SkyGradient.ts` — the scene never uses a flat fill.
4. **Pre-pause live ticks** (M8). The harness's `waitForFunction` resolves after the first rendered frame, so the game runs live for a few ticks before `setPaused`; distance-based events land at variable absolute ticks, and two regimes exist (platform-catch vs pure-ground landing). Paper tick math failed against the real harness. **Fix:** tests use regime-robust step counts, and tick math is verified with a live probe that dumps per-tick state and events against `vite preview` — not just on paper.
5. **Stale pre-generated microplans** (M6b, M7, M8). Task drafts referenced file content from earlier milestones: M7 extended the `DebugHook` interface but no task updated the object literal, so `tsc` could never pass; M8's `Sim.ts` find-text omitted M7's hoverboard branch and would have deleted working logic. **Fix:** verify every draft's anchors against the live tree before executing; apply minimal gap fixes with user approval, never weakening the new milestone's own tests.
6. **Directional-light blindness** (flagged for M10). `MeshStandardMaterial` lit by ambient + directional showed almost no directional response on this GPU/driver combo — a rotating cube's faces were visually near-identical. Not root-caused (candidates: Three.js's post-r155 physically-based light units, or a driver shading path); worked around with the gradient sky, and budgeted for real investigation in M10, whose deliverable actually depends on lighting looking right.

## Reproducing this project

1. **Clone and install.** Node v24 required (pinned toolchain — `package-lock.json` pins every version):
   ```bash
   git clone https://github.com/So-bonkers/Games-test-qwen.git
   cd "games-test/subway surfers"
   npm ci
   ```
2. **Place the character assets** (human task; gitignored). Mixamo FBX files in `public/models/`: `character.fbx` plus `anim-run`, `anim-jump`, `anim-slide`, `anim-land`, `anim-crash-legs`, `anim-crash-trip`, `anim-crash-fall`. Without them the game still runs with the capsule placeholder; only the rig-load test in `test/character.spec.ts` fails.
3. **Run the gate.** `npm run gate` — typecheck both TS projects, production build, then the full Playwright suite (47 tests) against `vite preview` on port 4173 (auto-started by the Playwright config). Expect green.
4. **Run one milestone's spec** with `npx playwright test test/<spec>.spec.ts` — e.g. `test/elevation.spec.ts`. Each spec is self-contained: it drives the game through `window.__GAME__` (`seed`, `setPaused`, `step`, `enqueue`) and asserts on plain-JSON snapshots.
5. **Drive it by hand.** In dev mode, open the console and use the same hook: `__GAME__.seed(1); __GAME__.step(120)` advances exactly one second of simulation. Static fixture tracks are selectable via `?fixture=<name>`; `?fixture=procedural` enables the spawner.
6. **Re-derive the environment on a new machine.** `test/gl-profile.json` was written for this machine (Mesa/ANGLE on an RX 7900 XTX). Elsewhere, run the M0 probes — `node test/probes/webgl-probe.mjs --headless` and `npm run probe:vite` — and write the working launch args into that file; the Playwright config reads it.

Because the simulation is seeded and step-exact, a green gate on any machine means the game behaves identically to the tick (rendering aside) — that is the reproduction guarantee.
