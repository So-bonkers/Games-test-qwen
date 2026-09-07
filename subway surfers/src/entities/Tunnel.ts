import * as THREE from 'three';

/**
 * Tunnel — a full-width tunnel gate / overpass landmark that spans all
 * three lanes (and the platforms). Pure scenery: you run THROUGH it.
 *
 * Built in the brown/yellow theme: warm stone-brown pillars and beam,
 * yellow warning stripe on the face, dark mouth to suggest depth.
 */
export class Tunnel extends THREE.Group {
  constructor() {
    super();

    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4d }); // warm brown stone
    const capMat = new THREE.MeshLambertMaterial({ color: 0x6b5233 });   // darker caps
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xd9a521 }); // yellow warning
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x241a10 });   // dark opening

    // ── Pillars (one per side, outside the platforms) ──────────
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.6, 1.4), stoneMat);
      pillar.position.set(5.6 * side, 1.8, 0);
      this.add(pillar);

      // Cap on top of each pillar
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 1.7), capMat);
      cap.position.set(5.6 * side, 3.75, 0);
      this.add(cap);
    }

    // ── Top beam spanning the full width ───────────────────────
    const beam = new THREE.Mesh(new THREE.BoxGeometry(12.8, 1.0, 1.6), stoneMat);
    beam.position.set(0, 4.3, 0);
    this.add(beam);

    // Dark underside so the opening reads as a tunnel
    const underside = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.2, 1.5), capMat);
    underside.position.set(0, 3.75, 0);
    this.add(underside);

    // ── Dark mouth (depth cue) filling the opening ─────────────
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 3.4), mouthMat);
    mouth.position.set(0, 1.9, 0.55); // slightly behind the beam center
    this.add(mouth);

    // ── Yellow warning stripe on the face (player side = -Z) ───
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.3, 0.06), stripeMat);
    stripe.position.set(0, 4.3, -0.83);
    this.add(stripe);

    // Small yellow hazard blocks at the base of each pillar
    for (const side of [-1, 1]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), stripeMat);
      block.position.set(4.9 * side, 0.25, -0.75);
      this.add(block);
    }
  }
}
