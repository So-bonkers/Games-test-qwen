# M4 — Elevation State Machine (Fixture Track)

**Depends on:** `microplan/03-player-kinematics.md` complete and green (`npm run gate`: 16/16 passing).

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Where a task gives file content, transcribe it exactly. If a Verification step fails, stop and report the exact command output. Do not redesign.

**What this milestone does:** extends `PlayerController` (created in M3) with the `GROUND → ON_PLATFORM/ON_TRAIN_ROOF → AIRBORNE → GROUND` transition logic, against a small **hand-authored, static fixture** of two `LandableSurface`s (one platform, one ramp train). There is no spawner and no randomness here — that is M6's job. The exact tick numbers this milestone produces were verified by simulating the identical formulas before being written into this spec; they are not estimates.

**Working directory for every command:** `/home/shubhankar/Desktop/games-test/subway surfers`

---

## Frozen decisions for this milestone

- **`worldZ` is `debugHook.world.distance`.** There is no separate internal Z tracker. `Sim.tick()` increments `world.distance += BASE_SPEED * FIXED_TIMESTEP` every tick (unconditionally — gating this on game state is M5's job when `gameover` is introduced). This single value is both "how far the player has traveled" (for score, later) and "the world-relative Z position obstacles/surfaces are checked against."
- **The player's rendered Z position never moves; the world's Z coordinate system moves toward the player instead**, per the frozen world convention in `plan.md` ("the player stays near z=0"). Fixture surfaces are defined at fixed `zStart`/`zEnd`; whether `worldZ` (i.e. `world.distance`) falls inside that range determines reachability — this is equivalent to the surface scrolling toward a stationary player.
- **`PlayerController.grounded` now means "not airborne"** (`elevation !== 'AIRBORNE'`) rather than `elevation === 'GROUND'` — widened so the player can jump away from a platform or train roof, not just from bare ground. This is a strict widening; it does not change M3's behavior (M3 never had a third state to distinguish).
- **Landing (jump onto a flat top):** while `AIRBORNE` and descending (`velocityY <= 0`), if `worldZ` is within a surface's `[zStart, zEnd]` and `feetY` has crossed at or below `topY`, and the player's `x` is within `xCenter ± halfWidth`, snap `feetY = topY`, `velocityY = 0`, transition to `ON_PLATFORM` or `ON_TRAIN_ROOF` per `surface.kind`.
- **Ramp entry (walk-up, no jump required):** while grounded and `worldZ` is within `[zStart, rampZEnd]` of a surface that has a `rampZEnd`, `feetY` is force-set to `topY * (worldZ - zStart) / (rampZEnd - zStart)` (linear ramp) and elevation transitions to `ON_TRAIN_ROOF` **immediately upon entering the ramp zone**, not upon reaching the top. This is a deliberate simplification — there is no fifth "climbing" state.
- **Dismount:** once riding a surface, when `worldZ > zEnd`, transition to `AIRBORNE` (`velocityY = 0`, gravity resumes) and fire a `dismount` event. The player then falls normally and re-enters `GROUND` through the same ground-clamp logic M3 already has — there is no direct `ON_X → GROUND` transition.
- **Event payloads (frozen — any later milestone reading these must match exactly):**
  - `'land'`: `{ surfaceKind: 'PLATFORM' | 'TRAIN_ROOF', topY: number, ownerId: number }`
  - `'dismount'`: `{ surfaceKind: 'PLATFORM' | 'TRAIN_ROOF', ownerId: number }`
- **`debugHook.events` is a capped ring buffer, capacity 256, oldest-evicted**, via a new `pushDebugEvent()` helper in `DebugHook.ts` — the single place anything is ever allowed to push into `events`.
- **Fixture surfaces live in `src/fixtures/m4Track.ts`.** This file is specific to M4's own test; M6's real spawner will generate its own surfaces at runtime and does not read this file.
- **On why the test asserts order and final state, not exact tick numbers:** the verified simulation (see below) is accurate to the formulas as specified, but the real `Sim.tick()`'s exact ordering of "drain input" vs "increment world.distance" vs "run physics" can shift event timing by a tick or two versus the offline simulation. Every fixture Z-window below has tens of ticks of slack specifically to absorb that — assert qualitative event order and generous tick budgets, never an exact tick count.

**Verified reference timeline** (from simulating the exact rules above, jump issued at tick 30): `land:PLATFORM` @ tick 111, `dismount:PLATFORM` @ tick 138, back to `GROUND` @ tick 174, `land:TRAIN_ROOF` @ tick 258 (via ramp), `dismount:TRAIN_ROOF` @ tick 335, back to `GROUND` @ tick 392. Running to tick 480 gives every transition at least 45 ticks of margin.

---

## Task 4.1 — Create the M4 fixture track

- **File:** `src/fixtures/m4Track.ts`
- **Action:** create
- **Preconditions:** M3 complete
- **Spec:** Write exactly:

```ts
import { PLATFORM_HEIGHT, RAMP_LENGTH, TRAIN_LENGTH, TRAIN_ROOF_HEIGHT } from '@/core/GameConfig';
import type { LandableSurface } from '@/contracts/elevation';

const PLATFORM_Z_START = 10;
const PLATFORM_LENGTH = 6;
const TRAIN_Z_START = 30;

export const M4_SURFACES: LandableSurface[] = [
  {
    topY: PLATFORM_HEIGHT,
    zStart: PLATFORM_Z_START,
    zEnd: PLATFORM_Z_START + PLATFORM_LENGTH,
    xCenter: 0,
    halfWidth: 1.25,
    kind: 'PLATFORM',
    ownerId: 1,
  },
  {
    topY: TRAIN_ROOF_HEIGHT,
    zStart: TRAIN_Z_START,
    zEnd: TRAIN_Z_START + TRAIN_LENGTH,
    rampZEnd: TRAIN_Z_START + RAMP_LENGTH,
    xCenter: 0,
    halfWidth: 1.25,
    kind: 'TRAIN_ROOF',
    ownerId: 2,
  },
];
```

  With the project's current `GameConfig` values (`PLATFORM_HEIGHT=1.0`, `TRAIN_ROOF_HEIGHT=2.5`, `RAMP_LENGTH=3.0`, `TRAIN_LENGTH=9`), this resolves to exactly `zStart=10, zEnd=16` for the platform and `zStart=30, rampZEnd=33, zEnd=39` for the train roof — the same numbers the reference timeline above was verified against. If any of those constants has changed since M3, **stop and report** rather than adjusting the fixture's derived numbers — the reference timeline would no longer be valid.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 4.2 — Add the event ring buffer helper

- **File:** `src/core/DebugHook.ts`
- **Action:** modify
- **Preconditions:** none
- **Spec:** Change the import line

```ts
import type { DebugHook, DebugObstacle } from '@/contracts/debug';
```

to:

```ts
import type { DebugEvent, DebugHook, DebugObstacle } from '@/contracts/debug';
```

Then add this function directly after the `debugHook` object's closing `};` and before `installDebugHook`:

```ts
const EVENTS_CAPACITY = 256;

export function pushDebugEvent(
  tick: number,
  type: DebugEvent['type'],
  data: Record<string, number | string>,
): void {
  debugHook.events.push({ tick, type, data });
  if (debugHook.events.length > EVENTS_CAPACITY) debugHook.events.shift();
}
```

  Nothing else in the file changes.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 4.3 — Extend PlayerController with elevation logic

- **File:** `src/core/PlayerController.ts`
- **Action:** modify (replace the entire file contents)
- **Preconditions:** Tasks 4.1, 4.2 complete
- **Spec:** Replace the whole file with exactly:

```ts
import {
  FAST_FALL_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  LANE_POSITIONS,
  LERP_SPEED,
  PLAYER_SLIDE_SCALE,
  SLIDE_DURATION,
} from '@/core/GameConfig';
import { pushDebugEvent } from '@/core/DebugHook';
import type { Elevation, LandableSurface } from '@/contracts/elevation';
import type { InputAction } from '@/input/InputQueue';

export class PlayerController {
  lane: 0 | 1 | 2 = 1;
  x = 0;
  feetY = 0;
  velocityY = 0;
  elevation: Elevation = 'GROUND';
  scaleY = 1;
  private sliding = false;
  private slideTimer = 0;
  private onSurface: LandableSurface | null = null;

  get grounded(): boolean {
    return this.elevation !== 'AIRBORNE';
  }

  applyAction(action: InputAction): void {
    if (action === 'left') this.lane = Math.max(0, this.lane - 1) as 0 | 1 | 2;
    if (action === 'right') this.lane = Math.min(2, this.lane + 1) as 0 | 1 | 2;

    if (action === 'jump' && this.grounded) {
      this.velocityY = JUMP_VELOCITY;
      this.elevation = 'AIRBORNE';
      this.onSurface = null;
      this.sliding = false;
      this.slideTimer = 0;
      this.scaleY = 1;
    }

    if (action === 'slide') {
      if (this.grounded) {
        this.sliding = true;
        this.slideTimer = SLIDE_DURATION;
        this.scaleY = PLAYER_SLIDE_SCALE;
      } else {
        this.velocityY = -FAST_FALL_SPEED;
      }
    }
  }

  tick(dt: number, tickCount: number, worldZ: number, surfaces: readonly LandableSurface[]): void {
    const targetX = LANE_POSITIONS[this.lane];
    this.x += (targetX - this.x) * Math.min(1, LERP_SPEED * dt);

    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.sliding = false;
        this.scaleY = 1;
      }
    }

    if (this.elevation === 'GROUND') {
      for (const s of surfaces) {
        if (
          s.rampZEnd !== undefined &&
          worldZ >= s.zStart &&
          worldZ <= s.rampZEnd &&
          Math.abs(this.x - s.xCenter) <= s.halfWidth
        ) {
          this.feetY = (s.topY * (worldZ - s.zStart)) / (s.rampZEnd - s.zStart);
          this.elevation = s.kind === 'PLATFORM' ? 'ON_PLATFORM' : 'ON_TRAIN_ROOF';
          this.onSurface = s;
          pushDebugEvent(tickCount, 'land', { surfaceKind: s.kind, topY: s.topY, ownerId: s.ownerId });
        }
      }
    } else if (this.elevation === 'AIRBORNE') {
      this.velocityY += GRAVITY * dt;
      this.feetY += this.velocityY * dt;

      if (this.velocityY <= 0) {
        for (const s of surfaces) {
          if (
            worldZ >= s.zStart &&
            worldZ <= s.zEnd &&
            this.feetY <= s.topY &&
            Math.abs(this.x - s.xCenter) <= s.halfWidth
          ) {
            this.feetY = s.topY;
            this.velocityY = 0;
            this.elevation = s.kind === 'PLATFORM' ? 'ON_PLATFORM' : 'ON_TRAIN_ROOF';
            this.onSurface = s;
            pushDebugEvent(tickCount, 'land', { surfaceKind: s.kind, topY: s.topY, ownerId: s.ownerId });
          }
        }
      }

      if (this.feetY <= 0 && this.velocityY <= 0) {
        this.feetY = 0;
        this.velocityY = 0;
        this.elevation = 'GROUND';
      }
    } else {
      const s = this.onSurface as LandableSurface;
      if (s.rampZEnd !== undefined && worldZ <= s.rampZEnd) {
        this.feetY = (s.topY * (worldZ - s.zStart)) / (s.rampZEnd - s.zStart);
      } else {
        this.feetY = s.topY;
      }
      if (worldZ > s.zEnd) {
        this.elevation = 'AIRBORNE';
        this.velocityY = 0;
        pushDebugEvent(tickCount, 'dismount', { surfaceKind: s.kind, ownerId: s.ownerId });
        this.onSurface = null;
      }
    }
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 4.4 — Rewrite Sim.ts to drive world.distance and pass surfaces in

- **File:** `src/core/Sim.ts`
- **Action:** modify (replace the entire file contents)
- **Preconditions:** Task 4.3 complete
- **Spec:** Replace the whole file with exactly:

```ts
import { BASE_SPEED, FIXED_TIMESTEP } from '@/core/GameConfig';
import { debugHook } from '@/core/DebugHook';
import { PlayerController } from '@/core/PlayerController';
import { M4_SURFACES } from '@/fixtures/m4Track';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputQueue } from '@/input/InputQueue';
import { mulberry32, type Rng } from '@/util/rng';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);
  private readonly player = new PlayerController();

  constructor(
    private readonly scene: SceneRoot,
    private readonly input: InputQueue,
  ) {}

  setSeed(seed: number): void {
    this.rng = mulberry32(seed);
  }

  get simTime(): number {
    return this.tickCount * FIXED_TIMESTEP;
  }

  tick(): void {
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
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 **and** `npm run build` exits 0.

---

## Task 4.5 — Create the elevation spec

- **File:** `test/elevation.spec.ts`
- **Action:** create
- **Preconditions:** Task 4.4 complete
- **Spec:** Write exactly:

```ts
import { expect, test } from '@playwright/test';

test.describe('elevation state machine', () => {
  test('platform then train-roof ride, ending back on the ground', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(450);
    });

    const result = await page.evaluate(() => ({
      elevation: window.__GAME__.player.elevation,
      feetY: window.__GAME__.player.feetY,
      events: window.__GAME__.events,
    }));

    const order = result.events
      .filter((e) => e.type === 'land' || e.type === 'dismount')
      .map((e) => `${e.type}:${e.data.surfaceKind}`);

    expect(order).toEqual(['land:PLATFORM', 'dismount:PLATFORM', 'land:TRAIN_ROOF', 'dismount:TRAIN_ROOF']);
    expect(result.elevation).toBe('GROUND');
    expect(result.feetY).toBe(0);
  });

  test('grounded player who never jumps never lands on the platform', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return { elevation: window.__GAME__.player.elevation, events: window.__GAME__.events };
    });

    expect(result.elevation).toBe('GROUND');
    expect(result.events.filter((e) => e.type === 'land')).toEqual([]);
  });
});
```

  Note: the platform has no `rampZEnd`, so a grounded player who never jumps simply passes through its Z window without any transition — colliding with its (unmodeled, until M5) front face is a separate concern, not part of this milestone.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 4.6 — Run the full gate

- **File:** none
- **Action:** run command
- **Preconditions:** all previous tasks complete
- **Spec:** Run `npm run gate`.
- **Verification:** Exit code 0, Playwright output shows **18 passed** (16 from M1–M3 + 2 new in `elevation.spec.ts`). If any test fails, report the failing test name and its full output. Do not modify a test to make it pass — if the order assertion fails, report the actual `order` array exactly as printed; do not adjust fixture numbers yourself.

---

## Milestone Definition of Done

1. `npm run gate` — exit 0, 18 tests passed
2. `src/fixtures/m4Track.ts` exports exactly two `LandableSurface` entries
3. `debugHook.events` never exceeds 256 entries (enforced by `pushDebugEvent`, not separately tested here — M6's longer-running spawner tests will exercise the cap)
4. `grep -n "Math.random(" src/` still returns only `src/util/rng.ts`

**Report on completion:** the Playwright summary line and the exact `order` array from the first test. Do not begin M5 — its microplan does not exist yet.
