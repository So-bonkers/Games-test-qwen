# Subway Surfers Clone — Executor Spine (v3)

## How to read this document

This is **not** a design discussion. It is a spine: a set of frozen decisions and mechanically-verifiable milestones, written to be expanded one milestone at a time into atomic task lists (`microplan/NN-*.md`) and executed by a **non-reasoning model** (local Qwen, thinking disabled, driven by dsh).

Rules that follow from that:

- **No decision is left open here.** If this document does not specify it, the microplan for that milestone specifies it. The executor never chooses.
- **No verification step requires eyes.** The executor cannot see the screen. Every gate is a command with an exit code.
- **No file is ever partially edited from git history.** Every file is either restored byte-exact from commit `1fc1d10`, or written fresh from an exhaustive spec. Refactoring requires reading, inferring, and deciding — the three things the executor cannot do.

Human review is real but **batched** into four checkpoints (see Human Queue).

---

## Why v3 exists

v2 was prose for a reasoning implementer and had no verification phase at all — it deleted the per-phase success criteria v1 had.

The previous attempt (commit `1fc1d10`, "Phases 0-4", ~2,600 LOC, now wiped from the working tree) **died on an unexplained black screen** after building for days without ever proving the render pipeline worked. It left four abandoned diagnostic files.

Post-mortem, verified on this machine:

- **The GPU was never the problem.** AMD Radeon RX 7900 XTX, Mesa 26.0.8, `direct rendering: Yes`, GL 4.6, `/dev/dri/renderD128`, `DISPLAY=:0`.
- **The diagnostic harness was broken.** `test-harness.cjs` launched Chromium with `--disable-gpu`; since Chrome 119 that yields a **null WebGL context** unless `--enable-unsafe-swiftshader` is also passed. It also called `page.waitForTimeout`, removed in Puppeteer v22 (the project pinned 25.10.0). So the tool that was supposed to explain the black screen could not run, and when it did it manufactured one.
- **There was a real app bug too** — a missing `@/types` import in `GameConfig.ts`, which `diagnose.mjs` found and called "the bug we just fixed."
- `index.html` loaded `/src/main.ts?v=2`, a manual cache-buster: they were fighting a stale-module ghost.

The lesson is not "be careful with WebGL." It is: **the project had no way to tell a dead renderer from a crashed script from a zero-size canvas.** v3 builds that instrument first, in M0, before a single line of game code.

---

## Frozen decisions

| Area | Decision |
|---|---|
| Prior code | Clean rewrite. Cherry-pick **values**, never architecture. |
| Character | Mixamo, downloaded by a human up front. Capsule proxy until M8. |
| Assets | Executor never downloads or selects assets. All asset acquisition is a Human Queue item. |
| Post-FX | Last milestone. Wired mechanically one pass at a time, tuned by eye afterward. |
| Randomness | `mulberry32`, seeded. `Math.random()` is **banned repo-wide** and grep-enforced by the gate. |
| Timestep | Fixed 1/120 s accumulator, decoupled from RAF. |
| Enums | Plain string unions only. **`const enum` is banned** — it is an `isolatedModules`/esbuild hazard and was in the crash lineage here. |
| Test runner | Playwright. **Puppeteer is removed from the project.** |
| Renderer construction | Every `new THREE.WebGLRenderer(...)` in this project **must** pass `preserveDrawingBuffer: true`. On this machine's GPU/driver path, `gl.readPixels` returns stale/frozen values without it — found during M1 when the debug hook's luma sampling read frozen data from a live, animating scene. |
| Scene background | Never a flat `THREE.Color`. Use `createSkyGradientTexture()` (`src/core/SkyGradient.ts`, written in M1). A flat fill was found in M0/M1 to leave the tonal-spread render-verification check unsatisfiable on this GPU/driver path — see the flagged risk below. |

### Pinned toolchain

Exact versions, verified from the previous `package-lock.json`. Do not substitute or upgrade.

| Package | Version |
|---|---|
| three | 0.170.0 |
| @types/three | 0.170.0 |
| typescript | 5.6.3 |
| vite | 6.4.3 |
| @playwright/test | 1.63.0 |

Node is v24.16.0. `"type": "module"`.

### Frozen world conventions

The executor gets axis conventions backwards if they are not stated. They are:

- **Lanes are X.** `LANE_POSITIONS = [-3, 0, 3]`, indexed `0 | 1 | 2` left→right.
- **Depth is Z, and the world moves toward −Z.** Obstacles spawn at high +Z (`SPAWN_DISTANCE = 120`), decrease in Z each tick, and despawn behind the player at `z < -DESPAWN_DISTANCE`. The player stays near `z = 0`.
- **Up is +Y.** Ground is `y = 0`. `feetY` is the bottom of the player, not the origin.
- Camera sits at `(0, 5.5, -9)` looking at `(0, 1.5, 8)`.

### Salvage manifest

Restore **byte-exact** with `git show "HEAD:subway surfers/<path>"`:

- `src/systems/ObjectPool.ts` — 67 lines, generic over `THREE.Object3D`, dependency-free.

Copy **values only** into a freshly written `src/core/GameConfig.ts` (drop the `import { PowerUpType } from '@/types'` — that coupling is the crash lineage):

`LANE_POSITIONS [-3,0,3]` · `LANE_WIDTH 2.5` · `PLAYER_HEIGHT 1.8` · `PLAYER_WIDTH 0.8` · `PLAYER_DEPTH 0.6` · `PLAYER_SLIDE_SCALE 0.5` · `PLATFORM_HEIGHT 1.0` · `TRAIN_LENGTH 9` · `TRAIN_ROOF_HEIGHT 2.5` · `RAMP_LENGTH 3.0` · `FAST_TRAIN_EXTRA_SPEED 10` · `LERP_SPEED 12` · `JUMP_VELOCITY 9` · `GRAVITY -22` · `FAST_FALL_SPEED 16` · `SLIDE_DURATION 0.6` · `BASE_SPEED 14` · `MAX_SPEED 28` · `SPEED_INCREMENT 0.5` · `SPEED_INTERVAL 30` · `SPAWN_DISTANCE 120` · `DESPAWN_DISTANCE 20` · `CHUNK_SIZE 50` · `MIN_SPAWN_GAP 12` · `MAX_SPAWN_GAP 22` · `TUNNEL_MIN_GAP 70` · `TUNNEL_MAX_GAP 120` · `FOG_NEAR 60` · `FOG_FAR 140` · `COIN_VALUE 10`

Lift the **weighted solvable-pattern table** from the old `Spawner.pickPattern()` (real design work) in M6 — the table, not the 387-line class.

**Discard entirely:** `Game.ts` (590-line god object), `Player.ts` (ad-hoc elevation), `types/index.ts` (all `const enum`), `AssetManager.ts` (never loaded anything), and all four diagnostic files.

---

## Frozen contracts

Written in M1 into `src/contracts/`. Named `contracts/`, not `types/`, to signal *do not edit*. These are the interfaces every later milestone codes against; if each milestone invented its own, the executor would produce divergent versions.

```ts
// src/contracts/elevation.ts
export type Elevation = 'GROUND' | 'AIRBORNE' | 'ON_PLATFORM' | 'ON_TRAIN_ROOF';

export interface LandableSurface {
  topY: number;         // world Y of the walkable top
  zStart: number;       // near edge (smaller Z), zStart < zEnd
  zEnd: number;         // far edge
  xCenter: number;
  halfWidth: number;
  kind: 'PLATFORM' | 'TRAIN_ROOF';
  rampZEnd?: number;    // if set, [zStart, rampZEnd] slopes linearly 0 -> topY
  ownerId: number;      // ObstacleSpec.id that owns this surface
}
```

```ts
// src/contracts/obstacle.ts
export type ObstacleType =
  | 'LOW_BARRIER' | 'HIGH_BARRIER' | 'FULL_BLOCK'
  | 'PLATFORM' | 'TRAIN' | 'RAMP_TRAIN';

export interface ObstacleSpec {
  id: number;
  type: ObstacleType;
  lane: 0 | 1 | 2;
  relativeSpeed: number;   // 0 = static; > 0 closes on the player faster than world scroll
  bounds: { x: number; y: number; z: number; hx: number; hy: number; hz: number };
  landableSurfaces: LandableSurface[];
  deadlyFaces: Array<'FRONT' | 'SIDE' | 'TOP'>;
}
```

```ts
// src/contracts/debug.ts — the entire verification surface
export interface DebugHook {
  version: 1;
  state: 'menu' | 'playing' | 'gameover';
  stats: {
    frame: number; simTick: number; simTime: number;
    drawCalls: number; triangles: number;
    luma: { mean: number; p99: number; distinctBuckets: number };
  };
  player: {
    lane: 0 | 1 | 2; x: number; y: number; feetY: number;
    elevation: Elevation; velocityY: number; grounded: boolean;
  };
  world: { speed: number; distance: number; score: number; coins: number };
  pool: { obstaclesActive: number; obstaclesFree: number; chunksActive: number };
  obstacles(): Array<{
    id: number; type: ObstacleType; lane: 0 | 1 | 2; z: number;
    topY: number | null; zRange: [number, number]; relativeSpeed: number;
  }>;
  events: Array<{                      // ring buffer, capacity 256
    tick: number;
    type: 'collision' | 'land' | 'dismount' | 'coin' | 'spawnRow' | 'gameover';
    data: Record<string, number | string>;
  }>;
  seed(n: number): void;
  setPaused(paused: boolean): void;
  step(ticks: number): void;           // advances exactly n fixed steps with RAF paused
  enqueue(inputs: Array<'left' | 'right' | 'jump' | 'slide'>): void;
}
```

Exposed as `window.__GAME__` under `if (import.meta.env.DEV)` only. **Every value is plain JSON** — no class instances, no enum members, no `THREE.Vector3`.

Determinism comes from `seed()` + `setPaused(true)` + `step(n)`. Tests never use wall-clock waits. Input goes through `enqueue()`, not synthetic key events, so tests skip focus and keymap flakiness. One separate test asserts that a real `keydown` reaches `enqueue`.

---

## Verification architecture

**Screenshots are artifacts, never gates.** The executor cannot look at them. Gates are numeric.

### Tier 1 — liveness
Zero `pageerror`. Zero `console.error` outside an explicit allowlist in `test/benign-console.ts`. Canvas `width`, `height`, `clientWidth`, `clientHeight` all > 0. `getContext('webgl2')` non-null and `!isContextLost()`.

### Tier 2 — rendered pixels
The hook reads a 64×64 downsample via `gl.readPixels` — no PNG decode, no screenshot parsing. Pass requires **all three**: `p99 luma > 0.06`, `distinctBuckets >= 8`, and `mean` differing across two samples taken a second apart. A legitimately dark night scene has a neon high-luma tail and tonal spread; a dead frame has neither, and a frozen frame fails the third check.

**This is the assertion that would have caught the original black screen on day one.**

### Tier 3 — semantic
Driven through the debug hook with a fixed seed. Representative:

- `seed(7); enqueue(['jump']); step(60)` ⇒ `player.elevation === 'ON_TRAIN_ROOF'` and `|player.feetY - 2.5| < 0.01`
- `enqueue(['left']); step(30)` ⇒ `player.lane === 0` and `|player.x + 3| < 0.05`
- Spawn fairness: for every distinct z-bucket in `obstacles()`, `blockedLanes.size < 3`
- 3000 ticks ⇒ `pool.obstaclesActive + pool.obstaclesFree` constant (no leak)
- Collision ⇒ exactly one `collision` event, then `state === 'gameover'`

### Output contract

Exit **0** pass · **2** environment fault (null context, 0×0 canvas, server unreachable) · **3** game fault (pageerror, stalled loop, black frame).

One line per assertion:

```
PASS canvas-geometry
FAIL loop-advancing expected=>=20 actual=0 hint=The render loop is not calling requestAnimationFrame; check Loop.start() is invoked from main.ts
NEXT: src/core/Loop.ts
```

The `hint` and `NEXT` fields are what make a failure actionable for a model that cannot reason about it.

### Gating tiers

- **After every atomic task** (target < 15 s): `tsc -b --noEmit` then `vite build`. Nothing else. These emit `file:line:message`, which the executor can act on directly.
- **After every milestone** (2–4 min): `npm run gate` — the above plus `playwright test` against `vite preview` (the production build, not the dev server).
- **Regression:** every milestone's spec file stays in the suite permanently. Milestone N runs specs 1..N.

---

## Milestones

Risk is deliberately front-loaded: M4 and M5 — the elevation state machine and collision, this plan's stated #1 risk and the thing the last attempt never wrote at all — land against a hand-authored fixture track, before any procedural content exists to confuse a failure.

| # | Milestone | Definition of Done (mechanical) |
|---|---|---|
| **M0** | **Environment gate** — zero `src/` code | Probe ladder G0–G5 all green: deps install → `glxinfo` direct rendering → headed WebGL2 → headless WebGL2 → Vite serves modules with correct MIME over a path containing a space → Three.js cube passes the luma probe. Writes working launch args to `test/gl-profile.json`. **Nothing else starts until this is green.** |
| **M1** | Contracts + harness + skeleton | `src/contracts/*` byte-match this document; `tsc -b` clean; `window.__GAME__` returns a valid snapshot; Tier 1 + Tier 2 pass against the real Vite app |
| **M2** | Core loop, split modules | `Renderer`, `SceneRoot`, `Loop`, `Input` each < 150 LOC; `step(120)` advances `simTime` by 1.0 within 1e-9; `grep -rn 'Math.random(' src/` returns only `rng.ts` |
| **M3** | Player kinematics (capsule proxy) | Lane lerp, jump, slide, fast-fall. Scripted input ⇒ exact `x`/`y` at named frames |
| **M4** | **Elevation state machine** (fixture track) | Fixture with one platform + one ramp train; scripted inputs drive `GROUND→ON_PLATFORM→GROUND→ON_TRAIN_ROOF→GROUND`; the `events` transition list matches exactly |
| **M5** | **Collision + death + score** | `Box3` present; front-face hit at all 3 elevations ⇒ `gameover`; landing on a `LandableSurface` ⇒ no death; score increments; high score persists to `localStorage` |
| **M6** | Track streaming + spawner + `relativeSpeed` | Salvaged pattern table wired to `ObstacleSpec`; 5 fixed seeds × 3000 ticks with a scripted optimal bot ⇒ 0 deaths; pool size never grows after frame 600 |
| **M7** | Coins + power-ups | Magnet, sneakers, jetpack, hoverboard each assert via snapshot deltas; hoverboard converts exactly one fatal hit into survival |
| **M8** | Mixamo character | **Requires Human Queue item 1 complete.** GLB loads, clips map to player states, capsule proxy removed, all prior specs still green |
| **M9** | UI + audio + HUD | DOM assertions on score/coins/timers; `menu → play → gameover → restart` fully drivable from the harness |
| **M10** | Environment art + lighting — **see flagged risk below** | Draw calls under budget; `InstancedMesh` counts asserted; Tier 2 still passes |
| **M11** | Post-FX — **one pass per task** | Each of RenderPass → Bloom → Halftone → Chromatic → Sobel → Glitch → Film → Output added individually, with Tier 2 and the frame-time budget re-asserted after each; quality tiers switchable via `__GAME__` |

**Flagged risk for M10:** during M0/M1, `MeshStandardMaterial` lit by `AmbientLight` + `DirectionalLight` showed almost no directional-light response on this GPU/driver combination (Mesa/ANGLE on the RX 7900 XTX) — a rotating cube's faces were visually near-identical regardless of orientation, with luma matching the ambient term alone. This was worked around for M0/M1 by switching to a gradient sky background rather than depending on lighting for tonal variety, which was the right call for a render-verification gate. It has **not** been root-caused (candidates: Three.js's physically-based light-unit change post-r155 making a "reasonable-looking" intensity value like 2.0 actually negligible in lux terms, or a driver-specific shading path issue) and is out of scope until M10, which is the first milestone whose actual deliverable depends on lighting looking right. Budget real investigation time there; do not assume raising intensity numbers blindly will fix it.

Spawn fairness rule for M6, stated so it is not re-derived: lead distance scales with closing speed as `lead = baseLead * (1 + relativeSpeed / worldSpeed)`, and a row is only valid if at least one lane is survivable **from the player's currently reachable elevation states** — a lane whose only opening is a platform the player cannot reach in time does not count as open.

---

## Human Queue

Lives in `HUMAN-QUEUE.md`. **No milestone depends on it except M8.** The executor never performs, waits on, or reports about these.

1. **Mixamo pre-flight** (blocks M8, startable now): download character GLB + clips for run, jump, slide, land, crash.
2. Audio selection: music + SFX for jump, land, coin, crash, hoverboard bounce.
3. Any licensing decision, including whether a credits screen is required.

### Batched review checkpoints

Four sessions, each with a written checklist. Everything between them ships unattended.

| After | Judge |
|---|---|
| M3 | Movement feel — jump arc, lane-switch snappiness |
| M6 | Difficulty ramp and spawn fairness |
| M9 | UI clarity and audio mix |
| M11 | Art direction — whether the halftone/chromatic look actually works |

Machines can bound these but not judge them: assert p95 frame time < 20 ms and no 60-frame window exceeding 33 ms; assert composer passes are in the specified order; assert every audio asset loaded. Those catch regressions, not ugliness.

---

## Expansion workflow

1. Claude (subscription) expands milestone N into `microplan/NN-<slug>.md` via `/microplan plan.md phase N` — grounded in the files actually on disk, not in this document's predictions.
2. dsh + local Qwen executes that file top to bottom.
3. `npm run gate` decides pass/fail.
4. Only then is milestone N+1 expanded. Microplans are never batch-generated far ahead: the skill grounds each one in real files, and files from unfinished milestones do not exist yet.
