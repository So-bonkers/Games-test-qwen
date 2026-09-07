import * as THREE from 'three';

/**
 * Coin — a pooled, spinning gold coin.
 *
 * Structure: this Group handles world position + the spin (rotation.y),
 * while the inner disc mesh stands upright (rotation.x = π/2) so its face
 * points toward the camera — the classic Subway Surfers coin look.
 */
export class Coin extends THREE.Group {
  private readonly disc: THREE.Mesh;
  private spin = Math.random() * Math.PI * 2; // desync coins from each other

  constructor() {
    super();

    const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf5c518,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x8a6d1a,
      emissiveIntensity: 0.3, // subtle glow so coins pop against the tan track
    });

    this.disc = new THREE.Mesh(geo, mat);
    this.disc.rotation.x = Math.PI / 2; // stand upright, face toward camera
    this.add(this.disc);
  }

  /** Advance the spin animation (called by the Spawner each frame). */
  public update(delta: number): void {
    this.spin += delta * 5;
    this.rotation.y = this.spin;
  }
}
