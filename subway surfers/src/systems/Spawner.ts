import * as THREE from 'three';
import { ObstacleType, Lane, RideTarget } from '@/types';
import {
  LANE_POSITIONS,
  SPAWN_DISTANCE,
  DESPAWN_DISTANCE,
  MIN_SPAWN_GAP,
  MAX_SPAWN_GAP,
  PLATFORM_HEIGHT,
  TRAIN_LENGTH,
  RAMP_LENGTH,
  TUNNEL_MIN_GAP,
  TUNNEL_MAX_GAP,
} from '@/core/GameConfig';
import { ObjectPool } from './ObjectPool';
import { Obstacle, TrainVariant } from '@/entities/Obstacle';
import { Coin } from '@/entities/Coin';
import { Tunnel } from '@/entities/Tunnel';
import { PlatformSection } from '@/entities/PlatformSection';

// ─── Pool sizing ───────────────────────────────────────────────
const OBSTACLE_POOL_PER_TYPE = 8;
const TRAIN_POOL_PER_VARIANT = 6;
const COIN_POOL_SIZE = 96;
const TUNNEL_POOL_SIZE = 3;

/** One obstacle placement inside a row (lane + type + train variant). */
interface PlacedObstacle {
  type: ObstacleType;
  lane: Lane;
  variant?: TrainVariant;
}

/**
 * Spawner — Phase 4: procedural infinite track content.
 *
 * World model:
 *  - CENTER lane (X=0)  → the railway track: trains, barriers, coins
 *  - OUTER lanes (±3)   → elevated PLATFORMS at PLATFORM_HEIGHT:
 *                         barriers and coins sit on top of them
 *
 * Features:
 *  - Pooled + recycled obstacles/coins/tunnels (no GC churn)
 *  - Solvability guarantee: every row leaves a passable route
 *  - Train variants: normal, FAST (express — scrolls faster), RAMP
 *    (run across the top via the front ramp)
 *  - Tunnels: full-width gates as landmarks on their own cadence
 *  - Coins reward the intended solution: runs in clear lanes, arcs over
 *    low barriers, low lines under high barriers
 */
export class Spawner {
  private readonly group: THREE.Group;
  private readonly lowPool: ObjectPool<Obstacle>;
  private readonly highPool: ObjectPool<Obstacle>;
  private readonly trainPools: Record<TrainVariant, ObjectPool<Obstacle>>;
  private readonly coinPool: ObjectPool<Coin>;
  private readonly tunnelPool: ObjectPool<Tunnel>;
  private readonly platformPool: ObjectPool<PlatformSection>;

  private activeObstacles: Obstacle[] = [];
  private activeCoins: Coin[] = [];
  private activeTunnels: Tunnel[] = [];
  private activePlatforms: PlatformSection[] = [];

  /** Z position where the next obstacle row will be generated. */
  private nextSpawnZ = 60;
  /** Z position of the next tunnel gate. */
  private nextTunnelZ = 90;
  /** Front edge (z) of the next platform section. Always spawned ~40u
   *  AHEAD of obstacle rows so placement heights are final when rows spawn. */
  private nextPlatformFront = 50;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'Spawner';
    scene.add(this.group);

    // One pool per obstacle kind (geometry is fixed per instance)
    this.lowPool = new ObjectPool(
      () => new Obstacle(ObstacleType.LowBarrier),
      OBSTACLE_POOL_PER_TYPE,
      this.group,
    );
    this.highPool = new ObjectPool(
      () => new Obstacle(ObstacleType.HighBarrier),
      OBSTACLE_POOL_PER_TYPE,
      this.group,
    );
    this.trainPools = {
      normal: new ObjectPool(() => new Obstacle(ObstacleType.FullBlock, 'normal'), TRAIN_POOL_PER_VARIANT, this.group),
      fast: new ObjectPool(() => new Obstacle(ObstacleType.FullBlock, 'fast'), TRAIN_POOL_PER_VARIANT, this.group),
      ramp: new ObjectPool(() => new Obstacle(ObstacleType.FullBlock, 'ramp'), TRAIN_POOL_PER_VARIANT, this.group),
    };

    this.coinPool = new ObjectPool(() => new Coin(), COIN_POOL_SIZE, this.group);
    this.tunnelPool = new ObjectPool(() => new Tunnel(), TUNNEL_POOL_SIZE, this.group);
    this.platformPool = new ObjectPool(() => new PlatformSection(), 4, this.group);
  }

  // ── Per-frame update (called by Game.update) ─────────────────
  public update(delta: number, worldSpeed: number): void {
    const dz = worldSpeed * delta;

    // ── Scroll + recycle obstacles (fast trains move extra) ────
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const o = this.activeObstacles[i];
      o.position.z -= dz + o.extraSpeed * delta;
      if (o.position.z < -DESPAWN_DISTANCE) {
        o.homePool?.release(o);
        this.activeObstacles.splice(i, 1);
      }
    }

    // ── Scroll + recycle coins (with spin) ─────────────────────
    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const c = this.activeCoins[i];
      c.position.z -= dz;
      c.update(delta);
      if (c.position.z < -DESPAWN_DISTANCE) {
        this.coinPool.release(c);
        this.activeCoins.splice(i, 1);
      }
    }

    // ── Scroll + recycle tunnels ───────────────────────────────
    for (let i = this.activeTunnels.length - 1; i >= 0; i--) {
      const t = this.activeTunnels[i];
      t.position.z -= dz;
      if (t.position.z < -DESPAWN_DISTANCE) {
        this.tunnelPool.release(t);
        this.activeTunnels.splice(i, 1);
      }
    }

    // ── Scroll + recycle platform sections ─────────────────────
    for (let i = this.activePlatforms.length - 1; i >= 0; i--) {
      const p = this.activePlatforms[i];
      p.position.z -= dz;
      if (p.rearZ < -DESPAWN_DISTANCE) {
        this.platformPool.release(p);
        this.activePlatforms.splice(i, 1);
      }
    }

    // ── Platform sections on their own cadence (limited stretches
    //    of elevated outer lanes separated by flat ground gaps) ───
    // Spawned ~40u ahead of obstacle rows so row placement can query
    // the final platform coverage.
    while (this.nextPlatformFront < SPAWN_DISTANCE + 40) {
      const len = 25 + Math.random() * 20; // 25–45 unit decks
      const section = this.platformPool.acquire();
      if (section) {
        section.setLength(len);
        section.position.set(0, 0, this.nextPlatformFront + len / 2);
        this.activePlatforms.push(section);
      }
      const gap = 30 + Math.random() * 30; // flat stretch between decks
      this.nextPlatformFront += len + gap;
    }

    // ── Generate new rows while the frontier is within range ───
    while (this.nextSpawnZ < SPAWN_DISTANCE) {
      this.spawnRow(this.nextSpawnZ);
      const gap = MIN_SPAWN_GAP + Math.random() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
      this.nextSpawnZ += gap;
    }

    // ── Tunnels on their own landmark cadence ──────────────────
    while (this.nextTunnelZ < SPAWN_DISTANCE) {
      const tunnel = this.tunnelPool.acquire();
      if (tunnel) {
        tunnel.position.set(0, 0, this.nextTunnelZ);
        this.activeTunnels.push(tunnel);
      }
      this.nextTunnelZ += TUNNEL_MIN_GAP + Math.random() * (TUNNEL_MAX_GAP - TUNNEL_MIN_GAP);
    }
  }

  /** Clear everything and rewind the spawn frontiers (used on restart). */
  public reset(): void {
    for (const o of this.activeObstacles) o.homePool?.release(o);
    this.activeObstacles.length = 0;
    for (const c of this.activeCoins) this.coinPool.release(c);
    this.activeCoins.length = 0;
    for (const t of this.activeTunnels) this.tunnelPool.release(t);
    this.activeTunnels.length = 0;
    for (const p of this.activePlatforms) this.platformPool.release(p);
    this.activePlatforms.length = 0;
    this.nextSpawnZ = 60;
    this.nextTunnelZ = 90;
    this.nextPlatformFront = 50;
  }

  // ── Pattern generation ────────────────────────────────────────
  /**
   * Generate one obstacle row at `z` plus its coin rewards.
   * World rules:
   *  - Trains only in the CENTER lane (they run on rails)
   *  - Barriers may be in any lane; outer-lane ones sit on platforms
   * Every pattern is solvable by construction:
   *  - single barrier / train      → at least one lane free
   *  - "wall" (all 3 lanes)        → ONE jump (low) or slide (high) clears all
   *  - train + outer barrier mix   → the other platform is clear
   *  - gauntlet                    → both platforms have the SAME clearable
   *                                  barrier type, so one jump/slide works
   */
  private spawnRow(z: number): void {
    const row = this.pickPattern();

    for (const placed of row) {
      const obstacle = this.acquireObstacle(placed.type, placed.variant ?? 'normal');
      if (!obstacle) continue; // pool exhausted — skip gracefully
      const x = LANE_POSITIONS[placed.lane];
      obstacle.position.set(x, this.platformTopAt(x, z), z);
      this.activeObstacles.push(obstacle);
    }

    this.placeCoins(row, z);
  }

  /** Weighted random pick over the solvable pattern table. */
  private pickPattern(): PlacedObstacle[] {
    const outerLanes: Lane[] = [Lane.Left, Lane.Right];
    const randomOuter = (): Lane =>
      outerLanes[Math.floor(Math.random() * outerLanes.length)];

    const trainVariant = (): TrainVariant => {
      const r = Math.random();
      if (r < 0.4) return 'normal';
      if (r < 0.7) return 'fast'; // orange express — moves faster!
      return 'ramp';             // run across the top
    };

    const table: { weight: number; make: () => PlacedObstacle[] }[] = [
      // Common singles — one obstacle, other lanes free
      { weight: 3, make: () => this.single(ObstacleType.LowBarrier) },
      { weight: 3, make: () => this.single(ObstacleType.HighBarrier) },

      // Trains (center lane only) with a random variant
      { weight: 2.5, make: () => [{ type: ObstacleType.FullBlock, lane: Lane.Center, variant: trainVariant() }] },

      // "Walls" — every lane blocked with the SAME clearable type
      { weight: 1.5, make: () => this.wall(ObstacleType.LowBarrier) },
      { weight: 1.5, make: () => this.wall(ObstacleType.HighBarrier) },

      // Train in center + barrier on one platform; other platform clear
      { weight: 1.5, make: () => [
        { type: ObstacleType.FullBlock, lane: Lane.Center, variant: trainVariant() },
        { type: Math.random() < 0.5 ? ObstacleType.LowBarrier : ObstacleType.HighBarrier, lane: randomOuter() },
      ]},

      // Gauntlet — train in center + SAME barrier type on BOTH platforms
      { weight: 1, make: () => {
        const bType = Math.random() < 0.5 ? ObstacleType.LowBarrier : ObstacleType.HighBarrier;
        return [
          { type: ObstacleType.FullBlock, lane: Lane.Center, variant: trainVariant() },
          { type: bType, lane: Lane.Left },
          { type: bType, lane: Lane.Right },
        ];
      }},
    ];

    const total = table.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * total;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) return entry.make();
    }
    return this.single(ObstacleType.LowBarrier); // unreachable fallback
  }

  /** One barrier in a random lane. */
  private single(type: ObstacleType): PlacedObstacle[] {
    const lanes: Lane[] = [Lane.Left, Lane.Center, Lane.Right];
    return [{ type, lane: lanes[Math.floor(Math.random() * lanes.length)] }];
  }

  /** All three lanes with the same clearable type (jump/slide wall). */
  private wall(type: ObstacleType): PlacedObstacle[] {
    const lanes: Lane[] = [Lane.Left, Lane.Center, Lane.Right];
    return lanes.map((lane) => ({ type, lane }));
  }

  // ── Placement helpers ─────────────────────────────────────────
  /**
   * Walkable surface height at a world (x, z) point.
   * Outer lanes are elevated ONLY where a platform section covers the spot;
   * everywhere else (center lane, flat gaps) it's track level (0).
   */
  public platformTopAt(worldX: number, worldZ: number): number {
    if (Math.abs(worldX) < 1.5) return 0; // center lane is always open track
    for (const p of this.activePlatforms) {
      if (worldZ >= p.frontZ && worldZ <= p.rearZ) return PLATFORM_HEIGHT;
    }
    return 0;
  }

  // ── Coin placement (rewards the intended solution) ───────────
  private placeCoins(row: PlacedObstacle[], z: number): void {
    const blocked = new Map<Lane, ObstacleType>();
    for (const placed of row) blocked.set(placed.lane, placed.type);

    for (let lane = 0; lane < LANE_POSITIONS.length; lane++) {
      const x = LANE_POSITIONS[lane];
      const baseY = this.platformTopAt(x, z); // on deck if a section covers this spot
      const type = blocked.get(lane as Lane);

      if (type === undefined) {
        // Clear lane: straight coin run through the row (on platform top if outer)
        this.coinLine(x, z, 5, baseY + 0.75);
      } else if (type === ObstacleType.LowBarrier) {
        // Arc over the barrier — peak ≈ jump apex (v²/2g ≈ 1.84 above ground)
        this.coinArc(x, z, baseY);
      } else if (type === ObstacleType.HighBarrier) {
        // Low line under the bar — collected while sliding
        this.coinLine(x, z, 5, baseY + 0.55);
      }
      // FullBlock: train occupies the lane — no coins there
    }
  }

  /** Straight line of `count` coins centered on `z`, at height `y`. */
  private coinLine(x: number, z: number, count: number, y: number): void {
    const spacing = 1.6;
    for (let i = 0; i < count; i++) {
      this.spawnCoin(x, y, z + (i - (count - 1) / 2) * spacing);
    }
  }

  /** Parabolic arc of coins over a low barrier (baseY = lane ground height). */
  private coinArc(x: number, z: number, baseY: number): void {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1); // 0 → 1 across the arc
      const zz = z - 2.4 + 4.8 * t;
      const y = baseY + 0.75 + Math.sin(t * Math.PI) * 1.15;
      this.spawnCoin(x, y, zz);
    }
  }

  private spawnCoin(x: number, y: number, z: number): void {
    const coin = this.coinPool.acquire();
    if (!coin) return; // pool exhausted — skip gracefully
    coin.position.set(x, y, z);
    this.activeCoins.push(coin);
  }

  private acquireObstacle(type: ObstacleType, variant: TrainVariant): Obstacle | null {
    let pool: ObjectPool<Obstacle>;
    if (type === ObstacleType.LowBarrier) pool = this.lowPool;
    else if (type === ObstacleType.HighBarrier) pool = this.highPool;
    else pool = this.trainPools[variant];

    const obstacle = pool.acquire();
    if (obstacle) obstacle.homePool = pool;
    return obstacle;
  }

  // ── Ride support (ramp trains) ────────────────────────────────
  /**
   * Find a ramp train the player could ride right now (same lane, roof span
   * overlapping the player at Z=0). Returns null when none applies.
   */
  public getRideTarget(playerX: number): RideTarget | null {
    for (const o of this.activeObstacles) {
      if (!o.hasRamp) continue;
      if (Math.abs(o.position.x - playerX) > 1.5) continue;

      const frontZ = o.position.z - (TRAIN_LENGTH / 2 + RAMP_LENGTH);
      const rearZ = o.position.z + TRAIN_LENGTH / 2;
      return {
        x: o.position.x,
        frontZ,
        rearZ,
        roofY: o.roofY,
        rampLength: RAMP_LENGTH,
      };
    }
    return null;
  }

  // ── Debug accessors ───────────────────────────────────────────
  public get activeObstacleCount(): number { return this.activeObstacles.length; }
  public get activeCoinCount(): number { return this.activeCoins.length; }
  public get activeTunnelCount(): number { return this.activeTunnels.length; }
  public get activePlatformCount(): number { return this.activePlatforms.length; }
}
