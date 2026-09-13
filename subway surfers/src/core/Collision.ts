import * as THREE from 'three';
import { PLAYER_DEPTH, PLAYER_HEIGHT, PLAYER_WIDTH } from '@/core/GameConfig';
import type { ObstacleSpec } from '@/contracts/obstacle';

export function playerBox(x: number, feetY: number, worldZ: number, scaleY: number): THREE.Box3 {
  const halfW = PLAYER_WIDTH / 2;
  const halfD = PLAYER_DEPTH / 2;
  const height = PLAYER_HEIGHT * scaleY;
  return new THREE.Box3(
    new THREE.Vector3(x - halfW, feetY, worldZ - halfD),
    new THREE.Vector3(x + halfW, feetY + height, worldZ + halfD),
  );
}

export function obstacleBox(o: ObstacleSpec): THREE.Box3 {
  const b = o.bounds;
  return new THREE.Box3(
    new THREE.Vector3(b.x - b.hx, b.y - b.hy, b.z - b.hz),
    new THREE.Vector3(b.x + b.hx, b.y + b.hy, b.z + b.hz),
  );
}

export function findFatalCollision(
  pBox: THREE.Box3,
  obstacles: readonly ObstacleSpec[],
  currentSurfaceOwnerId: number | null,
): ObstacleSpec | null {
  for (const o of obstacles) {
    if (o.id === currentSurfaceOwnerId) continue;
    if (o.deadlyFaces.length === 0) continue;
    if (pBox.intersectsBox(obstacleBox(o))) return o;
  }
  return null;
}
