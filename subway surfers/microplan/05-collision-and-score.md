# M5 — Collision, Death, and Score

**Depends on:** `microplan/04-elevation-state-machine.md` complete and green (`npm run gate`: 18/18 passing).

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Where a task gives file content, transcribe it exactly. If a Verification step fails, stop and report the exact command output. Do not redesign.

**What this milestone does:** adds `THREE.Box3`-based collision detection, a `gameover` state that freezes the simulation, running score, and a `localStorage` high score — using its own small, hand-authored `ObstacleSpec` fixtures selected via a URL query parameter, completely independent of M4's `LandableSurface` fixtures (which stay exactly as they are).

**Working directory for every command:** `/home/shubhankar/Desktop/games-test/subway surfers`

---

## Frozen decisions for this milestone

- **New module `src/core/Collision.ts`** builds `THREE.Box3` instances for the player and for each `ObstacleSpec`, and returns the first obstacle whose box the player's box intersects — skipping whichever obstacle the player is *currently riding* (matched by id, see below). Only obstacles with a non-empty `deadlyFaces` array are ever checked.
- **Player hitbox:** centered at `(x, worldZ)`, width `PLAYER_WIDTH`, depth `PLAYER_DEPTH`, height `PLAYER_HEIGHT * scaleY`, bottom at `feetY`. `worldZ` is `debugHook.world.distance`, exactly as in M4.
- **The "currently riding, don't kill me" exemption is done by id-matching, not by ignoring elevation.** `PlayerController` gains a `get onSurfaceOwnerId(): number | null` getter. Any `ObstacleSpec` fixture that represents a surface the player can legitimately ride **must reuse the same numeric id as the matching `LandableSurface.ownerId` in `src/fixtures/m4Track.ts`** (platform = `1`, train roof = `2`) — this is a real cross-file consistency requirement, not a coincidence. Any *other* obstacle (a barrier standing on a surface, a plain wall) must use a distinct id so it is never exempted.
- **M5's obstacle fixtures are selected by a URL query parameter (`?fixture=<name>`), read once in `main.ts` at boot — this is a test-only seam, not a real game mechanic.** It exists so different Playwright tests can load different obstacle sets without a spawner (M6's job) or a way to hot-swap fixtures mid-run. Navigating to `/` with no query param loads the `default` (empty) set, so every existing M1–M4 test — which all navigate to plain `/` — is completely unaffected by this milestone.
- **`debugHook.state` transitions to `'gameover'` on a fatal collision, and `Sim.tick()` becomes a no-op once in that state** — this is the "freeze the world" behavior; no further physics, scoring, or input is processed after death.
- **Score:** `debugHook.world.score = Math.floor(debugHook.world.distance * DISTANCE_SCORE_MULTIPLIER)`, recomputed every tick while playing.
- **High score key, frozen:** `localStorage` key `'subway-surfers-high-score'`, a plain numeric string. Written only at the moment of gameover, only if the new score exceeds the stored value (or none exists).
- **Event payloads, frozen:**
  - `'collision'`: `{ obstacleId: number, elevation: string }`
  - `'gameover'`: `{ score: number, cause: string }` (`cause` is always `'collision'` in this milestone — there is no other death cause yet)

---

## Task 5.1 — Create the collision module

- **File:** `src/core/Collision.ts`
- **Action:** create
- **Preconditions:** M4 complete
- **Spec:** Write exactly:

```ts
import * as THREE from 'three';
import { PLAYER_DEPTH, PLAYER_HEIGHT, PLAYER_WIDTH } from '@/core/GameConfig';
import type { ObstacleSpec } from '@/contracts/obstacle';

export function playerBox(x: number, feetY: number, worldZ: number, scaleY: number): THREE.Box3 {
  const halfW = PLAYER_WIDTH / 2;
  const halfD = PLAYER_DEPTH / 2;
  const height = PLAYER_HEIGHT * scaleY;
  return new THREE.Box3(
    new THREE.Vector3(x - halfW, feetY, worldZ - halfD),
    new THREE.Vector3(x + halfW, feetY + height, worldZ + halfD),
  );
}

export function obstacleBox(o: ObstacleSpec): THREE.Box3 {
  const b = o.bounds;
  return new THREE.Box3(
    new THREE.Vector3(b.x - b.hx, b.y - b.hy, b.z - b.hz),
    new THREE.Vector3(b.x + b.hx, b.y + b.hy, b.z + b.hz),
  );
}

export function findFatalCollision(
  pBox: THREE.Box3,
  obstacles: readonly ObstacleSpec[],
  currentSurfaceOwnerId: number | null,
): ObstacleSpec | null {
  for (const o of obstacles) {
    if (o.id === currentSurfaceOwnerId) continue;
    if (o.deadlyFaces.length === 0) continue;
    if (pBox.intersectsBox(obstacleBox(o))) return o;
  }
  return null;
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 5.2 — Add onSurfaceOwnerId to PlayerController

- **File:** `src/core/PlayerController.ts`
- **Action:** modify
- **Preconditions:** none
- **Spec:** Add this getter immediately after the existing `get grounded()` getter — do not change anything else in the file:

```ts
  get onSurfaceOwnerId(): number | null {
    return this.onSurface?.ownerId ?? null;
  }
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 5.3 — Create the M5 obstacle fixtures

- **File:** `src/fixtures/m5Fixtures.ts`
- **Action:** create
- **Preconditions:** Task 5.1 complete
- **Spec:** `PLATFORM_WITH_RISER` uses `id: 1` and `RAMP_TRAIN` uses `id: 2` **on purpose** — they must match `m4Track.ts`'s `ownerId`s exactly, or the ride-safe exemption in `Collision.ts` will not recognize them and the player will be killed by the very surface they are correctly riding. Write exactly:

```ts
import { PLATFORM_HEIGHT, RAMP_LENGTH, TRAIN_LENGTH, TRAIN_ROOF_HEIGHT } from '@/core/GameConfig';
import type { ObstacleSpec } from '@/contracts/obstacle';

const WALL: ObstacleSpec = {
  id: 20,
  type: 'FULL_BLOCK',
  lane: 1,
  relativeSpeed: 0,
  bounds: { x: 0, y: 0.9, z: 13, hx: 4.25, hy: 0.9, hz: 3 },
  landableSurfaces: [],
  deadlyFaces: ['FRONT'],
};

const PLATFORM_WITH_RISER: ObstacleSpec = {
  id: 1,
  type: 'PLATFORM',
  lane: 1,
  relativeSpeed: 0,
  bounds: { x: 0, y: PLATFORM_HEIGHT / 2, z: 13, hx: 1.25, hy: PLATFORM_HEIGHT / 2, hz: 3 },
  landableSurfaces: [
    { topY: PLATFORM_HEIGHT, zStart: 10, zEnd: 16, xCenter: 0, halfWidth: 1.25, kind: 'PLATFORM', ownerId: 1 },
  ],
  deadlyFaces: ['FRONT'],
};

const OVERHEAD_BARRIER_ON_PLATFORM: ObstacleSpec = {
  id: 11,
  type: 'HIGH_BARRIER',
  lane: 1,
  relativeSpeed: 0,
  bounds: { x: 0, y: PLATFORM_HEIGHT + 0.4, z: 14, hx: 1.25, hy: 0.4, hz: 0.3 },
  landableSurfaces: [],
  deadlyFaces: ['FRONT'],
};

const RAMP_TRAIN: ObstacleSpec = {
  id: 2,
  type: 'RAMP_TRAIN',
  lane: 1,
  relativeSpeed: 0,
  bounds: {
    x: 0,
    y: TRAIN_ROOF_HEIGHT / 2,
    z: 30 + TRAIN_LENGTH / 2,
    hx: 1.25,
    hy: TRAIN_ROOF_HEIGHT / 2,
    hz: TRAIN_LENGTH / 2,
  },
  landableSurfaces: [
    {
      topY: TRAIN_ROOF_HEIGHT,
      zStart: 30,
      zEnd: 30 + TRAIN_LENGTH,
      rampZEnd: 30 + RAMP_LENGTH,
      xCenter: 0,
      halfWidth: 1.25,
      kind: 'TRAIN_ROOF',
      ownerId: 2,
    },
  ],
  deadlyFaces: [],
};

const OVERHEAD_BARRIER_ON_ROOF: ObstacleSpec = {
  id: 31,
  type: 'HIGH_BARRIER',
  lane: 1,
  relativeSpeed: 0,
  bounds: { x: 0, y: TRAIN_ROOF_HEIGHT + 0.4, z: 36, hx: 1.25, hy: 0.4, hz: 0.3 },
  landableSurfaces: [],
  deadlyFaces: ['FRONT'],
};

export const M5_FIXTURE_SETS: Record<string, ObstacleSpec[]> = {
  default: [],
  'ground-hit': [WALL],
  'platform-ride-hit': [PLATFORM_WITH_RISER, OVERHEAD_BARRIER_ON_PLATFORM],
  'platform-ride-safe': [PLATFORM_WITH_RISER],
  'train-roof-ride-hit': [RAMP_TRAIN, OVERHEAD_BARRIER_ON_ROOF],
};
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 5.4 — Rewrite Sim.ts with collision, state, and score

- **File:** `src/core/Sim.ts`
- **Action:** modify (replace the entire file contents)
- **Preconditions:** Tasks 5.1, 5.2, 5.3 complete
- **Spec:** Replace the whole file with exactly:

```ts
import { BASE_SPEED, DISTANCE_SCORE_MULTIPLIER, FIXED_TIMESTEP } from '@/core/GameConfig';
import { debugHook, pushDebugEvent } from '@/core/DebugHook';
import { PlayerController } from '@/core/PlayerController';
import { M4_SURFACES } from '@/fixtures/m4Track';
import { findFatalCollision, playerBox } from '@/core/Collision';
import type { ObstacleSpec } from '@/contracts/obstacle';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputQueue } from '@/input/InputQueue';
import { mulberry32, type Rng } from '@/util/rng';

const HIGH_SCORE_KEY = 'subway-surfers-high-score';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);
  private readonly player = new PlayerController();

  constructor(
    private readonly scene: SceneRoot,
    private readonly input: InputQueue,
    private readonly obstacles: ObstacleSpec[],
  ) {}

  setSeed(seed: number): void {
    this.rng = mulberry32(seed);
  }

  get simTime(): number {
    return this.tickCount * FIXED_TIMESTEP;
  }

  tick(): void {
    if (debugHook.state === 'gameover') return;

    const actions = this.input.drain();
    for (const action of actions) this.player.applyAction(action);

    this.tickCount++;
    debugHook.world.speed = BASE_SPEED;
    debugHook.world.distance += BASE_SPEED * FIXED_TIMESTEP;

    this.player.tick(FIXED_TIMESTEP, this.tickCount, debugHook.world.distance, M4_SURFACES);
    this.scene.update(this.player.x, this.player.feetY, this.player.scaleY);

    debugHook.stats.simTick = this.tickCount;
    debugHook.stats.simTime = this.simTime;
    debugHook.player.lane = this.player.lane;
    debugHook.player.x = this.player.x;
    debugHook.player.feetY = this.player.feetY;
    debugHook.player.y = this.scene.placeholder.position.y;
    debugHook.player.elevation = this.player.elevation;
    debugHook.player.velocityY = this.player.velocityY;
    debugHook.player.grounded = this.player.grounded;
    debugHook.world.score = Math.floor(debugHook.world.distance * DISTANCE_SCORE_MULTIPLIER);

    const pBox = playerBox(this.player.x, this.player.feetY, debugHook.world.distance, this.player.scaleY);
    const hit = findFatalCollision(pBox, this.obstacles, this.player.onSurfaceOwnerId);
    if (hit) {
      pushDebugEvent(this.tickCount, 'collision', { obstacleId: hit.id, elevation: this.player.elevation });
      debugHook.state = 'gameover';
      pushDebugEvent(this.tickCount, 'gameover', { score: debugHook.world.score, cause: 'collision' });

      const stored = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? '0');
      if (debugHook.world.score > stored) {
        localStorage.setItem(HIGH_SCORE_KEY, String(debugHook.world.score));
      }
    }
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 5.5 — Wire fixture selection into main.ts

- **File:** `src/main.ts`
- **Action:** modify
- **Preconditions:** Task 5.4 complete
- **Spec:** Add the import

```ts
import { M5_FIXTURE_SETS } from '@/fixtures/m5Fixtures';
```

directly after the existing `import { Sim } from '@/core/Sim';` line. Then replace this existing line:

```ts
const sim = new Sim(sceneRoot, input);
```

with exactly:

```ts
const fixtureName = new URLSearchParams(location.search).get('fixture') ?? 'default';
const obstacles = M5_FIXTURE_SETS[fixtureName] ?? M5_FIXTURE_SETS.default;
const sim = new Sim(sceneRoot, input, obstacles);
```

  Nothing else in the file changes.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 **and** `npm run build` exits 0.

---

## Task 5.6 — Create the collision and score spec

- **File:** `test/collision.spec.ts`
- **Action:** create
- **Preconditions:** Task 5.5 complete
- **Spec:** Six independent tests, each navigating to its own `?fixture=` so obstacle sets never interfere with each other. Write exactly:

```ts
import { expect, test } from '@playwright/test';

test.describe('collision, death, and score', () => {
  test('front-face hit while GROUND causes gameover', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    const collision = result.events.find((e) => e.type === 'collision');
    expect(result.state).toBe('gameover');
    expect(collision).toBeTruthy();
    expect(collision!.data.obstacleId).toBe(20);
    expect(collision!.data.elevation).toBe('GROUND');
    expect(result.events.some((e) => e.type === 'gameover' && e.data.cause === 'collision')).toBe(true);
  });

  test('front-face hit while ON_PLATFORM causes gameover', async ({ page }) => {
    await page.goto('/?fixture=platform-ride-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    const collision = result.events.find((e) => e.type === 'collision');
    expect(result.state).toBe('gameover');
    expect(collision).toBeTruthy();
    expect(collision!.data.obstacleId).toBe(11);
    expect(collision!.data.elevation).toBe('ON_PLATFORM');
  });

  test('riding the platform without an overhead hazard causes no death', async ({ page }) => {
    await page.goto('/?fixture=platform-ride-safe');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    expect(result.state).toBe('playing');
    expect(result.events.filter((e) => e.type === 'collision')).toEqual([]);
    expect(result.events.some((e) => e.type === 'land' && e.data.surfaceKind === 'PLATFORM')).toBe(true);
  });

  test('front-face hit while ON_TRAIN_ROOF causes gameover', async ({ page }) => {
    await page.goto('/?fixture=train-roof-ride-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(400);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    const collision = result.events.find((e) => e.type === 'collision');
    expect(result.state).toBe('gameover');
    expect(collision).toBeTruthy();
    expect(collision!.data.obstacleId).toBe(31);
    expect(collision!.data.elevation).toBe('ON_TRAIN_ROOF');
  });

  test('score increments with distance while playing', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const score = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.step(120);
      return window.__GAME__.world.score;
    });

    expect(score).toBe(14); // BASE_SPEED=14, DISTANCE_SCORE_MULTIPLIER=1, 120 ticks = 1 second
  });

  test('high score persists to localStorage on gameover', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return {
        state: window.__GAME__.state,
        score: window.__GAME__.world.score,
        stored: localStorage.getItem('subway-surfers-high-score'),
      };
    });

    expect(result.state).toBe('gameover');
    expect(result.stored).toBe(String(result.score));
  });
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 5.7 — Run the full gate

- **File:** none
- **Action:** run command
- **Preconditions:** all previous tasks complete
- **Spec:** Run `npm run gate`.
- **Verification:** Exit code 0, Playwright output shows **24 passed** (18 from M1–M4 + 6 new in `collision.spec.ts`). If any test fails, report the failing test name and its full output. Do not modify a test to make it pass, and do not change any id in `m5Fixtures.ts` without re-reading the "frozen decisions" note above about why the ids must match `m4Track.ts`.

---

## Milestone Definition of Done

1. `npm run gate` — exit 0, 24 tests passed
2. `grep -n "Box3" src/core/Collision.ts` returns at least one match
3. Navigating to plain `/` (no `?fixture=`) produces zero obstacles and behaves identically to M4 — confirmed by the existing M1–M4 tests still passing unmodified
4. `grep -n "Math.random(" src/` still returns only `src/util/rng.ts`

**Report on completion:** the Playwright summary line. Do not begin M6 — its microplan does not exist yet, and per the project's own rule, later milestones are never batch-generated ahead of the ones that ground them.
