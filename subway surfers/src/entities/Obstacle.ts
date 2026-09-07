import * as THREE from 'three';
import { ObstacleType } from '@/types';
import { TRAIN_LENGTH, TRAIN_ROOF_HEIGHT, RAMP_LENGTH, FAST_TRAIN_EXTRA_SPEED } from '@/core/GameConfig';
import type { ObjectPool } from '@/systems/ObjectPool';

/** Train visual/behavior variants. */
export type TrainVariant = 'normal' | 'fast' | 'ramp';

/**
 * Obstacle — a pooled, procedurally built obstacle entity.
 *
 * Types:
 *  - LowBarrier  (red hurdle)        → clear by JUMPING over it
 *  - HighBarrier (blue overhead bar) → clear by SLIDING under it
 *  - FullBlock   (train car)         → clear by switching LANES, or ride
 *                                      a "ramp" variant across the top
 *
 * Train variants:
 *  - normal — standard gray subway car
 *  - fast   — orange express train that moves FASTER than the world scroll
 *  - ramp   — has a sloped ramp at its front so you can run onto the roof
 *
 * The group's origin sits on the ground (y=0) at the obstacle center, so
 * `position` is directly usable for collision math in Phase 5.
 */
export class Obstacle extends THREE.Group {
  public readonly type: ObstacleType;

  // ── Dynamic behavior flags (read by Spawner/Player) ─────────
  /** Extra speed added to world scroll (express trains). */
  public extraSpeed = 0;
  /** True when the roof is rideable (ramp variant). */
  public hasRamp = false;
  /** Ride height on the roof (valid when hasRamp). */
  public roofY = 0;

  /** Pool this instance belongs to (set by the Spawner on acquire). */
  public homePool: ObjectPool<Obstacle> | null = null;

  constructor(type: ObstacleType, variant: TrainVariant = 'normal') {
    super();
    this.type = type;

    switch (type) {
      case ObstacleType.LowBarrier:
        this.buildLowBarrier();
        break;
      case ObstacleType.HighBarrier:
        this.buildHighBarrier();
        break;
      case ObstacleType.FullBlock:
        this.buildFullBlock(variant);
        break;
    }
  }

  // ── Low barrier: red hurdle with white stripe + legs ─────────
  private buildLowBarrier(): void {
    const barMat = new THREE.MeshLambertMaterial({ color: 0xd64541 });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x4a4f57 });

    // Main red crossbar (top at y=0.7 — jumpable)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.45), barMat);
    bar.position.set(0, 0.45, 0);
    this.add(bar);

    // White warning stripe across the bar
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.52, 0.47), stripeMat);
    stripe.position.set(0, 0.45, 0);
    this.add(stripe);

    // Support legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.35), legMat);
      leg.position.set(0.95 * side, 0.25, 0);
      this.add(leg);
    }
  }

  // ── High barrier: blue overhead bar on posts (slide under) ───
  private buildHighBarrier(): void {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a6472 });
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2f6fe4 });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c });

    // Posts (full height)
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 0.22), postMat);
      post.position.set(1.05 * side, 1.0, 0);
      this.add(post);
    }

    // Overhead bar — bottom edge at y=1.4, leaving a ~1.4u gap to slide under
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.5), barMat);
    bar.position.set(0, 1.7, 0);
    this.add(bar);

    // Yellow warning stripe on the bar front (matches track theme)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.14, 0.52), stripeMat);
    stripe.position.set(0, 1.7, 0);
    this.add(stripe);
  }

  // ── Full block: subway train car with optional variants ──────
  private buildFullBlock(variant: TrainVariant): void {
    const bodyColor = variant === 'fast' ? 0xe8722d : 0x7d8aa0; // orange express vs gray
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x3f4756 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0xbfd9e8 });
    const bogieMat = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xd9a521 });

    // Main body (y 0 → 2.3)
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, TRAIN_LENGTH), bodyMat);
    body.position.set(0, 1.15, 0);
    this.add(body);

    // Roof strip
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, TRAIN_LENGTH - 0.4), roofMat);
    roof.position.set(0, 2.42, 0);
    this.add(roof);

    // Windows (both sides)
    for (const side of [-1, 1]) {
      for (const zOff of [-2.6, 2.6]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 1.5), glassMat);
        win.position.set(1.27 * side, 1.55, zOff);
        this.add(win);
      }
    }

    // Wheel bogies underneath
    for (const zOff of [-3, 3]) {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.8), bogieMat);
      bogie.position.set(0, 0.15, zOff);
      this.add(bogie);
    }

    // Yellow warning stripe on the leading face (faces the player)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), stripeMat);
    stripe.position.set(0, 0.9, -(TRAIN_LENGTH / 2 + 0.02));
    this.add(stripe);

    // ── Variant behavior ───────────────────────────────────────
    if (variant === 'fast') {
      this.extraSpeed = FAST_TRAIN_EXTRA_SPEED;
    }

    if (variant === 'ramp') {
      this.hasRamp = true;
      this.roofY = TRAIN_ROOF_HEIGHT;

      // Sloped ramp plank at the front: low end on the ground, high end at roof level
      const rampLen = RAMP_LENGTH;
      const rise = TRAIN_ROOF_HEIGHT;
      const angle = Math.atan2(rise, rampLen);
      const plankLength = Math.hypot(rampLen, rise) + 0.4;

      const rampMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4d }); // wood-brown
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, plankLength), rampMat);
      ramp.rotation.x = angle; // +Z end dips to ground level
      ramp.position.set(
        0,
        rise / 2,
        -(TRAIN_LENGTH / 2 + rampLen / 2),
      );
      this.add(ramp);

      // Yellow edge stripes on the ramp sides (visibility cue)
      const edgeMat = new THREE.MeshLambertMaterial({ color: 0xd9a521 });
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, plankLength), edgeMat);
        edge.rotation.x = angle;
        edge.position.set(1.2 * side, rise / 2, -(TRAIN_LENGTH / 2 + rampLen / 2));
        this.add(edge);
      }
    }
  }
}
