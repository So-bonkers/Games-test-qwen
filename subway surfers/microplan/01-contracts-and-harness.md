# M1 — Contracts, Harness, and App Skeleton

**Depends on:** `microplan/00-environment-gate.md` complete and green. `test/gl-profile.json` must exist.

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Where a task gives file content, transcribe it exactly; do not rename symbols, reorder fields, or add JSDoc. If a Verification step fails, stop and report the exact command output. Do not redesign.

**Two standing rules for this project:**
1. **Never use `const enum`.** Use string union types only.
2. **Never call `Math.random()`.** The only randomness source is `src/util/rng.ts`. This is grep-enforced starting in M2.

**Working directory for every command:** `/home/shubhankar/Desktop/games-test/subway surfers`

---

## Task 1.1 — Create tsconfig.json

- **File:** `tsconfig.json`
- **Action:** create
- **Preconditions:** M0 complete
- **Spec:** Write exactly:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 (it will report no files yet, which is fine).

---

## Task 1.2 — Create tsconfig.node.json

- **File:** `tsconfig.node.json`
- **Action:** create
- **Preconditions:** Task 1.1 complete
- **Spec:** This covers config files and Playwright specs. Three settings here are load-bearing and must not be trimmed: `types: ["node"]` because specs use `fs`; `DOM` in `lib` because Playwright's `page.evaluate` callbacks are typechecked against browser globals even though the spec itself runs in Node; and `paths` because the specs import types out of `src/`, which uses `@/` internally. Write exactly:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["vite.config.ts", "playwright.config.ts", "test/**/*.ts"]
}
```

- **Verification:** `test -f tsconfig.node.json` exits 0.

---

## Task 1.3 — Create vite.config.ts

- **File:** `vite.config.ts`
- **Action:** create
- **Preconditions:** Task 1.2 complete
- **Spec:** The `@` alias must be derived, never hardcoded. The previous attempt hardcoded an absolute path containing a space, which was machine-specific and fragile. Use `fileURLToPath` — **not** `new URL(...).pathname`, which yields `%20` for the space in "subway surfers" and silently breaks resolution. Write exactly:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 1.4 — Create index.html

- **File:** `index.html`
- **Action:** create
- **Preconditions:** none
- **Spec:** No query-string cache-buster on the script src. The previous attempt used `/src/main.ts?v=2` while fighting a stale-module problem; that is not a fix and must not be reintroduced. Write exactly:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Subway Surfers Clone</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- **Verification:** `test -f index.html` exits 0.

---

## Task 1.5 — Create src/style.css

- **File:** `src/style.css`
- **Action:** create
- **Preconditions:** none
- **Spec:** Write exactly:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  touch-action: none;
  font-family: system-ui, sans-serif;
}

#app { width: 100%; height: 100%; }

canvas { display: block; width: 100%; height: 100%; }
```

- **Verification:** `test -f src/style.css` exits 0.

---

## Task 1.6 — Create the elevation contract

- **File:** `src/contracts/elevation.ts`
- **Action:** create
- **Preconditions:** Task 1.1 complete
- **Spec:** This file is frozen. Later milestones import from it and must never edit it. Write exactly:

```ts
export type Elevation = 'GROUND' | 'AIRBORNE' | 'ON_PLATFORM' | 'ON_TRAIN_ROOF';

export interface LandableSurface {
  topY: number;
  zStart: number;
  zEnd: number;
  xCenter: number;
  halfWidth: number;
  kind: 'PLATFORM' | 'TRAIN_ROOF';
  rampZEnd?: number;
  ownerId: number;
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.7 — Create the obstacle contract

- **File:** `src/contracts/obstacle.ts`
- **Action:** create
- **Preconditions:** Task 1.6 complete
- **Spec:** Write exactly:

```ts
import type { LandableSurface } from '@/contracts/elevation';

export type ObstacleType =
  | 'LOW_BARRIER'
  | 'HIGH_BARRIER'
  | 'FULL_BLOCK'
  | 'PLATFORM'
  | 'TRAIN'
  | 'RAMP_TRAIN';

export interface ObstacleBounds {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

export interface ObstacleSpec {
  id: number;
  type: ObstacleType;
  lane: 0 | 1 | 2;
  relativeSpeed: number;
  bounds: ObstacleBounds;
  landableSurfaces: LandableSurface[];
  deadlyFaces: Array<'FRONT' | 'SIDE' | 'TOP'>;
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.8 — Create the debug contract

- **File:** `src/contracts/debug.ts`
- **Action:** create
- **Preconditions:** Task 1.7 complete
- **Spec:** Every field is plain JSON — no class instances, no `THREE.Vector3`, no enums. The objects are mutated in place by the game loop, so tests can read any path at any time. Write exactly:

```ts
import type { Elevation } from '@/contracts/elevation';
import type { ObstacleType } from '@/contracts/obstacle';

export interface LumaStats {
  mean: number;
  p99: number;
  distinctBuckets: number;
}

export interface DebugEvent {
  tick: number;
  type: 'collision' | 'land' | 'dismount' | 'coin' | 'spawnRow' | 'gameover';
  data: Record<string, number | string>;
}

export interface DebugObstacle {
  id: number;
  type: ObstacleType;
  lane: 0 | 1 | 2;
  z: number;
  topY: number | null;
  zRange: [number, number];
  relativeSpeed: number;
}

export interface DebugHook {
  version: 1;
  state: 'menu' | 'playing' | 'gameover';
  stats: {
    frame: number;
    simTick: number;
    simTime: number;
    drawCalls: number;
    triangles: number;
    luma: LumaStats;
  };
  player: {
    lane: 0 | 1 | 2;
    x: number;
    y: number;
    feetY: number;
    elevation: Elevation;
    velocityY: number;
    grounded: boolean;
  };
  world: { speed: number; distance: number; score: number; coins: number };
  pool: { obstaclesActive: number; obstaclesFree: number; chunksActive: number };
  obstacles(): DebugObstacle[];
  events: DebugEvent[];
  seed(n: number): void;
  setPaused(paused: boolean): void;
  step(ticks: number): void;
  enqueue(inputs: Array<'left' | 'right' | 'jump' | 'slide'>): void;
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.9 — Create the seeded RNG

- **File:** `src/util/rng.ts`
- **Action:** create
- **Preconditions:** Task 1.1 complete
- **Spec:** This is the **only** permitted randomness source in the project. Write exactly:

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(rng: Rng, minInclusive: number, maxExclusive: number): number {
  return Math.floor(randRange(rng, minInclusive, maxExclusive));
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.10 — Create GameConfig

- **File:** `src/core/GameConfig.ts`
- **Action:** create
- **Preconditions:** Task 1.1 complete
- **Spec:** These values are salvaged from the previous attempt, where they were play-tested. Do not retune them. Note there is deliberately **no import** in this file — the previous version imported a `const enum` from `@/types` and that import was part of the crash that produced the black screen. Write exactly:

```ts
export const LANE_POSITIONS = [-3, 0, 3] as const;
export const LANE_WIDTH = 2.5;

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.8;
export const PLAYER_DEPTH = 0.6;
export const PLAYER_SLIDE_SCALE = 0.5;

export const PLATFORM_HEIGHT = 1.0;

export const TRAIN_LENGTH = 9;
export const TRAIN_ROOF_HEIGHT = 2.5;
export const RAMP_LENGTH = 3.0;
export const FAST_TRAIN_EXTRA_SPEED = 10;

export const LERP_SPEED = 12;
export const JUMP_VELOCITY = 9;
export const GRAVITY = -22;
export const FAST_FALL_SPEED = 16;
export const SLIDE_DURATION = 0.6;

export const BASE_SPEED = 14;
export const MAX_SPEED = 28;
export const SPEED_INCREMENT = 0.5;
export const SPEED_INTERVAL = 30;

export const SPAWN_DISTANCE = 120;
export const DESPAWN_DISTANCE = 20;
export const CHUNK_SIZE = 50;
export const MIN_SPAWN_GAP = 12;
export const MAX_SPAWN_GAP = 22;
export const TUNNEL_MIN_GAP = 70;
export const TUNNEL_MAX_GAP = 120;

export const CAMERA_POSITION = { x: 0, y: 5.5, z: -9 } as const;
export const CAMERA_TARGET = { x: 0, y: 1.5, z: 8 } as const;

export const SKY_COLOR = 0x87ceeb;
export const GROUND_COLOR = 0x555555;
export const FOG_COLOR = 0x87ceeb;
export const FOG_NEAR = 60;
export const FOG_FAR = 140;

export const DISTANCE_SCORE_MULTIPLIER = 1;
export const COIN_VALUE = 10;

export const FIXED_TIMESTEP = 1 / 120;
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.11 — Restore ObjectPool byte-exact from git

- **File:** `src/systems/ObjectPool.ts`
- **Action:** create (by restoring from git history)
- **Preconditions:** Task 1.1 complete
- **Spec:** Do **not** write this file by hand and do not modify it after restoring. Run exactly:

```
mkdir -p src/systems
git show "HEAD:./src/systems/ObjectPool.ts" > src/systems/ObjectPool.ts
```

- **Verification:** `git show "HEAD:./src/systems/ObjectPool.ts" | diff - src/systems/ObjectPool.ts` produces no output and exits 0. Also `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.12 — Create the debug hook

- **File:** `src/core/DebugHook.ts`
- **Action:** create
- **Preconditions:** Tasks 1.8 and 1.10 complete
- **Spec:** The hook object is a plain mutable singleton. The loop writes into it every frame; tests read from it. The driver methods (`seed`, `setPaused`, `step`, `enqueue`) are implemented in M2 and **must throw** until then, so nothing silently depends on a no-op.

  It is installed when the build mode is not `production`, which covers both the dev server and the staging build the test gate runs against. Write exactly:

```ts
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

const SAMPLE = 64;
const buckets = new Array<number>(32);
const lumas: number[] = [];

export function sampleLuma(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  const w = Math.min(SAMPLE, gl.drawingBufferWidth);
  const h = Math.min(SAMPLE, gl.drawingBufferHeight);
  if (w === 0 || h === 0) return;
  const x = Math.floor((gl.drawingBufferWidth - w) / 2);
  const y = Math.floor((gl.drawingBufferHeight - h) / 2);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

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
```

  **Important:** `sampleLuma` must be called immediately after `renderer.render(...)` in the same frame. That is why the app does not need `preserveDrawingBuffer`.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 1.13 — Create the app skeleton

- **File:** `src/main.ts`
- **Action:** create
- **Preconditions:** Tasks 1.4, 1.5, 1.10, 1.12 complete
- **Spec:** A minimal but genuinely animated scene, so the pixel-based gate has something real to assert. M2 replaces this file wholesale with a modular version; do not build module structure here. Write exactly:

```ts
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
import { debugHook, installDebugHook, sampleLuma } from '@/core/DebugHook';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found in index.html');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
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
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 **and** `npm run build` exits 0.

---

## Task 1.14 — Create the benign-console allowlist

- **File:** `test/benign-console.ts`
- **Action:** create
- **Preconditions:** none
- **Spec:** Any `console.error` not matching one of these is treated as fatal. Keep this list minimal; never add a pattern just to make a failing test pass. Write exactly:

```ts
export const BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Failed to load resource: net::ERR_INTERNET_DISCONNECTED/,
];

export function isBenign(text: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some((re) => re.test(text));
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 1.15 — Create playwright.config.ts

- **File:** `playwright.config.ts`
- **Action:** create
- **Preconditions:** Task 1.2 complete, `test/gl-profile.json` exists
- **Spec:** Launch options come from the profile M0 recorded, so the suite uses whatever GL path was actually proven to work on this machine. Write exactly:

```ts
import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const profile = JSON.parse(readFileSync('test/gl-profile.json', 'utf8')) as {
  headless: boolean;
  args?: string[];
};

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    headless: profile.headless,
    launchOptions: { args: profile.args ?? [] },
  },
  webServer: {
    command: 'npm run build:test && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 1.16 — Declare the window global for tests

- **File:** `test/global.d.ts`
- **Action:** create
- **Preconditions:** Tasks 1.8 and 1.2 complete
- **Spec:** Without this, every `window.__GAME__` reference in a spec is a type error. Write exactly:

```ts
import type { DebugHook } from '@/contracts/debug';

declare global {
  interface Window {
    __GAME__: DebugHook;
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 1.17 — Create the smoke spec

- **File:** `test/smoke.spec.ts`
- **Action:** create
- **Preconditions:** Tasks 1.13, 1.14, 1.15, 1.16 complete
- **Spec:** Each assertion is its own `test()` so a failure name identifies the fault directly. Write exactly:

```ts
import { expect, test } from '@playwright/test';
import { isBenign } from './benign-console';

test.describe('smoke', () => {
  test('no fatal console or page errors', async ({ page }) => {
    const fatal: string[] = [];
    page.on('pageerror', (e) => fatal.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !isBenign(m.text())) fatal.push(`console: ${m.text()}`);
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 5);
    expect(fatal).toEqual([]);
  });

  test('canvas geometry is nonzero', async ({ page }) => {
    await page.goto('/');
    const dims = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!c) return null;
      return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight };
    });
    expect(dims).not.toBeNull();
    expect(dims!.w).toBeGreaterThan(0);
    expect(dims!.h).toBeGreaterThan(0);
    expect(dims!.cw).toBeGreaterThan(0);
    expect(dims!.ch).toBeGreaterThan(0);
  });

  test('webgl2 context is live', async ({ page }) => {
    await page.goto('/');
    const gl = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!c) return null;
      const ctx = c.getContext('webgl2');
      return ctx ? { lost: ctx.isContextLost() } : null;
    });
    expect(gl, 'getContext("webgl2") returned null').not.toBeNull();
    expect(gl!.lost).toBe(false);
  });

  test('render loop advances', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);
    const a = await page.evaluate(() => window.__GAME__.stats.frame);
    await page.waitForTimeout(500);
    const b = await page.evaluate(() => window.__GAME__.stats.frame);
    expect(b - a, 'frames rendered in 500ms').toBeGreaterThanOrEqual(20);
  });

  test('draw calls are nonzero', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.drawCalls > 0);
    const stats = await page.evaluate(() => window.__GAME__.stats);
    expect(stats.drawCalls).toBeGreaterThan(0);
    expect(stats.triangles).toBeGreaterThan(0);
  });

  test('frame is not black and has tonal spread', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.luma.distinctBuckets > 0);
    const a = await page.evaluate(() => ({ ...window.__GAME__.stats.luma }));
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => ({ ...window.__GAME__.stats.luma }));

    expect(b.p99, 'p99 luminance').toBeGreaterThan(0.06);
    expect(b.distinctBuckets, 'distinct luma buckets').toBeGreaterThanOrEqual(8);
    expect(Math.abs(b.mean - a.mean), 'mean luma delta between samples').toBeGreaterThan(0);
  });
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 1.18 — Run the full gate

- **File:** none
- **Action:** run command
- **Preconditions:** all previous tasks complete
- **Spec:** Run `npm run gate`.
- **Verification:** Exit code 0, and the Playwright output shows **6 passed**. If any test fails, report the failing test name and its full output. Do not modify the test to make it pass.

---

## Amendment 1 — two new/corrected files (run after Task 1.18 failed)

**Why:** `npm run gate` failed on `frame is not black and has tonal spread`, with `distinctBuckets: 5`. Two separate bugs, both compounding, both are corrections to the spec, not something to route around:

1. **The 64×64 crop is centered on the canvas, but the player capsule isn't.** With `CAMERA_POSITION (0, 5.5, -9)` looking at `CAMERA_TARGET (0, 1.5, 8)`, the player at `z≈0` projects to roughly the lower-middle of the frame (empirically ~65% down, not 50%). Centering the sample window was wrong from the start — it was written assuming the subject sits at screen-center, which is untrue of this camera framing and will stay untrue for the whole project, since the camera is frozen. The fix is a fixed, project-specific vertical anchor, not a bigger or smarter search.
2. **`readPixels` returns stale/frozen values on this GPU/driver path without `preserveDrawingBuffer`.** M0's probe already had `preserveDrawingBuffer: true` on its renderer (that's why M0 never hit this) — Task 1.13's app renderer did not. The comment in the original Task 1.12 spec ("this is why the app does not need preserveDrawingBuffer") was a false assumption; delete it.

Same root cause as Amendment 1 in `00-environment-gate.md` also contributes here — the scene has too little inherent tonal range — so this amendment also carries the gradient-sky fix forward into the real app, which additionally satisfies the original plan's Phase 1 requirement for a gradient sky placeholder.

**New file — create `src/core/SkyGradient.ts`:**

```ts
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
```

**Redo Task 1.12 — replace `sampleLuma` in `src/core/DebugHook.ts`** with this version. Everything else in the file (`debugHook`, `installDebugHook`) is unchanged. Delete the old `SAMPLE`/`buckets`/`lumas` module-level declarations and the old `sampleLuma` function; replace with:

```ts
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
```

Note: WebGL's Y axis for `readPixels` is bottom-up (row 0 is the bottom of the framebuffer), so `1 - VERTICAL_ANCHOR` is deliberate — it converts "65% down from the top of the screen" into the correct bottom-origin row.

**Redo Task 1.13 — two changes to `src/main.ts`.** Add the import:

```ts
import { createSkyGradientTexture } from '@/core/SkyGradient';
```

Change the renderer construction line to:

```ts
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
```

Change the background line to:

```ts
scene.background = createSkyGradientTexture(SKY_COLOR);
```

Nothing else in `src/main.ts` changes.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0. Then re-run Task 1.18 (`npm run gate`) — expect exit 0 with **6 passed**.

---

## Milestone Definition of Done

1. `npm run typecheck` — exit 0
2. `npm run build` — exit 0
3. `npm run gate` — exit 0, 6 tests passed
4. `git show "HEAD:./src/systems/ObjectPool.ts" | diff - src/systems/ObjectPool.ts` — no output
5. `src/contracts/` contains exactly three files: `elevation.ts`, `obstacle.ts`, `debug.ts`

**Report on completion:** the Playwright summary line and the value of `stats.luma` from the last run. Do not begin M2.
