import * as THREE from 'three';
import {
  BASE_SPEED,
  DESPAWN_DISTANCE,
  LANE_POSITIONS,
  MAX_SPAWN_GAP,
  MIN_SPAWN_GAP,
  POWERUP_SPAWN_GAP,
  SPAWN_DISTANCE,
} from '@/core/GameConfig';
import { ObjectPool } from '@/systems/ObjectPool';
import { pickPattern } from '@/spawner/PatternTable';
import type { ObstacleSpec, ObstacleType } from '@/contracts/obstacle';
import type { CoinSpec, PowerUpSpec, PowerUpType } from '@/contracts/pickup';
import { randInt, randRange, type Rng } from '@/util/rng';

const MESH_POOL_SIZE = 32;
const COIN_POOL_SIZE = 150;
const POWERUP_POOL_SIZE = 4;

const POWERUP_TYPES: PowerUpType[] = ['COIN_MAGNET', 'SUPER_SNEAKERS', 'JETPACK', 'HOVERBOARD'];
const POWERUP_COLORS: Record<PowerUpType, number> = {
  COIN_MAGNET: 0xff00ff,
  SUPER_SNEAKERS: 0x00ff00,
  JETPACK: 0x00ffff,
  HOVERBOARD: 0xffa500,
};

interface ActiveEntry {
  spec: ObstacleSpec;
  mesh: THREE.Mesh;
}

interface ActiveCoin {
  spec: CoinSpec;
  mesh: THREE.Mesh;
}

interface ActivePowerUp {
  spec: PowerUpSpec;
  mesh: THREE.Mesh;
}

function placeCoinsForRow(id0: number, z: number, specs: ObstacleSpec[]): CoinSpec[] {
  const occupancy = new Map<0 | 1 | 2, ObstacleType>();
  for (const s of specs) occupancy.set(s.lane, s.type);

  const coins: CoinSpec[] = [];
  let id = id0;
  for (const lane of [0, 1, 2] as const) {
    const x = LANE_POSITIONS[lane];
    const type = occupancy.get(lane);
    if (type === 'TRAIN' || type === 'RAMP_TRAIN' || type === 'PLATFORM') continue;

    if (type === 'LOW_BARRIER') {
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        coins.push({ id: id++, x, y: 0.3 + Math.sin(t * Math.PI) * 1.3, z: z + (t - 0.5) * 3 });
      }
    } else if (type === 'HIGH_BARRIER') {
      for (let i = 0; i < 5; i++) {
        coins.push({ id: id++, x, y: 0.55, z: z + (i - 2) * 1.2 });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        coins.push({ id: id++, x, y: 0.75, z: z + (i - 2) * 1.5 });
      }
    }
  }
  return coins;
}

export class Spawner {
  private readonly pool: ObjectPool<THREE.Mesh>;
  private readonly coinPool: ObjectPool<THREE.Mesh>;
  private readonly powerUpPool: ObjectPool<THREE.Mesh>;
  private readonly active: ActiveEntry[] = [];
  private readonly activeCoinEntries: ActiveCoin[] = [];
  private readonly activePowerUpEntries: ActivePowerUp[] = [];
  private nextSpawnZ = SPAWN_DISTANCE;
  private nextPowerUpZ = SPAWN_DISTANCE + POWERUP_SPAWN_GAP / 2;
  private nextId = 1;
  private nextCoinId = 1;
  private nextPowerUpId = 1;

  constructor(scene: THREE.Scene) {
    this.pool = new ObjectPool(
      () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x996633 })),
      MESH_POOL_SIZE,
      scene,
    );
    this.coinPool = new ObjectPool(
      () => new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffd700 })),
      COIN_POOL_SIZE,
      scene,
    );
    this.powerUpPool = new ObjectPool(
      () => new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffffff })),
      POWERUP_POOL_SIZE,
      scene,
    );
  }

  update(dt: number, worldDistance: number, rng: Rng): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      if (entry.spec.relativeSpeed > 0) {
        entry.spec.bounds.z -= entry.spec.relativeSpeed * dt;
        for (const s of entry.spec.landableSurfaces) {
          s.zStart -= entry.spec.relativeSpeed * dt;
          s.zEnd -= entry.spec.relativeSpeed * dt;
          if (s.rampZEnd !== undefined) s.rampZEnd -= entry.spec.relativeSpeed * dt;
        }
      }
      entry.mesh.position.set(entry.spec.bounds.x, entry.spec.bounds.y, entry.spec.bounds.z - worldDistance);
      if (entry.spec.bounds.z < worldDistance - DESPAWN_DISTANCE) {
        this.pool.release(entry.mesh);
        this.active.splice(i, 1);
      }
    }

    for (let i = this.activeCoinEntries.length - 1; i >= 0; i--) {
      const entry = this.activeCoinEntries[i];
      entry.mesh.position.set(entry.spec.x, entry.spec.y, entry.spec.z - worldDistance);
      if (entry.spec.z < worldDistance - DESPAWN_DISTANCE) {
        this.coinPool.release(entry.mesh);
        this.activeCoinEntries.splice(i, 1);
      }
    }

    for (let i = this.activePowerUpEntries.length - 1; i >= 0; i--) {
      const entry = this.activePowerUpEntries[i];
      entry.mesh.position.set(entry.spec.x, entry.spec.y, entry.spec.z - worldDistance);
      if (entry.spec.z < worldDistance - DESPAWN_DISTANCE) {
        this.powerUpPool.release(entry.mesh);
        this.activePowerUpEntries.splice(i, 1);
      }
    }

    while (this.nextSpawnZ < worldDistance + SPAWN_DISTANCE) {
      const result = pickPattern(rng);
      const lead = SPAWN_DISTANCE * (1 + result.maxRelativeSpeed / BASE_SPEED);
      const z = Math.max(this.nextSpawnZ, worldDistance + lead);
      const specs = result.build(this.nextId, z);
      this.nextId += 4;
      for (const spec of specs) {
        const mesh = this.pool.acquire();
        if (!mesh) continue;
        mesh.scale.set(spec.bounds.hx * 2, spec.bounds.hy * 2, spec.bounds.hz * 2);
        this.active.push({ spec, mesh });
      }

      const coinSpecs = placeCoinsForRow(this.nextCoinId, z, specs);
      this.nextCoinId += 15;
      for (const spec of coinSpecs) {
        const mesh = this.coinPool.acquire();
        if (!mesh) continue;
        this.activeCoinEntries.push({ spec, mesh });
      }

      this.nextSpawnZ = z + MIN_SPAWN_GAP + randRange(rng, 0, MAX_SPAWN_GAP - MIN_SPAWN_GAP);
    }

    while (this.nextPowerUpZ < worldDistance + SPAWN_DISTANCE) {
      const type = POWERUP_TYPES[randInt(rng, 0, POWERUP_TYPES.length)];
      const lane = randInt(rng, 0, 3) as 0 | 1 | 2;
      const spec: PowerUpSpec = {
        id: this.nextPowerUpId++,
        type,
        x: LANE_POSITIONS[lane],
        y: 1.0,
        z: this.nextPowerUpZ,
      };
      const mesh = this.powerUpPool.acquire();
      if (mesh) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(POWERUP_COLORS[type]);
        this.activePowerUpEntries.push({ spec, mesh });
      }
      this.nextPowerUpZ += POWERUP_SPAWN_GAP;
    }
  }

  activeObstacles(): ObstacleSpec[] {
    return this.active.map((e) => e.spec);
  }

  activeCoins(): CoinSpec[] {
    return this.activeCoinEntries.map((e) => e.spec);
  }

  activePowerUps(): PowerUpSpec[] {
    return this.activePowerUpEntries.map((e) => e.spec);
  }

  releaseCoin(id: number): void {
    const idx = this.activeCoinEntries.findIndex((e) => e.spec.id === id);
    if (idx === -1) return;
    this.coinPool.release(this.activeCoinEntries[idx].mesh);
    this.activeCoinEntries.splice(idx, 1);
  }

  releasePowerUp(id: number): void {
    const idx = this.activePowerUpEntries.findIndex((e) => e.spec.id === id);
    if (idx === -1) return;
    this.powerUpPool.release(this.activePowerUpEntries[idx].mesh);
    this.activePowerUpEntries.splice(idx, 1);
  }

  addTestCoin(x: number, y: number, z: number): void {
    const mesh = this.coinPool.acquire();
    if (!mesh) return;
    this.activeCoinEntries.push({ spec: { id: this.nextCoinId++, x, y, z }, mesh });
  }

  get poolStats(): { active: number; free: number } {
    return { active: this.pool.activeCount, free: this.pool.size - this.pool.activeCount };
  }
}
