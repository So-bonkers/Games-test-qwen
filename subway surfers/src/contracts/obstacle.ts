import type { LandableSurface } from '@/contracts/elevation';

export type ObstacleType =
  | 'LOW_BARRIER'
  | 'HIGH_BARRIER'
  | 'FULL_BLOCK'
  | 'PLATFORM'
  | 'TRAIN'
  | 'RAMP_TRAIN';

export interface ObstacleBounds {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

export interface ObstacleSpec {
  id: number;
  type: ObstacleType;
  lane: 0 | 1 | 2;
  relativeSpeed: number;
  bounds: ObstacleBounds;
  landableSurfaces: LandableSurface[];
  deadlyFaces: Array<'FRONT' | 'SIDE' | 'TOP'>;
}
