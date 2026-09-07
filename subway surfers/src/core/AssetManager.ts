import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * AssetManager — singleton that handles all 3D model loading.
 * Uses GLTFLoader with Draco compression support for Mixamo exports.
 */
export class AssetManager {
  private static _instance: AssetManager | null = null;
  public static get instance(): AssetManager {
    if (!this._instance) this._instance = new AssetManager();
    return this._instance;
  }

  private loader: GLTFLoader;
  private cache = new Map<string, THREE.Group>();
  private animationsCache = new Map<string, THREE.AnimationClip[]>();
  private loadPromises = new Map<string, Promise<THREE.Group>>();

  constructor() {
    // Draco decoder for compressed Mixamo models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(dracoLoader);
  }

  /**
   * Load a single .glb model and cache it.
   * Subsequent calls with the same path return the cached result immediately.
   */
  public loadModel(path: string): Promise<THREE.Group> {
    // Return cached if already loaded
    if (this.cache.has(path)) {
      return Promise.resolve(this.cache.get(path)!);
    }

    // Return in-flight promise if loading is already underway
    if (this.loadPromises.has(path)) {
      return this.loadPromises.get(path)!;
    }

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          model.name = `asset:${path}`;
          // Optimize: merge geometries if there are many sub-meshes
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = false; // Mobile optimization
              child.receiveShadow = false;
            }
          });
          this.cache.set(path, model);
          const clips = gltf.animations;
          if (clips.length > 0) {
            this.animationsCache.set(path, clips);
          }
          resolve(model);
        },
        undefined,
        (error) => reject(error)
      );
    });

    this.loadPromises.set(path, promise);
    return promise.then((model) => {
      this.loadPromises.delete(path); // Clean up after completion
      return model;
    });
  }

  /**
   * Get cached animations for a loaded model.
   */
  public getAnimations(path: string): THREE.AnimationClip[] | null {
    return this.animationsCache.get(path) ?? null;
  }

  /**
   * Check if a model is already in cache (synchronous check).
   */
  public hasModel(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Clear the entire cache (useful for development resets).
   */
  public clearCache(): void {
    this.cache.clear();
    this.animationsCache.clear();
    this.loadPromises.clear();
  }
}
