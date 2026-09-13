import * as THREE from 'three';
import '@/style.css';
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
import { debugHook, installDebugHook, sampleLuma } from '@/core/DebugHook';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found in index.html');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = createSkyGradientTexture(SKY_COLOR);
scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(5, 10, -5);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 400),
  new THREE.MeshStandardMaterial({ color: GROUND_COLOR }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = 150;
scene.add(ground);

for (const x of LANE_POSITIONS) {
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 400),
    new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(x, 0.01, 150);
  scene.add(stripe);
}

const placeholder = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, PLAYER_HEIGHT - 0.8, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0xff3355 }),
);
placeholder.position.set(0, PLAYER_HEIGHT / 2, 0);
scene.add(placeholder);

installDebugHook();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function frame(): void {
  const t = clock.getElapsedTime();

  placeholder.position.y = PLAYER_HEIGHT / 2 + Math.sin(t * 3) * 0.25;
  placeholder.rotation.y = t * 0.8;

  renderer.render(scene, camera);

  debugHook.stats.frame++;
  if (debugHook.stats.frame % 30 === 0) sampleLuma(renderer);
  debugHook.stats.drawCalls = renderer.info.render.calls;
  debugHook.stats.triangles = renderer.info.render.triangles;
  debugHook.player.y = placeholder.position.y;
  debugHook.player.feetY = placeholder.position.y - PLAYER_HEIGHT / 2;

  requestAnimationFrame(frame);
}
frame();
