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
