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
