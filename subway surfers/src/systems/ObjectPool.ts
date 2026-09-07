import * as THREE from 'three';

/**
 * ObjectPool — pre-allocates a fixed set of scene objects and recycles them
 * instead of creating/destroying every frame. This avoids GC spikes and
 * keeps draw-call setup stable at 60 FPS (Phase 4 requirement).
 *
 * Usage:
 *   const pool = new ObjectPool(() => new Coin(), 96, parentGroup);
 *   const coin = pool.acquire();      // visible=true, ready to place
 *   ...
 *   pool.release(coin);               // hidden again, back in the pool
 */
export class ObjectPool<T extends THREE.Object3D> {
  private readonly pool: T[] = [];
  private readonly active = new Set<T>();

  constructor(
    factory: () => T,
    size: number,
    parent?: THREE.Object3D,
  ) {
    for (let i = 0; i < size; i++) {
      const obj = factory();
      obj.visible = false; // parked until acquired
      if (parent) parent.add(obj);
      this.pool.push(obj);
    }
  }

  /** Take an inactive object from the pool. Returns null when exhausted. */
  public acquire(): T | null {
    for (const obj of this.pool) {
      if (!this.active.has(obj)) {
        this.active.add(obj);
        obj.visible = true;
        return obj;
      }
    }
    return null;
  }

  /** Return an object to the pool (hides it). Safe to call twice. */
  public release(obj: T): void {
    if (!this.active.has(obj)) return;
    this.active.delete(obj);
    obj.visible = false;
  }

  /** Hide everything and clear the active set (used on game reset). */
  public releaseAll(): void {
    for (const obj of this.active) obj.visible = false;
    this.active.clear();
  }

  public forEachActive(fn: (obj: T) => void): void {
    for (const obj of this.active) fn(obj);
  }

  public get activeCount(): number {
    return this.active.size;
  }

  public get size(): number {
    return this.pool.length;
  }
}
