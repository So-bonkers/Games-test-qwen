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
