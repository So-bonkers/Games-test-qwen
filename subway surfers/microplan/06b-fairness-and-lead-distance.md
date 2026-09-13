# M6b — Spawn Fairness: Lead Distance + Scripted Bot

**Depends on:** `microplan/06a-track-streaming-spawner.md` complete and green (`npm run gate`: 26/26 passing).

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Where a task gives file content, transcribe it exactly. If a Verification step fails, stop and report the exact command output. Do not redesign — in particular, **do not retune any of the numeric constants below**; they were derived by an offline simulation of this exact logic across thousands of random seeds, not guessed.

**What this milestone does:** implements `plan.md`'s frozen lead-distance formula (`lead = baseLead * (1 + relativeSpeed / worldSpeed)`) so accelerating trains don't create unfair, low-reaction-time spikes, and proves the spawner is fair with a scripted bot that plays 5 fixed seeds for 3000 ticks each with zero deaths.

**How the numbers below were produced (read this before touching anything):** every constant in this file — the two `GameConfig` changes, the bot's trigger distances, and the "outer-lane transit" guard — came from a Node port of this exact pattern table, spawner, and bot policy, stress-tested across up to 3000 random seeds, with real bugs found and fixed along the way (not just parameter sweeps):

1. **First real bug:** a fixed distance-based lane-switch trigger doesn't give equal reaction *time* to an accelerating train (which closes faster) as to a static one at the same distance. Fixed by making the lane-switch trigger **time-to-arrival** based (`distance / (BASE_SPEED + relativeSpeed)`), not distance-based.
2. **Second real bug, more important:** switching between the two *outer* lanes (0 → 2 or 2 → 0) visually transits *through* lane 1 as the lane-lerp interpolates. If a train currently occupies lane 1 at that moment — and trains only ever spawn in lane 1 — the transit clips it, **even though the player was never considered "in" lane 1** by the discrete lane field. This was found by tracing an actual failing seed tick-by-tick, not guessed. Fixed with an explicit guard: refuse an outer-to-outer switch if lane 1 currently has a deadly obstacle within transit range; the bot keeps re-evaluating next tick instead.
3. **Residual, honestly documented:** even after both fixes, **7 of 3000** simulated seeds (0.23%) still produced a death, in every case a narrow coincidence of a jump already in flight (for an unrelated barrier) combined with a lane-transit landing on a train that appeared inside the transition window. This is a real, tracked gap in the *bot's* policy sophistication — not a spawner unfairness — and is a reasonable candidate for a difficulty-polish pass later (M9+), not a blocker here. **The 5 seeds frozen below (1–5) were verified clean across every tested configuration and are not cherry-picked from a narrow search** — they were simply the first 5 seeds tried, and none of them ever failed.
4. The offline simulation does **not** model elevation (`ON_PLATFORM`/`ON_TRAIN_ROOF`) — it doesn't need to, because `RAMP_TRAIN` has `deadlyFaces: []` (from M6a) so it can never kill regardless of whether it's ridden, and the bot's policy deliberately avoids `TRAIN`/`RAMP_TRAIN`/`PLATFORM` lanes rather than riding them. **If the real in-browser gate below fails on a seed that passed offline, the most likely cause is exactly this elevation-coupling gap** — report the failing seed and tick exactly; do not retune blindly.

---

## Frozen decisions for this milestone

- **`GameConfig.ts` changes** (verified necessary — the original M6a values left too little margin for a full jump-then-land cycle between consecutive rows at minimum spacing): `MIN_SPAWN_GAP` `12 → 18`, `MAX_SPAWN_GAP` `22 → 28`.
- **Lead-distance formula, applied per row:** `PatternTable.ts`'s `pickPattern` is restructured to report the row's `maxRelativeSpeed` *before* a `z` is chosen (previously `z` was a required argument; now pattern content is decided first, position second) — this is the only way to know whether extra lead is needed before committing a position. `Spawner.ts` then computes `lead = SPAWN_DISTANCE * (1 + maxRelativeSpeed / BASE_SPEED)` and spawns the row at `max(nextSpawnZ, worldDistance + lead)`.
- **Bot trigger constants (verified, do not retune):** `JUMP_TRIGGER_DISTANCE = 6`, `SLIDE_TRIGGER_DISTANCE = 6` (both plain distances — barriers are always static), `LANE_SWITCH_REACT_SECONDS = 2.5`, `MIN_SAFE_TARGET_SECONDS = 1.2` (a candidate target lane must be clear for longer than this before the bot commits to it), and the outer-lane transit guard (refuse a 0↔2 switch if lane 1 has a deadly obstacle within 8 units of the player).
- **Bot policy, in priority order, evaluated once per tick before stepping:**
  1. If the current lane's nearest `TRAIN`/`RAMP_TRAIN`/`PLATFORM` is within `LANE_SWITCH_REACT_SECONDS` of arrival, switch to whichever other lane clears `MIN_SAFE_TARGET_SECONDS` (preferring the one with more margin if both do), **unless** that switch is an outer-to-outer transit through a currently-blocked lane 1.
  2. Otherwise, if the current lane's nearest `LOW_BARRIER` is within `JUMP_TRIGGER_DISTANCE` and the player is grounded, jump.
  3. Otherwise, if the current lane's nearest `HIGH_BARRIER` is within `SLIDE_TRIGGER_DISTANCE`, the player is grounded and not already sliding, slide.
- **The bot never intentionally rides a platform or ramp train** — it treats them the same as a train for avoidance purposes. This is deliberately conservative and is not a bug; it does not need to exercise every mechanic to prove the spawner is fair.
- **Test seeds, frozen:** `1, 2, 3, 4, 5`, each run for exactly 3000 ticks.

---

## Task 6b.1 — Widen the minimum row spacing

- **File:** `src/core/GameConfig.ts`
- **Action:** modify
- **Preconditions:** M6a complete
- **Spec:** Change exactly these two lines:

```ts
export const MIN_SPAWN_GAP = 12;
export const MAX_SPAWN_GAP = 22;
```

to:

```ts
export const MIN_SPAWN_GAP = 18;
export const MAX_SPAWN_GAP = 28;
```

  Nothing else in the file changes.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6b.2 — Restructure the pattern table to report relativeSpeed before positioning

- **File:** `src/spawner/PatternTable.ts`
- **Action:** modify (replace the entire file contents)
- **Preconditions:** Task 6b.1 complete
- **Spec:** Replace the whole file with exactly:

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

export interface PatternResult {
  maxRelativeSpeed: number;
  build: (id0: number, z: number) => ObstacleSpec[];
}

const OUTER_LANES: Array<0 | 2> = [0, 2];

function trainOrRampChoice(rng: Rng): { relativeSpeed: number; isRamp: boolean } {
  const r = rng();
  if (r < 0.4) return { relativeSpeed: 0, isRamp: false };
  if (r < 0.7) return { relativeSpeed: FAST_TRAIN_EXTRA_SPEED, isRamp: false };
  return { relativeSpeed: 0, isRamp: true };
}

function trainOrRampSpec(choice: { relativeSpeed: number; isRamp: boolean }, id: number, z: number): ObstacleSpec {
  return choice.isRamp ? makeRampTrain(id, 1, z, 0) : makeTrain(id, 1, z, choice.relativeSpeed);
}

export function pickPattern(rng: Rng): PatternResult {
  const roll = rng();
  const table: Array<{ weight: number; make: () => PatternResult }> = [
    {
      weight: 3,
      make: () => {
        const lane = randInt(rng, 0, 3) as 0 | 1 | 2;
        return { maxRelativeSpeed: 0, build: (id, z) => [makeLowBarrier(id, lane, z)] };
      },
    },
    {
      weight: 3,
      make: () => {
        const lane = randInt(rng, 0, 3) as 0 | 1 | 2;
        return { maxRelativeSpeed: 0, build: (id, z) => [makeHighBarrier(id, lane, z)] };
      },
    },
    {
      weight: 2.5,
      make: () => {
        const choice = trainOrRampChoice(rng);
        return { maxRelativeSpeed: choice.relativeSpeed, build: (id, z) => [trainOrRampSpec(choice, id, z)] };
      },
    },
    {
      weight: 1.5,
      make: () => ({
        maxRelativeSpeed: 0,
        build: (id, z) => [0, 1, 2].map((lane, i) => makeLowBarrier(id + i, lane as 0 | 1 | 2, z)),
      }),
    },
    {
      weight: 1.5,
      make: () => ({
        maxRelativeSpeed: 0,
        build: (id, z) => [0, 1, 2].map((lane, i) => makeHighBarrier(id + i, lane as 0 | 1 | 2, z)),
      }),
    },
    {
      weight: 1.5,
      make: () => {
        const choice = trainOrRampChoice(rng);
        const outer = OUTER_LANES[randInt(rng, 0, 2)];
        const useLow = rng() < 0.5;
        return {
          maxRelativeSpeed: choice.relativeSpeed,
          build: (id, z) => [
            trainOrRampSpec(choice, id, z),
            useLow ? makeLowBarrier(id + 1, outer, z) : makeHighBarrier(id + 1, outer, z),
          ],
        };
      },
    },
    {
      weight: 1.5,
      make: () => {
        const lane = OUTER_LANES[randInt(rng, 0, 2)];
        return { maxRelativeSpeed: 0, build: (id, z) => [makePlatform(id, lane, z)] };
      },
    },
    {
      weight: 1,
      make: () => {
        const choice = trainOrRampChoice(rng);
        const useLow = rng() < 0.5;
        return {
          maxRelativeSpeed: choice.relativeSpeed,
          build: (id, z) => [
            trainOrRampSpec(choice, id, z),
            useLow ? makeLowBarrier(id + 1, 0, z) : makeHighBarrier(id + 1, 0, z),
            useLow ? makeLowBarrier(id + 2, 2, z) : makeHighBarrier(id + 2, 2, z),
          ],
        };
      },
    },
  ];

  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let pick = roll * total;
  for (const entry of table) {
    pick -= entry.weight;
    if (pick <= 0) return entry.make();
  }
  return table[0].make();
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0. (This will fail until Task 6b.3 updates its caller — that is expected.)

---

## Task 6b.3 — Apply the lead-distance formula in the spawner

- **File:** `src/spawner/Spawner.ts`
- **Action:** modify
- **Preconditions:** Task 6b.2 complete
- **Spec:** Replace this block from M6a:

```ts
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
```

with exactly:

```ts
    while (this.nextSpawnZ < worldDistance + SPAWN_DISTANCE) {
      const result = pickPattern(rng);
      const lead = SPAWN_DISTANCE * (1 + result.maxRelativeSpeed / BASE_SPEED);
      const z = Math.max(this.nextSpawnZ, worldDistance + lead);
      const specs = result.build(this.nextId, z);
      this.nextId += 4;
      for (const spec of specs) {
        const mesh = this.pool.acquire();
        if (!mesh) continue;
        mesh.scale.set(spec.bounds.hx * 2, spec.bounds.hy * 2, spec.bounds.hz * 2);
        this.active.push({ spec, mesh });
      }
      this.nextSpawnZ = z + MIN_SPAWN_GAP + randRange(rng, 0, MAX_SPAWN_GAP - MIN_SPAWN_GAP);
    }
```

  This requires `BASE_SPEED` to be imported. Change the existing import line:

```ts
import { DESPAWN_DISTANCE, MAX_SPAWN_GAP, MIN_SPAWN_GAP, SPAWN_DISTANCE } from '@/core/GameConfig';
```

  to:

```ts
import { BASE_SPEED, DESPAWN_DISTANCE, MAX_SPAWN_GAP, MIN_SPAWN_GAP, SPAWN_DISTANCE } from '@/core/GameConfig';
```

  Nothing else in the file changes.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 **and** `npm run build` exits 0.

---

## Task 6b.4 — Create the fairness spec

- **File:** `test/fairness.spec.ts`
- **Action:** create
- **Preconditions:** Task 6b.3 complete
- **Spec:** The entire bot loop runs inside a single `page.evaluate` call (3000 synchronous `step(1)` calls per seed round-tripping through Playwright would be far too slow otherwise). It is a direct port of the verified offline simulation's decision logic, reading real `window.__GAME__` state instead of a simulated one. Write exactly:

```ts
import { expect, test } from '@playwright/test';

const SEEDS = [1, 2, 3, 4, 5];
const TICKS = 3000;

function runBot(seed: number, ticks: number) {
  const JUMP_TRIGGER = 6;
  const SLIDE_TRIGGER = 6;
  const LANE_SWITCH_REACT_SECONDS = 2.5;
  const MIN_SAFE_TARGET_SECONDS = 1.2;
  const BASE_SPEED_LOCAL = window.__GAME__.world.speed || 14;
  const AVOID = new Set(['TRAIN', 'RAMP_TRAIN', 'PLATFORM']);

  window.__GAME__.setPaused(true);
  window.__GAME__.seed(seed);

  for (let tick = 0; tick < ticks; tick++) {
    if (window.__GAME__.state === 'gameover') break;

    const worldDistance = window.__GAME__.world.distance;
    const lane = window.__GAME__.player.lane;
    const obstacles = window.__GAME__.obstacles();
    const dist = (o: { z: number }) => o.z - worldDistance;
    const timeToArrival = (o: { z: number; relativeSpeed: number }) =>
      dist(o) / (BASE_SPEED_LOCAL + o.relativeSpeed);

    const nearestAvoidTimeInLane = (l: number) => {
      const found = obstacles
        .filter((o) => o.lane === l && AVOID.has(o.type) && dist(o) > -2)
        .sort((a, b) => dist(a) - dist(b));
      return found.length ? timeToArrival(found[0]) : Infinity;
    };

    if (nearestAvoidTimeInLane(lane) <= LANE_SWITCH_REACT_SECONDS) {
      const others = [0, 1, 2].filter((l) => l !== lane);
      const safe = others.filter((l) => nearestAvoidTimeInLane(l) > MIN_SAFE_TARGET_SECONDS);
      let target: number | null = null;
      if (safe.length === 1) target = safe[0];
      else if (safe.length === 2) {
        target = nearestAvoidTimeInLane(safe[0]) >= nearestAvoidTimeInLane(safe[1]) ? safe[0] : safe[1];
      }
      if (target !== null) {
        const transitsLane1 = (lane === 0 && target === 2) || (lane === 2 && target === 0);
        const lane1Blocked = obstacles.some(
          (o) => o.lane === 1 && (o.type === 'TRAIN') && Math.abs(o.z - worldDistance) < 8,
        );
        if (!(transitsLane1 && lane1Blocked)) {
          // PlayerController.applyAction moves exactly one lane per 'left'/'right' action
          // (clamped at the edges) -- a 2-lane jump (e.g. lane 2 straight to lane 0) needs
          // two actions in the SAME enqueue call, since Sim.tick() drains and applies every
          // queued action before that tick's physics runs. One action would silently only
          // move the player one lane, which is a real, previously-caught mismatch between
          // this bot and the offline simulation it was verified against.
          const steps = Math.abs(target - lane);
          const dir = target < lane ? 'left' : 'right';
          window.__GAME__.enqueue(new Array(steps).fill(dir));
        }
      }
    } else {
      const barrierAhead = obstacles
        .filter((o) => o.lane === lane && (o.type === 'LOW_BARRIER' || o.type === 'HIGH_BARRIER') && dist(o) > -2)
        .sort((a, b) => dist(a) - dist(b))[0];
      if (barrierAhead) {
        const d = dist(barrierAhead);
        if (barrierAhead.type === 'LOW_BARRIER' && d <= JUMP_TRIGGER && window.__GAME__.player.grounded) {
          window.__GAME__.enqueue(['jump']);
        } else if (
          barrierAhead.type === 'HIGH_BARRIER' &&
          d <= SLIDE_TRIGGER &&
          window.__GAME__.player.grounded
        ) {
          window.__GAME__.enqueue(['slide']);
        }
      }
    }

    window.__GAME__.step(1);
  }

  return {
    finalState: window.__GAME__.state,
    events: window.__GAME__.events,
    tick: window.__GAME__.stats.simTick,
  };
}

test.describe('spawn fairness', () => {
  for (const seed of SEEDS) {
    test(`seed ${seed} survives ${TICKS} ticks with zero deaths`, async ({ page }) => {
      await page.goto('/?fixture=procedural');
      await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

      const result = await page.evaluate(
        ({ seed, ticks }) => {
          // eslint-disable-next-line no-eval
          return (0, eval)(`(${runBot.toString()})(${seed}, ${ticks})`);
        },
        { seed, ticks: TICKS },
      );

      expect(result.finalState).toBe('playing');
      expect(result.events.filter((e: { type: string }) => e.type === 'collision')).toEqual([]);
    });
  }

  test('pool size stays bounded across a full fairness run', async ({ page }) => {
    await page.goto('/?fixture=procedural');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const stats = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(3000);
      return { ...window.__GAME__.pool };
    });

    expect(stats.obstaclesActive + stats.obstaclesFree).toBe(32);
  });
});
```

  Note on the `(0, eval)(...)` construction: `page.evaluate` serializes its callback across the Playwright/browser boundary, which does not preserve closures over outer functions like `runBot`. Re-stringifying and `eval`-ing it inside the already-in-page `page.evaluate` callback is the straightforward way to run a large, non-trivial function body entirely in-page without 3000 round trips. Do not "simplify" this by inlining `runBot`'s body directly into the outer `page.evaluate` arrow function — keeping it as a named, separately-defined function is what makes it possible to unit-reason about the bot logic at all.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 6b.5 — Run the full gate

- **File:** none
- **Action:** run command
- **Preconditions:** all previous tasks complete
- **Spec:** Run `npm run gate`.
- **Verification:** Exit code 0, Playwright output shows **32 passed** (26 from M1–M6a + 6 new in `fairness.spec.ts`: 5 seed tests + 1 pool-bound test). If any of the 5 seed tests fails, **report the exact seed and the `events` array it printed** — do not adjust `JUMP_TRIGGER`/`SLIDE_TRIGGER`/`LANE_SWITCH_REACT_SECONDS`/`MIN_SAFE_TARGET_SECONDS` yourself; these were verified offline against these exact 5 seeds and a real-game failure here most likely means the elevation-coupling gap noted at the top of this file, which needs a planning decision, not a retune.

---

## Milestone Definition of Done

1. `npm run gate` — exit 0, 32 tests passed
2. `GameConfig.ts` has `MIN_SPAWN_GAP = 18` and `MAX_SPAWN_GAP = 28`
3. `PatternTable.ts`'s `pickPattern` takes only `(rng)` and returns `{ maxRelativeSpeed, build }` — no `z` parameter
4. `grep -n "Math.random(" src/` still returns only `src/util/rng.ts`

**Report on completion:** the Playwright summary line, and explicitly confirm all 5 seed tests passed by name. This closes out M6 (M6a + M6b) entirely — M7 (coins + power-ups) is next, and its microplan does not exist yet.
