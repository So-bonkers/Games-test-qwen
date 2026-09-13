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
