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
