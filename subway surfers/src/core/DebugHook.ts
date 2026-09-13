import type * as THREE from 'three';
import type { DebugHook, DebugObstacle } from '@/contracts/debug';

const notYet = (name: string) => () => {
  throw new Error(`__GAME__.${name}() is not implemented until M2`);
};

export const debugHook: DebugHook = {
  version: 1,
  state: 'playing',
  stats: {
    frame: 0,
    simTick: 0,
    simTime: 0,
    drawCalls: 0,
    triangles: 0,
    luma: { mean: 0, p99: 0, distinctBuckets: 0 },
  },
  player: {
    lane: 1,
    x: 0,
    y: 0,
    feetY: 0,
    elevation: 'GROUND',
    velocityY: 0,
    grounded: true,
  },
  world: { speed: 0, distance: 0, score: 0, coins: 0 },
  pool: { obstaclesActive: 0, obstaclesFree: 0, chunksActive: 0 },
  obstacles: (): DebugObstacle[] => [],
  events: [],
  seed: notYet('seed'),
  setPaused: notYet('setPaused'),
  step: notYet('step'),
  enqueue: notYet('enqueue'),
};

export function installDebugHook(): void {
  if (import.meta.env.MODE !== 'production') {
    (window as unknown as Record<string, unknown>).__GAME__ = debugHook;
  }
}

const SAMPLE_W = 160;
const SAMPLE_H = 160;
const VERTICAL_ANCHOR = 0.65; // fraction down the frame; matches this project's fixed camera framing

const buckets = new Array<number>(32);
const lumas: number[] = [];

export function sampleLuma(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  const bw = gl.drawingBufferWidth;
  const bh = gl.drawingBufferHeight;
  const w = Math.min(SAMPLE_W, bw);
  const h = Math.min(SAMPLE_H, bh);
  if (w === 0 || h === 0) return;
  const x = Math.floor((bw - w) / 2);
  const y = Math.floor(bh * (1 - VERTICAL_ANCHOR) - h / 2);
  const clampedY = Math.max(0, Math.min(bh - h, y));
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x, clampedY, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  buckets.fill(0);
  lumas.length = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    lumas.push(l);
    buckets[Math.min(31, Math.floor(l * 32))]++;
  }
  lumas.sort((a, b) => a - b);
  let sum = 0;
  for (const l of lumas) sum += l;

  debugHook.stats.luma.mean = sum / lumas.length;
  debugHook.stats.luma.p99 = lumas[Math.floor(lumas.length * 0.99)];
  debugHook.stats.luma.distinctBuckets = buckets.filter((c) => c > 0).length;
}
