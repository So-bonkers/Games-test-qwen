export type Elevation = 'GROUND' | 'AIRBORNE' | 'ON_PLATFORM' | 'ON_TRAIN_ROOF';

export interface LandableSurface {
  topY: number;
  zStart: number;
  zEnd: number;
  xCenter: number;
  halfWidth: number;
  kind: 'PLATFORM' | 'TRAIN_ROOF';
  rampZEnd?: number;
  ownerId: number;
}
