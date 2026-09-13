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
        ({ source, seed, ticks }) => {
          // eslint-disable-next-line no-eval
          return (0, eval)(`(${source})(${seed}, ${ticks})`);
        },
        { source: runBot.toString(), seed, ticks: TICKS },
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
