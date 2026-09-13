import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(400, 300);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

const camera = new THREE.PerspectiveCamera(60, 400 / 300, 0.1, 100);
camera.position.set(0, 0, 4);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ color: 0xff3355 }),
);
scene.add(cube);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(3, 4, 5);
scene.add(key);

let frame = 0;
function tick() {
  frame++;
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.017;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

(window as unknown as Record<string, unknown>).__PROBE__ = () => {
  const gl = renderer.getContext();
  const w = 64;
  const h = 64;
  const x = Math.floor((renderer.domElement.width - w) / 2);
  const y = Math.floor((renderer.domElement.height - h) / 2);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  const buckets = new Array(32).fill(0);
  const lumas: number[] = [];
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    lumas.push(l);
    buckets[Math.min(31, Math.floor(l * 32))]++;
  }
  lumas.sort((a, b) => a - b);
  const mean = lumas.reduce((s, v) => s + v, 0) / lumas.length;
  return {
    frame,
    mean,
    p99: lumas[Math.floor(lumas.length * 0.99)],
    distinctBuckets: buckets.filter((c) => c > 0).length,
  };
};
