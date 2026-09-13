import * as THREE from 'three';
import {
  CAMERA_POSITION,
  CAMERA_TARGET,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  GROUND_COLOR,
  LANE_POSITIONS,
  PLAYER_HEIGHT,
  SKY_COLOR,
} from '@/core/GameConfig';
import { createSkyGradientTexture } from '@/core/SkyGradient';

export class SceneRoot {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly placeholder: THREE.Mesh;

  constructor() {
    this.scene.background = createSkyGradientTexture(SKY_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

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

  update(x: number, feetY: number, scaleY: number): void {
    this.placeholder.position.x = x;
    this.placeholder.position.y = feetY + (PLAYER_HEIGHT * scaleY) / 2;
    this.placeholder.scale.y = scaleY;
  }
}
