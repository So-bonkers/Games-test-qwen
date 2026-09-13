# Subway Surfers Clone (v3)

A three-lane endless runner built with **Three.js 0.170**, **Vite 6.4**, and **TypeScript 5.6**. The simulation runs on a fixed 1/120 s timestep, decoupled from the render loop, with all randomness driven by a seeded `mulberry32` generator (`Math.random()` is banned repo-wide).

The project is executed milestone-by-milestone against the frozen spine in [`plan.md`](plan.md). Every milestone ships with a permanent Playwright spec; the full suite is the pass/fail gate. Screenshots are never gates — tests drive the game deterministically through the `window.__GAME__` debug hook (`seed` / `setPaused` / `step` / `enqueue`) and assert on plain-JSON snapshots, so no test uses a wall-clock wait.

## Setup

Prerequisites: **Node v24** (pinned toolchain — exact versions in `package.json`, do not substitute) and npm.

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

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

## What's next

Per `plan.md`: **M9** UI + audio + HUD, **M10** environment art & lighting, **M11** post-FX. M9 is blocked on the open items in [`HUMAN-QUEUE.md`](HUMAN-QUEUE.md) (audio asset selection and the licensing/credits decision).

## Project layout

```
src/contracts/   frozen interfaces every milestone codes against — do not edit
src/core/        Sim, Loop, Renderer, SceneRoot, PlayerController, CharacterRig, DebugHook, GameConfig
src/fixtures/    static fixture track (M4) and M5 collision fixture sets
src/spawner/     procedural spawner + object pools
src/input/       input queue + keyboard mapping
src/util/        seeded RNG (the only place Math.random is legal)
test/            Playwright specs (one per milestone, all permanent) + WebGL probes
microplan/       per-milestone atomic task lists generated from plan.md
model/           raw Mixamo FBX downloads (untracked)
public/models/   processed character + clips served to the app (gitignored)
```
