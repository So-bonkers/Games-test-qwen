import * as THREE from 'three';

// ─── Pose definition ───────────────────────────────────────────
/**
 * A complete set of joint targets for one animation state.
 * All angles are in radians; `hipsY` is the hip height in world units.
 *
 * Sign conventions (character faces +Z, i.e. direction of travel):
 *  - rotation.x positive  → limb swings BACKWARD (−Z)
 *  - rotation.x negative  → limb swings FORWARD (+Z)
 *  - knee/elbow bend      → positive rotation.x (one-way joints)
 */
export interface Pose {
  hipsY: number;
  torsoX: number; // forward lean (negative = lean toward travel direction)
  torsoZ: number; // side tilt
  headX: number;  // pitch

  shLx: number;   // left shoulder swing
  shLz: number;   // left shoulder abduction (out to side)
  elL: number;    // left elbow bend

  shRx: number;   // right shoulder swing
  shRz: number;   // right shoulder abduction
  elR: number;    // right elbow bend

  hipLx: number;  // left hip swing
  hipLz: number;  // left hip abduction
  kneeL: number;  // left knee bend

  hipRx: number;  // right hip swing
  hipRz: number;  // right hip abduction
  kneeR: number;  // right knee bend
}

export const POSE_KEYS = [
  'hipsY', 'torsoX', 'torsoZ', 'headX',
  'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'elR',
  'hipLx', 'hipLz', 'kneeL', 'hipRx', 'hipRz', 'kneeR',
] as const;

/** Standing neutral pose (used as the transition snapshot baseline). */
export const NEUTRAL_POSE: Pose = {
  hipsY: 0.92,
  torsoX: 0, torsoZ: 0, headX: 0,
  shLx: 0, shLz: 0.14, elL: 0.18,
  shRx: 0, shRz: -0.14, elR: 0.18,
  hipLx: 0, hipLz: 0.06, kneeL: 0.1,
  hipRx: 0, hipRz: -0.06, kneeR: 0.1,
};

/** Linear interpolation between two poses (per key). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const key of POSE_KEYS) {
    out[key] = a[key] + (b[key] - a[key]) * t;
  }
  return out;
}

/** Smoothstep easing (0→1, zero first derivative at both ends). */
export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// ─── Palette (Subway-Surfers style) ────────────────────────────
const COLORS = {
  hoodie: 0x2f6fe4, // blue hoodie
  pants: 0x2b3550,  // dark navy jeans
  shoe: 0xf5f7fa,   // white sneakers
  skin: 0xf2c094,   // skin tone
  beanie: 0xffb020, // amber beanie
  pom: 0xf5f7fa,    // white pom-pom
  pack: 0xe8622d,   // burnt-orange backpack
  glove: 0xf5f7fa,  // white gloves
  eye: 0x1f2430,    // dark eyes
};

// ─── PlayerRig ─────────────────────────────────────────────────
/**
 * A stylized low-poly runner (Subway Surfers "Jake"-inspired) built from
 * capsules and spheres with a proper joint hierarchy:
 *
 *   hips → torso → head / shoulders → elbows / backpack
 *        → hip joints → knees → feet
 *
 * Every joint is a THREE.Group placed at the anatomical pivot so rotations
 * swing limbs around the correct axis. The rig exposes `applyPose(pose)`
 * which drives all joints from a single Pose object — that is the only
 * interface the animation layer needs.
 */
export class PlayerRig extends THREE.Group {
  private readonly hips: THREE.Group;
  private readonly torso: THREE.Group;
  private readonly headJoint: THREE.Group;
  private readonly shoulderL: THREE.Group;
  private readonly shoulderR: THREE.Group;
  private readonly elbowL: THREE.Group;
  private readonly elbowR: THREE.Group;
  private readonly hipL: THREE.Group;
  private readonly hipR: THREE.Group;
  private readonly kneeL: THREE.Group;
  private readonly kneeR: THREE.Group;

  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  constructor() {
    super();
    this.name = 'PlayerRig';

    // Shared materials (fewer state changes, consistent look)
    const matHoodie = this.mat(COLORS.hoodie);
    const matPants = this.mat(COLORS.pants);
    const matShoe = this.mat(COLORS.shoe);
    const matSkin = this.mat(COLORS.skin);
    const matBeanie = this.mat(COLORS.beanie);
    const matPack = this.mat(COLORS.pack);
    const matGlove = this.mat(COLORS.glove);

    // ── Hips (root of the skeleton) ────────────────────────────
    this.hips = new THREE.Group();
    this.hips.name = 'hips';
    this.hips.position.y = NEUTRAL_POSE.hipsY;
    this.add(this.hips);

    // Pelvis filler so the hip joint area looks solid
    this.mesh(
      this.sphere(0.16, 20, 14),
      matPants,
      [0, 0.02, 0],
      [1, 0.85, 0.9],
      this.hips,
    );

    // ── Legs (hip joint → knee → foot) ─────────────────────────
    const buildLeg = (side: 1 | -1) => {
      const hipJoint = new THREE.Group();
      hipJoint.position.set(0.115 * side, -0.02, 0);
      this.hips.add(hipJoint);

      // Thigh (capsule hanging from the hip joint)
      this.mesh(this.capsule(0.088, 0.16), matPants, [0, -0.17, 0], undefined, hipJoint);

      const knee = new THREE.Group();
      knee.position.y = -0.35;
      hipJoint.add(knee);

      // Shin
      this.mesh(this.capsule(0.072, 0.14), matPants, [0, -0.15, 0], undefined, knee);

      // Sneaker (extends forward, +Z = travel direction)
      this.mesh(this.box(0.115, 0.085, 0.26), matShoe, [0, -0.315, 0.055], undefined, knee);

      return { hipJoint, knee };
    };

    const left = buildLeg(-1);
    const right = buildLeg(1);
    this.hipL = left.hipJoint;
    this.kneeL = left.knee;
    this.hipR = right.hipJoint;
    this.kneeR = right.knee;

    // ── Torso (child of hips) ──────────────────────────────────
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.06, 0);
    this.hips.add(this.torso);

    // Chest / hoodie body
    this.mesh(this.capsule(0.195, 0.34), matHoodie, [0, 0.3, 0], undefined, this.torso);

    // Hood bunched behind the neck
    this.mesh(this.sphere(0.13, 18, 12), matHoodie, [0, 0.6, -0.14], [1, 0.9, 1], this.torso);

    // Backpack (on the back = −Z, visible to the camera)
    this.mesh(this.box(0.34, 0.44, 0.17), matPack, [0, 0.38, -0.235], undefined, this.torso);
    // Backpack pocket
    this.mesh(this.box(0.22, 0.18, 0.06), matPack, [0, 0.3, -0.345], undefined, this.torso);

    // ── Arms (shoulder → elbow → hand) ─────────────────────────
    const buildArm = (side: 1 | -1) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.27 * side, 0.58, 0);
      this.torso.add(shoulder);

      // Upper arm
      this.mesh(this.capsule(0.075, 0.15), matHoodie, [0, -0.16, 0], undefined, shoulder);

      const elbow = new THREE.Group();
      elbow.position.y = -0.32;
      shoulder.add(elbow);

      // Forearm (sleeve)
      this.mesh(this.capsule(0.062, 0.13), matHoodie, [0, -0.14, 0], undefined, elbow);

      // Gloved hand
      this.mesh(this.sphere(0.075, 16, 12), matGlove, [0, -0.3, 0], undefined, elbow);

      return { shoulder, elbow };
    };

    const armL = buildArm(-1);
    const armR = buildArm(1);
    this.shoulderL = armL.shoulder;
    this.elbowL = armL.elbow;
    this.shoulderR = armR.shoulder;
    this.elbowR = armR.elbow;

    // ── Head (child of torso) ──────────────────────────────────
    this.headJoint = new THREE.Group();
    this.headJoint.position.set(0, 0.66, 0);
    this.torso.add(this.headJoint);

    // Skull
    this.mesh(this.sphere(0.155, 24, 18), matSkin, [0, 0.13, 0], [0.95, 1.05, 0.98], this.headJoint);

    // Beanie dome (upper hemisphere)
    const beanieGeo = new THREE.SphereGeometry(0.168, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.disposables.push(beanieGeo);
    const beanie = new THREE.Mesh(beanieGeo, matBeanie);
    beanie.position.set(0, 0.155, 0);
    this.headJoint.add(beanie);

    // Beanie band
    this.mesh(this.cylinder(0.172, 0.178, 0.07), matBeanie, [0, 0.155, 0], undefined, this.headJoint);

    // Pom-pom
    this.mesh(this.sphere(0.048, 14, 10), matGlove, [0, 0.335, 0], undefined, this.headJoint);

    // Eyes (front of face = +Z)
    const eyeGeo = this.sphere(0.022, 10, 8);
    const matEye = this.mat(COLORS.eye);
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(0.058 * side, 0.145, 0.132);
      this.headJoint.add(eye);
    }

    // Apply the neutral pose so the rig starts in a clean standing shape
    this.applyPose(NEUTRAL_POSE);
  }

  // ── Pose application ─────────────────────────────────────────
  /** Drive every joint from a Pose. Called once per frame by Player. */
  public applyPose(p: Pose): void {
    this.hips.position.y = p.hipsY;

    this.torso.rotation.set(p.torsoX, 0, p.torsoZ);
    this.headJoint.rotation.x = p.headX;

    this.shoulderL.rotation.set(p.shLx, 0, p.shLz);
    this.elbowL.rotation.x = Math.max(-0.35, p.elL);
    this.shoulderR.rotation.set(p.shRx, 0, p.shRz);
    this.elbowR.rotation.x = Math.max(-0.35, p.elR);

    this.hipL.rotation.set(p.hipLx, 0, p.hipLz);
    this.kneeL.rotation.x = Math.max(0, p.kneeL);
    this.hipR.rotation.set(p.hipRx, 0, p.hipRz);
    this.kneeR.rotation.x = Math.max(0, p.kneeR);
  }

  /** Return the rig to the neutral standing pose. */
  public resetPose(): void {
    this.applyPose(NEUTRAL_POSE);
  }

  // ── Resource management ──────────────────────────────────────
  public dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  // ── Geometry/material helpers (tracked for disposal) ─────────
  private mat(color: number): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05 });
    this.disposables.push(m);
    return m;
  }

  private sphere(r: number, w: number, h: number): THREE.SphereGeometry {
    const g = new THREE.SphereGeometry(r, w, h);
    this.disposables.push(g);
    return g;
  }

  private capsule(r: number, len: number): THREE.CapsuleGeometry {
    const g = new THREE.CapsuleGeometry(r, len, 6, 18);
    this.disposables.push(g);
    return g;
  }

  private box(w: number, h: number, d: number): THREE.BoxGeometry {
    const g = new THREE.BoxGeometry(w, h, d);
    this.disposables.push(g);
    return g;
  }

  private cylinder(rt: number, rb: number, h: number): THREE.CylinderGeometry {
    const g = new THREE.CylinderGeometry(rt, rb, h, 20);
    this.disposables.push(g);
    return g;
  }

  private mesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    scale?: [number, number, number],
    parent?: THREE.Object3D,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    (parent ?? this).add(m);
    return m;
  }
}
