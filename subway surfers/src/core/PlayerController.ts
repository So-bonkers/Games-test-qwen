import {
  FAST_FALL_SPEED,
  GRAVITY,
  HOVERBOARD_INVULNERABLE_TICKS,
  JETPACK_HOVER_HEIGHT,
  JUMP_VELOCITY,
  LANE_POSITIONS,
  LERP_SPEED,
  PLAYER_SLIDE_SCALE,
  POWER_UP_DURATION,
  SLIDE_DURATION,
  SNEAKERS_JUMP_MULTIPLIER,
} from '@/core/GameConfig';
import { pushDebugEvent } from '@/core/DebugHook';
import type { Elevation, LandableSurface } from '@/contracts/elevation';
import type { InputAction } from '@/input/InputQueue';
import type { PowerUpType } from '@/contracts/pickup';

export class PlayerController {
  lane: 0 | 1 | 2 = 1;
  x = 0;
  feetY = 0;
  velocityY = 0;
  elevation: Elevation = 'GROUND';
  scaleY = 1;
  magnetTimer = 0;
  sneakersTimer = 0;
  jetpackTimer = 0;
  hoverboardCharges = 0;
  invulnerableTicks = 0;
  private sliding = false;
  private slideTimer = 0;
  private onSurface: LandableSurface | null = null;

  get grounded(): boolean {
    return this.elevation !== 'AIRBORNE';
  }

  get onSurfaceOwnerId(): number | null {
    return this.onSurface?.ownerId ?? null;
  }

  get invulnerable(): boolean {
    return this.jetpackTimer > 0 || this.invulnerableTicks > 0;
  }

  grantPowerUp(type: PowerUpType): void {
    if (type === 'COIN_MAGNET') this.magnetTimer = POWER_UP_DURATION;
    else if (type === 'SUPER_SNEAKERS') this.sneakersTimer = POWER_UP_DURATION;
    else if (type === 'JETPACK') this.jetpackTimer = POWER_UP_DURATION;
    else if (type === 'HOVERBOARD') this.hoverboardCharges++;
  }

  consumeHoverboard(): void {
    this.hoverboardCharges = Math.max(0, this.hoverboardCharges - 1);
    this.invulnerableTicks = HOVERBOARD_INVULNERABLE_TICKS;
  }

  applyAction(action: InputAction): void {
    if (action === 'left') this.lane = Math.max(0, this.lane - 1) as 0 | 1 | 2;
    if (action === 'right') this.lane = Math.min(2, this.lane + 1) as 0 | 1 | 2;

    if (action === 'jump' && this.grounded) {
      const multiplier = this.sneakersTimer > 0 ? SNEAKERS_JUMP_MULTIPLIER : 1;
      this.velocityY = JUMP_VELOCITY * multiplier;
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

    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    if (this.sneakersTimer > 0) this.sneakersTimer = Math.max(0, this.sneakersTimer - dt);
    if (this.jetpackTimer > 0) this.jetpackTimer = Math.max(0, this.jetpackTimer - dt);
    if (this.invulnerableTicks > 0) this.invulnerableTicks--;

    if (this.jetpackTimer > 0) {
      this.feetY = JETPACK_HOVER_HEIGHT;
      this.velocityY = 0;
      this.elevation = 'AIRBORNE';
      this.onSurface = null;
      return;
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
        this.onSurface = null;
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
      }
    }
  }
}
