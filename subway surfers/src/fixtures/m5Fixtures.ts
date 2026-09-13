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
