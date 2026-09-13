# M6a — Track Streaming & Spawner

**Depends on:** `microplan/05-collision-and-score.md` complete and green (`npm run gate`: 24/24 passing).

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Where a task gives file content, transcribe it exactly. If a Verification step fails, stop and report the exact command output. Do not redesign.

**What this milestone does:** replaces M4/M5's hand-authored static fixtures, in a **new, additive game mode only**, with a real procedural spawner: pooled obstacle meshes (via the already-restored `ObjectPool`), a weighted solvable-pattern table adapted from the original project's salvaged `Spawner.ts`, and `relativeSpeed`-driven accelerating trains. **M4 and M5's existing tests are untouched and must keep passing exactly as before** — this milestone does not modify what `/` or `/?fixture=<name>` do.

**What this milestone deliberately does NOT do (scoped to a follow-up, 06b):** the fairness proof — "5 fixed seeds × 3000 ticks with a scripted optimal bot ⇒ 0 deaths" — and the `relativeSpeed`-scaled lead-distance formula (`lead = baseLead * (1 + relativeSpeed / worldSpeed)`) from `plan.md`. Both require the same kind of careful, numerically-verified timing work M4's elevation transitions needed, and freezing them without that verification risks baking in an untested formula. 06b will design the bot and the lead-distance tuning together, since the bot's own survival is what actually validates whatever lead distance gets chosen.

**Working directory for every command:** `/home/shubhankar/Desktop/games-test/subway surfers`

---

## Frozen decisions for this milestone

- **Backward compatibility via a reserved fixture name.** `main.ts` already reads `?fixture=<name>` (from M5) to select a static `ObstacleSpec[]` from `M5_FIXTURE_SETS`. This milestone adds one reserved name, `'procedural'`, which switches `Sim` into spawner-driven mode instead of a static array. Navigating to plain `/` or any existing `?fixture=` name from M5 behaves **exactly as before** — this is the mechanism that keeps M4/M5's tests passing untouched.
- **`Sim.rng` (public since M2, unused until now) is the spawner's only randomness source**, reseeded via the already-tested `debugHook.seed(n)` driver. The spawner never owns or seeds its own RNG — this is why `Math.random()` stays banned and grep-enforced.
- **Obstacle identity across ticks:** each spawned `ObstacleSpec` keeps a monotonically increasing `id` (never reused within a session). A row consumes at most 4 ids (the largest pattern places 3 obstacles); the id counter always advances by 4 per row for simplicity, not by exact usage.
- **Coordinate model, unchanged from M4/M5:** `debugHook.world.distance` grows monotonically; obstacle `bounds.z` / `landableSurfaces` are assigned once at spawn time in that same absolute frame and normally stay fixed. **The one exception:** an obstacle with `relativeSpeed > 0` has its `bounds.z` (and its surfaces' `zStart`/`zEnd`/`rampZEnd`) decremented by `relativeSpeed * dt` every tick, on top of the ambient approach caused by `world.distance` growing — this is what makes it close faster than a static obstacle. A static obstacle (`relativeSpeed === 0`) is never mutated after spawn, exactly like M4/M5's fixtures.
- **Rendering is a simple, unstyled box per obstacle** (`BoxGeometry` sized to `2*hx, 2*hy, 2*hz`, one flat material) positioned each tick at `(bounds.x, bounds.y, bounds.z - world.distance)` — that subtraction is the only place "the world scrolls past a stationary player" actually shows up; the simulation math itself never needs a player-relative Z. Real art is M10's job.
- **Pool size is fixed at 32 obstacle meshes.** If exhausted, `Spawner.update` silently skips spawning that obstacle's mesh for that row (a conservative failure mode — a missing obstacle can only make a row easier, never unfairly harder). This is expected to be rare, not treated as an error.
- **Solvability-by-construction, adapted from the original `Spawner.ts`'s weighted table (git commit `1fc1d10`):** the original table is preserved structurally (same weights, same use of a per-row weighted roll plus per-entry sub-random choices) but retyped onto this project's `ObstacleSpec` model. One change: `TRAIN` is placed **only ever in lane 1 (center)**, and never more than one per row — this is what makes every row solvable by construction (outer lanes only ever carry `LOW_BARRIER`/`HIGH_BARRIER`/`PLATFORM`, all individually clearable by jump, slide, or jump-onto respectively, never a hard block). One new entry not in the original table: a solo `PLATFORM` in a random outer lane, matching this project's Phase-5 taxonomy (a platform reachable by jumping, not the original codebase's separate always-on elevated-deck system, which this project does not replicate).

**Pattern table (verbatim structure, retyped):**

| Weight | Pattern |
|---|---|
| 3 | Single `LOW_BARRIER`, random lane |
| 3 | Single `HIGH_BARRIER`, random lane |
| 2.5 | Single center-lane train: 40% static `TRAIN`, 30% accelerating `TRAIN` (`relativeSpeed = FAST_TRAIN_EXTRA_SPEED`), 30% `RAMP_TRAIN` |
| 1.5 | "Wall" — `LOW_BARRIER` in all three lanes |
| 1.5 | "Wall" — `HIGH_BARRIER` in all three lanes |
| 1.5 | Center train (as above) + one barrier (50/50 low/high) in one random outer lane; the other outer lane stays clear |
| 1.5 | Solo `PLATFORM` in a random outer lane |
| 1 | "Gauntlet" — center train (as above) + the **same** barrier type on **both** outer lanes |

---

## Task 6a.1 — Create obstacle templates

- **File:** `src/spawner/ObstacleTemplates.ts`
- **Action:** create
- **Preconditions:** M5 complete
- **Spec:** Write exactly:

```ts
import { LANE_POSITIONS, PLATFORM_HEIGHT, RAMP_LENGTH, TRAIN_LENGTH, TRAIN_ROOF_HEIGHT } from '@/core/GameConfig';
import type { ObstacleSpec } from '@/contracts/obstacle';

const LANE_HALF_WIDTH = 1.25;

export function makeLowBarrier(id: number, lane: 0 | 1 | 2, z: number): ObstacleSpec {
  const x = LANE_POSITIONS[lane];
  return {
    id,
    type: 'LOW_BARRIER',
    lane,
    relativeSpeed: 0,
    bounds: { x, y: 0.5, z, hx: 1.0, hy: 0.5, hz: 0.4 },
    landableSurfaces: [],
    deadlyFaces: ['FRONT'],
  };
}

export function makeHighBarrier(id: number, lane: 0 | 1 | 2, z: number): ObstacleSpec {
  const x = LANE_POSITIONS[lane];
  return {
    id,
    type: 'HIGH_BARRIER',
    lane,
    relativeSpeed: 0,
    bounds: { x, y: 1.4, z, hx: 1.0, hy: 0.4, hz: 0.4 },
    landableSurfaces: [],
    deadlyFaces: ['FRONT'],
  };
}

export function makeTrain(id: number, lane: 0 | 1 | 2, z: number, relativeSpeed: number): ObstacleSpec {
  const x = LANE_POSITIONS[lane];
  return {
    id,
    type: 'TRAIN',
    lane,
    relativeSpeed,
    bounds: { x, y: TRAIN_ROOF_HEIGHT / 2, z, hx: LANE_HALF_WIDTH, hy: TRAIN_ROOF_HEIGHT / 2, hz: TRAIN_LENGTH / 2 },
    landableSurfaces: [],
    deadlyFaces: ['FRONT', 'SIDE'],
  };
}

export function makeRampTrain(id: number, lane: 0 | 1 | 2, z: number, relativeSpeed: number): ObstacleSpec {
  const x = LANE_POSITIONS[lane];
  const zStart = z - TRAIN_LENGTH / 2;
  return {
    id,
    type: 'RAMP_TRAIN',
    lane,
    relativeSpeed,
    bounds: { x, y: TRAIN_ROOF_HEIGHT / 2, z, hx: LANE_HALF_WIDTH, hy: TRAIN_ROOF_HEIGHT / 2, hz: TRAIN_LENGTH / 2 },
    landableSurfaces: [
      {
        topY: TRAIN_ROOF_HEIGHT,
        zStart,
        zEnd: zStart + TRAIN_LENGTH,
        rampZEnd: zStart + RAMP_LENGTH,
        xCenter: x,
        halfWidth: LANE_HALF_WIDTH,
        kind: 'TRAIN_ROOF',
        ownerId: id,
      },
    ],
    deadlyFaces: [],
  };
}

export function makePlatform(id: number, lane: 0 | 2, z: number): ObstacleSpec {
  const x = LANE_POSITIONS[lane];
  const zStart = z - 3;
  return {
    id,
    type: 'PLATFORM',
    lane,
    relativeSpeed: 0,
    bounds: { x, y: PLATFORM_HEIGHT / 2, z, hx: LANE_HALF_WIDTH, hy: PLATFORM_HEIGHT / 2, hz: 3 },
    landableSurfaces: [
      {
        topY: PLATFORM_HEIGHT,
        zStart,
        zEnd: zStart + 6,
        xCenter: x,
        halfWidth: LANE_HALF_WIDTH,
        kind: 'PLATFORM',
        ownerId: id,
      },
    ],
    deadlyFaces: ['FRONT'],
  };
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6a.2 — Create the weighted pattern table

- **File:** `src/spawner/PatternTable.ts`
- **Action:** create
- **Preconditions:** Task 6a.1 complete
- **Spec:** Write exactly:

```ts
import { FAST_TRAIN_EXTRA_SPEED } from '@/core/GameConfig';
import type { ObstacleSpec } from '@/contracts/obstacle';
import {
  makeHighBarrier,
  makeLowBarrier,
  makePlatform,
  makeRampTrain,
  makeTrain,
} from '@/spawner/ObstacleTemplates';
import { randInt, type Rng } from '@/util/rng';

const OUTER_LANES: Array<0 | 2> = [0, 2];

function trainOrRamp(rng: Rng, id: number, lane: 0 | 1 | 2, z: number): ObstacleSpec {
  const r = rng();
  if (r < 0.4) return makeTrain(id, lane, z, 0);
  if (r < 0.7) return makeTrain(id, lane, z, FAST_TRAIN_EXTRA_SPEED);
  return makeRampTrain(id, lane, z, 0);
}

export function pickPattern(rng: Rng, id0: number, z: number): ObstacleSpec[] {
  const roll = rng();
  const table: Array<{ weight: number; build: (id: number) => ObstacleSpec[] }> = [
    { weight: 3, build: (id) => [makeLowBarrier(id, randInt(rng, 0, 3) as 0 | 1 | 2, z)] },
    { weight: 3, build: (id) => [makeHighBarrier(id, randInt(rng, 0, 3) as 0 | 1 | 2, z)] },
    { weight: 2.5, build: (id) => [trainOrRamp(rng, id, 1, z)] },
    { weight: 1.5, build: (id) => [0, 1, 2].map((lane, i) => makeLowBarrier(id + i, lane as 0 | 1 | 2, z)) },
    { weight: 1.5, build: (id) => [0, 1, 2].map((lane, i) => makeHighBarrier(id + i, lane as 0 | 1 | 2, z)) },
    {
      weight: 1.5,
      build: (id) => {
        const outer = OUTER_LANES[randInt(rng, 0, 2)];
        const barrier = rng() < 0.5 ? makeLowBarrier(id + 1, outer, z) : makeHighBarrier(id + 1, outer, z);
        return [trainOrRamp(rng, id, 1, z), barrier];
      },
    },
    {
      weight: 1.5,
      build: (id) => {
        const lane = OUTER_LANES[randInt(rng, 0, 2)];
        return [makePlatform(id, lane, z)];
      },
    },
    {
      weight: 1,
      build: (id) => {
        const useLow = rng() < 0.5;
        const left = useLow ? makeLowBarrier(id + 1, 0, z) : makeHighBarrier(id + 1, 0, z);
        const right = useLow ? makeLowBarrier(id + 2, 2, z) : makeHighBarrier(id + 2, 2, z);
        return [trainOrRamp(rng, id, 1, z), left, right];
      },
    },
  ];

  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let pick = roll * total;
  for (const entry of table) {
    pick -= entry.weight;
    if (pick <= 0) return entry.build(id0);
  }
  return table[0].build(id0);
}
```

  Note: `roll` is captured once, before any of the sub-random choices inside a `build` closure run — this preserves the original code's structure of "one roll picks the pattern, further rolls only refine details within it," and is why the weight-selection logic is unaffected by how many additional `rng()` calls a given pattern happens to make.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6a.3 — Create the Spawner

- **File:** `src/spawner/Spawner.ts`
- **Action:** create
- **Preconditions:** Task 6a.2 complete
- **Spec:** Write exactly:

```ts
import * as THREE from 'three';
import { DESPAWN_DISTANCE, MAX_SPAWN_GAP, MIN_SPAWN_GAP, SPAWN_DISTANCE } from '@/core/GameConfig';
import { ObjectPool } from '@/systems/ObjectPool';
import { pickPattern } from '@/spawner/PatternTable';
import type { ObstacleSpec } from '@/contracts/obstacle';
import { randRange, type Rng } from '@/util/rng';

const MESH_POOL_SIZE = 32;

interface ActiveEntry {
  spec: ObstacleSpec;
  mesh: THREE.Mesh;
}

export class Spawner {
  private readonly pool: ObjectPool<THREE.Mesh>;
  private readonly active: ActiveEntry[] = [];
  private nextSpawnZ = SPAWN_DISTANCE;
  private nextId = 1;

  constructor(scene: THREE.Scene) {
    this.pool = new ObjectPool(
      () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x996633 })),
      MESH_POOL_SIZE,
      scene,
    );
  }

  update(dt: number, worldDistance: number, rng: Rng): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      if (entry.spec.relativeSpeed > 0) {
        entry.spec.bounds.z -= entry.spec.relativeSpeed * dt;
        for (const s of entry.spec.landableSurfaces) {
          s.zStart -= entry.spec.relativeSpeed * dt;
          s.zEnd -= entry.spec.relativeSpeed * dt;
          if (s.rampZEnd !== undefined) s.rampZEnd -= entry.spec.relativeSpeed * dt;
        }
      }

      entry.mesh.position.set(entry.spec.bounds.x, entry.spec.bounds.y, entry.spec.bounds.z - worldDistance);

      if (entry.spec.bounds.z < worldDistance - DESPAWN_DISTANCE) {
        this.pool.release(entry.mesh);
        this.active.splice(i, 1);
      }
    }

    while (this.nextSpawnZ < worldDistance + SPAWN_DISTANCE) {
      const specs = pickPattern(rng, this.nextId, this.nextSpawnZ);
      this.nextId += 4;
      for (const spec of specs) {
        const mesh = this.pool.acquire();
        if (!mesh) continue;
        mesh.scale.set(spec.bounds.hx * 2, spec.bounds.hy * 2, spec.bounds.hz * 2);
        this.active.push({ spec, mesh });
      }
      this.nextSpawnZ += MIN_SPAWN_GAP + randRange(rng, 0, MAX_SPAWN_GAP - MIN_SPAWN_GAP);
    }
  }

  activeObstacles(): ObstacleSpec[] {
    return this.active.map((e) => e.spec);
  }

  get poolStats(): { active: number; free: number } {
    return { active: this.pool.activeCount, free: this.pool.size - this.pool.activeCount };
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6a.4 — Rewrite Sim.ts to support procedural mode

- **File:** `src/core/Sim.ts`
- **Action:** modify (replace the entire file contents)
- **Preconditions:** Task 6a.3 complete
- **Spec:** Replace the whole file with exactly:

```ts
import { BASE_SPEED, DISTANCE_SCORE_MULTIPLIER, FIXED_TIMESTEP } from '@/core/GameConfig';
import { debugHook, pushDebugEvent } from '@/core/DebugHook';
import { PlayerController } from '@/core/PlayerController';
import { M4_SURFACES } from '@/fixtures/m4Track';
import { findFatalCollision, playerBox } from '@/core/Collision';
import { Spawner } from '@/spawner/Spawner';
import type { ObstacleSpec } from '@/contracts/obstacle';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputQueue } from '@/input/InputQueue';
import { mulberry32, type Rng } from '@/util/rng';

const HIGH_SCORE_KEY = 'subway-surfers-high-score';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);
  private readonly player = new PlayerController();
  private readonly spawner: Spawner;
  private currentObstacles: ObstacleSpec[] = [];

  constructor(
    private readonly scene: SceneRoot,
    private readonly input: InputQueue,
    private readonly staticObstacles: ObstacleSpec[],
    private readonly useProcedural: boolean,
  ) {
    this.spawner = new Spawner(scene.scene);
    debugHook.obstacles = () =>
      this.currentObstacles.map((o) => ({
        id: o.id,
        type: o.type,
        lane: o.lane,
        z: o.bounds.z,
        topY: o.landableSurfaces[0]?.topY ?? null,
        zRange: [o.bounds.z - o.bounds.hz, o.bounds.z + o.bounds.hz] as [number, number],
        relativeSpeed: o.relativeSpeed,
      }));
  }

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

    if (this.useProcedural) this.spawner.update(FIXED_TIMESTEP, debugHook.world.distance, this.rng);

    this.currentObstacles = this.useProcedural ? this.spawner.activeObstacles() : this.staticObstacles;
    const surfaces = this.useProcedural
      ? this.currentObstacles.flatMap((o) => o.landableSurfaces)
      : M4_SURFACES;

    this.player.tick(FIXED_TIMESTEP, this.tickCount, debugHook.world.distance, surfaces);
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

    if (this.useProcedural) {
      const stats = this.spawner.poolStats;
      debugHook.pool.obstaclesActive = stats.active;
      debugHook.pool.obstaclesFree = stats.free;
    }

    const pBox = playerBox(this.player.x, this.player.feetY, debugHook.world.distance, this.player.scaleY);
    const hit = findFatalCollision(pBox, this.currentObstacles, this.player.onSurfaceOwnerId);
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

  Note: constructing `new Spawner(scene.scene)` always (even in non-procedural mode) allocates 32 pooled meshes onto the scene graph unconditionally. They stay invisible and unused when `useProcedural` is false — harmless, but real; do not "optimize" this by making the spawner lazy without checking with the plan first, since M4/M5's tests were verified against the simpler always-constructed version.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6a.5 — Wire procedural mode into main.ts

- **File:** `src/main.ts`
- **Action:** modify
- **Preconditions:** Task 6a.4 complete
- **Spec:** Replace this existing block (from M5):

```ts
const fixtureName = new URLSearchParams(location.search).get('fixture') ?? 'default';
const obstacles = M5_FIXTURE_SETS[fixtureName] ?? M5_FIXTURE_SETS.default;
const sim = new Sim(sceneRoot, input, obstacles);
```

with exactly:

```ts
const fixtureName = new URLSearchParams(location.search).get('fixture') ?? 'default';
const useProcedural = fixtureName === 'procedural';
const obstacles = useProcedural ? [] : (M5_FIXTURE_SETS[fixtureName] ?? M5_FIXTURE_SETS.default);
const sim = new Sim(sceneRoot, input, obstacles, useProcedural);
```

  Nothing else in the file changes.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 **and** `npm run build` exits 0.

---

## Task 6a.6 — Create the spawner spec

- **File:** `test/spawner.spec.ts`
- **Action:** create
- **Preconditions:** Task 6a.5 complete
- **Spec:** Write exactly:

```ts
import { expect, test } from '@playwright/test';

test.describe('procedural spawner', () => {
  test('rows are solvable by construction: at most one TRAIN per row, always centered', async ({ page }) => {
    await page.goto('/?fixture=procedural');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const obstacles = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(7);
      window.__GAME__.step(1500);
      return window.__GAME__.obstacles();
    });

    expect(obstacles.length).toBeGreaterThan(0);

    const trains = obstacles.filter((o) => o.type === 'TRAIN');
    for (const t of trains) {
      expect(t.lane).toBe(1);
    }

    const byZ = new Map<number, number>();
    for (const t of trains) {
      const bucket = Math.round(t.z);
      byZ.set(bucket, (byZ.get(bucket) ?? 0) + 1);
    }
    for (const count of byZ.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test('pool size never grows once obstacles are recycling', async ({ page }) => {
    await page.goto('/?fixture=procedural');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(3);
      window.__GAME__.step(600);
      const early = { ...window.__GAME__.pool };
      window.__GAME__.step(2400); // 3000 ticks total = 25s of travel
      const late = { ...window.__GAME__.pool };
      return { early, late };
    });

    const totalEarly = result.early.obstaclesActive + result.early.obstaclesFree;
    const totalLate = result.late.obstaclesActive + result.late.obstaclesFree;
    expect(totalLate).toBe(totalEarly);
    expect(result.late.obstaclesActive).toBeLessThanOrEqual(totalLate);
  });
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6a.7 — Run the full gate

- **File:** none
- **Action:** run command
- **Preconditions:** all previous tasks complete
- **Spec:** Run `npm run gate`.
- **Verification:** Exit code 0, Playwright output shows **26 passed** (24 from M1–M5 + 2 new in `spawner.spec.ts`), all M1–M5 test names identical to before. If any pre-existing test fails, **stop immediately** — that means procedural mode has somehow leaked into the default/static path, which must not happen.

---

## Milestone Definition of Done

1. `npm run gate` — exit 0, 26 tests passed, with all 24 prior test names unchanged
2. `grep -n "Math.random(" src/` still returns only `src/util/rng.ts`
3. Navigating to `/` or any M5 `?fixture=` name still produces the exact same behavior as before this milestone
4. `debugHook.pool` and `debugHook.obstacles()` return real data when `?fixture=procedural` is active

**Report on completion:** the Playwright summary line. **Do not begin 06b** — it needs the bot-policy and lead-distance design work called out above, which is a separate follow-up, not a continuation of this file.
