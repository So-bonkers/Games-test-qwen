import * as THREE from 'three';
import { DESPAWN_DISTANCE, MAX_SPAWN_GAP, MIN_SPAWN_GAP, SPAWN_DISTANCE } from '@/core/GameConfig';
import { ObjectPool } from '@/systems/ObjectPool';
import { pickPattern } from '@/spawner/PatternTable';
import type { ObstacleSpec } from '@/contracts/obstacle';
import { randRange, type Rng } from '@/util/rng';

const MESH_POOL_SIZE = 32;

interface ActiveEntry {
  spec: ObstacleSpec;
  mesh: THREE.Mesh;
}

export class Spawner {
  private readonly pool: ObjectPool<THREE.Mesh>;
  private readonly active: ActiveEntry[] = [];
  private nextSpawnZ = SPAWN_DISTANCE;
  private nextId = 1;

  constructor(scene: THREE.Scene) {
    this.pool = new ObjectPool(
      () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x996633 })),
      MESH_POOL_SIZE,
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

    while (this.nextSpawnZ < worldDistance + SPAWN_DISTANCE) {
      const specs = pickPattern(rng, this.nextId, this.nextSpawnZ);
      this.nextId += 4;
      for (const spec of specs) {
        const mesh = this.pool.acquire();
        if (!mesh) continue;
        mesh.scale.set(spec.bounds.hx * 2, spec.bounds.hy * 2, spec.bounds.hz * 2);
        this.active.push({ spec, mesh });
      }
      this.nextSpawnZ += MIN_SPAWN_GAP + randRange(rng, 0, MAX_SPAWN_GAP - MIN_SPAWN_GAP);
    }
  }

  activeObstacles(): ObstacleSpec[] {
    return this.active.map((e) => e.spec);
  }

  get poolStats(): { active: number; free: number } {
    return { active: this.pool.activeCount, free: this.pool.size - this.pool.activeCount };
  }
}
