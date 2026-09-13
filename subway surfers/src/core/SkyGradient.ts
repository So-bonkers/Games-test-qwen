import * as THREE from 'three';

export function createSkyGradientTexture(baseHex: number): THREE.CanvasTexture {
  const top = new THREE.Color(baseHex);
  const bottom = top.clone().multiplyScalar(0.35);
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `#${top.getHexString()}`);
  gradient.addColorStop(1, `#${bottom.getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
