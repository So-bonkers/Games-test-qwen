import * as THREE from 'three';
import {
  CAMERA_POSITION,
  CAMERA_TARGET,
  CHARACTER_FEET_OFFSET,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  GROUND_COLOR,
  LANE_POSITIONS,
  PLAYER_HEIGHT,
  SKY_COLOR,
} from '@/core/GameConfig';
import { createSkyGradientTexture } from '@/core/SkyGradient';
import type { CharacterRig } from '@/core/CharacterRig';
import type { AnimState } from '@/contracts/character';
import type { LandableSurface } from '@/contracts/elevation';
import type { ObstacleSpec } from '@/contracts/obstacle';

const PLATFORM_COLOR = 0x9aa5b1;
const TRAIN_COLOR = 0x3d6db5;
const OBSTACLE_COLOR = 0x996633; // matches the Spawner's placeholder boxes

// Triangular prism rising from ground level at -z/2 to `height` at +z/2.
function createRampWedge(width: number, height: number, length: number): THREE.Mesh {
  const w = width / 2;
  const d = length / 2;
  const h = height;
  const positions = new Float32Array([
    -w, 0, -d, // 0 front-left-bottom (knife-edge end)
    w, 0, -d, // 1 front-right-bottom
    w, 0, d, // 2 back-right-bottom
    -w, 0, d, // 3 back-left-bottom
    w, h, d, // 4 back-right-top
    -w, h, d, // 5 back-left-top
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4, 3, 4, 5, 0, 4, 1, 0, 5, 4, 3, 5, 0, 1, 4, 2]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: TRAIN_COLOR }));
}

export class SceneRoot {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly placeholder: THREE.Mesh;
  private readonly trackGroup = new THREE.Group();
  private characterRig: CharacterRig | null = null;

  constructor() {
    this.scene.background = createSkyGradientTexture(SKY_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    this.scene.add(this.trackGroup);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
    this.camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 10, -5);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 400),
      new THREE.MeshStandardMaterial({ color: GROUND_COLOR }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 150;
    this.scene.add(ground);

    for (const x of LANE_POSITIONS) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 400),
        new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.01, 150);
      this.scene.add(stripe);
    }

    this.placeholder = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, PLAYER_HEIGHT - 0.8, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xff3355 }),
    );
    this.placeholder.position.set(0, PLAYER_HEIGHT / 2, 0);
    this.scene.add(this.placeholder);
  }

  addStaticTrack(surfaces: LandableSurface[], obstacles: ObstacleSpec[]): void {
    for (const s of surfaces) {
      if (s.kind === 'PLATFORM') {
        this.trackGroup.add(
          this.trackBox(
            s.halfWidth * 2,
            s.topY,
            s.zEnd - s.zStart,
            s.xCenter,
            s.topY / 2,
            (s.zStart + s.zEnd) / 2,
            PLATFORM_COLOR,
          ),
        );
      } else {
        const flatZStart = s.rampZEnd ?? s.zStart;
        this.trackGroup.add(
          this.trackBox(
            s.halfWidth * 2,
            s.topY,
            s.zEnd - flatZStart,
            s.xCenter,
            s.topY / 2,
            (flatZStart + s.zEnd) / 2,
            TRAIN_COLOR,
          ),
        );
        if (s.rampZEnd !== undefined) {
          const wedge = createRampWedge(s.halfWidth * 2, s.topY, s.rampZEnd - s.zStart);
          wedge.position.set(s.xCenter, 0, (s.zStart + s.rampZEnd) / 2);
          this.trackGroup.add(wedge);
        }
      }
    }
    for (const o of obstacles) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(o.bounds.hx * 2, o.bounds.hy * 2, o.bounds.hz * 2),
        new THREE.MeshStandardMaterial({ color: OBSTACLE_COLOR }),
      );
      mesh.position.set(o.bounds.x, o.bounds.y, o.bounds.z);
      this.trackGroup.add(mesh);
    }
  }

  private trackBox(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, y, z);
    return mesh;
  }

  update(x: number, feetY: number, scaleY: number, animState: AnimState, dt: number, worldDistance: number): void {
    // Static fixture geometry scrolls past the camera exactly like spawner meshes (z - distance),
    // so it arrives at the player when the sim's collision box reaches it.
    this.trackGroup.position.z = -worldDistance;

    this.placeholder.position.x = x;
    this.placeholder.position.y = feetY + (PLAYER_HEIGHT * scaleY) / 2;
    this.placeholder.scale.y = scaleY;

    if (this.characterRig) {
      this.characterRig.setState(animState);
      this.characterRig.update(dt);
      this.characterRig.group.position.set(x, feetY + CHARACTER_FEET_OFFSET, 0);
    }
  }

  attachCharacter(rig: CharacterRig): void {
    this.characterRig = rig;
    this.scene.add(rig.group);
    this.placeholder.visible = false;
  }
}
