import * as THREE from 'three';
import { PLATFORM_HEIGHT } from '@/core/GameConfig';

/**
 * PlatformSection — a LIMITED-LENGTH elevated deck spanning the two outer
 * lanes (the center lane stays as open track throughout).
 *
 * The group is centered on its own midpoint (local z=0); `setLength()`
 * scales the slabs and repositions the end trims. Pooled by the Spawner —
 * sections appear in stretches, separated by flat ground gaps.
 */
export class PlatformSection extends THREE.Group {
  public length = 30;

  private readonly scaled: THREE.Mesh[] = [];   // meshes scaled along Z
  private readonly frontTrims: THREE.Mesh[] = [];
  private readonly backTrims: THREE.Mesh[] = [];

  constructor() {
    super();
    this.name = 'PlatformSection';

    const deckMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4d }); // warm wood-brown
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0xd9a521 }); // yellow safety line
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x6b5233 }); // dark underside lip
    const trimMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c }); // bright end trims

    for (const side of [-1, 1]) {
      const x = side * 3; // outer lane centers at ±3

      // Deck slab — unit depth, scaled to length by setLength()
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, PLATFORM_HEIGHT, 1), deckMat);
      deck.position.set(x, PLATFORM_HEIGHT / 2, 0);
      this.add(deck);
      this.scaled.push(deck);

      // Dark underside lip (depth cue)
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1), baseMat);
      base.position.set(x, 0.09, 0);
      this.add(base);
      this.scaled.push(base);

      // Yellow safety line on the inner (track-side) edge
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 1), edgeMat);
      edge.position.set(x - side * 1.15, PLATFORM_HEIGHT + 0.03, 0);
      this.add(edge);
      this.scaled.push(edge);

      // End trims (repositioned by setLength) — the face you must jump over
      const front = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.4, 0.1), trimMat);
      front.position.set(x, PLATFORM_HEIGHT - 0.35, 0);
      this.add(front);
      this.frontTrims.push(front);

      const back = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.4, 0.1), trimMat);
      back.position.set(x, PLATFORM_HEIGHT - 0.35, 0);
      this.add(back);
      this.backTrims.push(back);
    }

    this.setLength(30);
  }

  /** Resize the section (pooled objects get a fresh length each spawn). */
  public setLength(len: number): void {
    this.length = len;
    for (const m of this.scaled) m.scale.z = len;
    const half = len / 2;
    for (const t of this.frontTrims) t.position.z = -half - 0.05;
    for (const t of this.backTrims) t.position.z = half + 0.05;
  }

  public get frontZ(): number { return this.position.z - this.length / 2; }
  public get rearZ(): number { return this.position.z + this.length / 2; }
}
