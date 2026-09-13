# M2 — Core Loop and Module Split

**Depends on:** `microplan/01-contracts-and-harness.md` complete and green (`npm run gate` exits 0 with 6 tests passing).

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Where a task gives file content, transcribe it exactly. If a Verification step fails, stop and report the exact command output. Do not redesign.

**What this milestone does:** replaces the single-file skeleton with four small modules, installs a fixed-timestep simulation decoupled from the render loop, and implements the four debug drivers (`seed`, `setPaused`, `step`, `enqueue`) that every later milestone's tests depend on. After this milestone, tests can drive the game deterministically instead of waiting on wall-clock time.

`src/main.ts` is **replaced wholesale** in Task 2.7. Do not try to edit it incrementally.

**Working directory for every command:** `/home/shubhankar/Desktop/games-test/subway surfers`

---

## Task 2.1 — Create the Renderer module

- **File:** `src/core/Renderer.ts`
- **Action:** create
- **Preconditions:** M1 complete
- **Spec:** Write exactly:

```ts
import * as THREE from 'three';

export class Renderer {
  readonly three: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.three = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.three.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.three.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.three.domElement);
    window.addEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.three.setSize(window.innerWidth, window.innerHeight);
  };

  render(scene: THREE.Scene): void {
    this.three.render(scene, this.camera);
  }

  get drawCalls(): number {
    return this.three.info.render.calls;
  }

  get triangles(): number {
    return this.three.info.render.triangles;
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 2.2 — Create the SceneRoot module

- **File:** `src/core/SceneRoot.ts`
- **Action:** create
- **Preconditions:** Task 2.1 complete
- **Spec:** This owns the scene graph and the placeholder capsule. `update(simTime)` is driven by the fixed-timestep tick, **not** by wall-clock, so the visual state is a pure function of `simTime` and therefore reproducible. The background uses the gradient-sky helper (`createSkyGradientTexture`), not a flat `THREE.Color` — a flat fill was proven in M1 to leave the render-verification gate's tonal-spread check unsatisfiable regardless of lighting, since this project's `MeshStandardMaterial` shows almost no directional-light response on this GPU/driver path (tracked as a risk for M10, not solved here). Write exactly:

```ts
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

  update(simTime: number): void {
    this.placeholder.position.y = PLAYER_HEIGHT / 2 + Math.sin(simTime * 3) * 0.25;
    this.placeholder.rotation.y = simTime * 0.8;
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 2.3 — Create the fixed-timestep Loop

- **File:** `src/core/Loop.ts`
- **Action:** create
- **Preconditions:** Task 2.2 complete
- **Spec:** The simulation advances in fixed `FIXED_TIMESTEP` increments accumulated from real elapsed time; rendering happens once per animation frame. `stepTicks(n)` runs exactly `n` simulation ticks with no wall-clock involvement, which is what makes tests deterministic. `MAX_FRAME_DELTA` prevents a spiral of death after a tab stall. Write exactly:

```ts
import { FIXED_TIMESTEP } from '@/core/GameConfig';

const MAX_FRAME_DELTA = 0.25;

export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private paused = false;
  private running = false;

  constructor(
    private readonly onTick: (dt: number) => void,
    private readonly onRender: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    requestAnimationFrame(this.frame);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.accumulator = 0;
    this.lastTime = performance.now() / 1000;
  }

  isPaused(): boolean {
    return this.paused;
  }

  stepTicks(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.onTick(FIXED_TIMESTEP);
    this.onRender();
  }

  private readonly frame = (): void => {
    const now = performance.now() / 1000;
    const delta = Math.min(now - this.lastTime, MAX_FRAME_DELTA);
    this.lastTime = now;

    if (!this.paused) {
      this.accumulator += delta;
      while (this.accumulator >= FIXED_TIMESTEP) {
        this.onTick(FIXED_TIMESTEP);
        this.accumulator -= FIXED_TIMESTEP;
      }
      this.onRender();
    }

    requestAnimationFrame(this.frame);
  };
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 2.4 — Create the input queue

- **File:** `src/input/InputQueue.ts`
- **Action:** create
- **Preconditions:** M1 complete
- **Spec:** All input — real keyboard and test-injected alike — funnels through this queue, and the simulation drains it on tick boundaries. That is what lets tests inject input without synthetic key events. Write exactly:

```ts
export type InputAction = 'left' | 'right' | 'jump' | 'slide';

export class InputQueue {
  private readonly queue: InputAction[] = [];

  push(action: InputAction): void {
    this.queue.push(action);
  }

  pushAll(actions: InputAction[]): void {
    for (const a of actions) this.queue.push(a);
  }

  drain(): InputAction[] {
    if (this.queue.length === 0) return [];
    return this.queue.splice(0, this.queue.length);
  }

  get pending(): number {
    return this.queue.length;
  }
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 2.5 — Create the keyboard adapter

- **File:** `src/input/KeyboardInput.ts`
- **Action:** create
- **Preconditions:** Task 2.4 complete
- **Spec:** This is the only place that listens to the DOM for input. It translates keys into queue pushes and does nothing else. Write exactly:

```ts
import type { InputAction } from '@/input/InputQueue';
import { InputQueue } from '@/input/InputQueue';

const KEY_MAP: Record<string, InputAction> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
};

export function attachKeyboard(queue: InputQueue): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    queue.push(action);
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 2.6 — Create the simulation state holder

- **File:** `src/core/Sim.ts`
- **Action:** create
- **Preconditions:** Tasks 2.2 and 2.4 complete
- **Spec:** `Sim` owns everything that advances per tick and is the single place the debug hook is written from. `simTime` is computed as `simTick * FIXED_TIMESTEP` rather than accumulated, so repeated floating-point addition cannot drift. Write exactly:

```ts
import { FIXED_TIMESTEP } from '@/core/GameConfig';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputAction, InputQueue } from '@/input/InputQueue';
import { debugHook } from '@/core/DebugHook';
import { mulberry32, type Rng } from '@/util/rng';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);

  constructor(
    private readonly scene: SceneRoot,
    private readonly input: InputQueue,
  ) {}

  setSeed(seed: number): void {
    this.rng = mulberry32(seed);
  }

  get simTime(): number {
    return this.tickCount * FIXED_TIMESTEP;
  }

  tick(): void {
    const actions = this.input.drain();
    for (const action of actions) this.applyAction(action);

    this.tickCount++;
    this.scene.update(this.simTime);

    debugHook.stats.simTick = this.tickCount;
    debugHook.stats.simTime = this.simTime;
    debugHook.player.y = this.scene.placeholder.position.y;
  }

  private applyAction(action: InputAction): void {
    if (action === 'left') debugHook.player.lane = Math.max(0, debugHook.player.lane - 1) as 0 | 1 | 2;
    if (action === 'right') debugHook.player.lane = Math.min(2, debugHook.player.lane + 1) as 0 | 1 | 2;
  }
}
```

  Note: `rng` is deliberately **public** and unused until M6. If it were `private`, `noUnusedLocals` would reject it as a never-read private member and the build would fail. `jump` and `slide` are intentionally not handled yet — they arrive in M3.

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

## Task 2.7 — Replace main.ts

- **File:** `src/main.ts`
- **Action:** modify (replace the entire file contents)
- **Preconditions:** Tasks 2.1 through 2.6 complete
- **Spec:** Delete everything currently in `src/main.ts` and write exactly this. This is where the four debug drivers get bound to real implementations, replacing the throwing stubs from M1.

```ts
import '@/style.css';
import { PLAYER_HEIGHT } from '@/core/GameConfig';
import { debugHook, installDebugHook, sampleLuma } from '@/core/DebugHook';
import { Loop } from '@/core/Loop';
import { Renderer } from '@/core/Renderer';
import { SceneRoot } from '@/core/SceneRoot';
import { Sim } from '@/core/Sim';
import { InputQueue } from '@/input/InputQueue';
import { attachKeyboard } from '@/input/KeyboardInput';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found in index.html');

const sceneRoot = new SceneRoot();
const renderer = new Renderer(app, sceneRoot.camera);
const input = new InputQueue();
const sim = new Sim(sceneRoot, input);

attachKeyboard(input);

function render(): void {
  renderer.render(sceneRoot.scene);
  debugHook.stats.frame++;
  if (debugHook.stats.frame % 30 === 0) sampleLuma(renderer.three);
  debugHook.stats.drawCalls = renderer.drawCalls;
  debugHook.stats.triangles = renderer.triangles;
  debugHook.player.feetY = sceneRoot.placeholder.position.y - PLAYER_HEIGHT / 2;
}

const loop = new Loop(() => sim.tick(), render);

installDebugHook();
debugHook.seed = (n: number) => sim.setSeed(n);
debugHook.setPaused = (paused: boolean) => loop.setPaused(paused);
debugHook.step = (ticks: number) => loop.stepTicks(ticks);
debugHook.enqueue = (actions) => input.pushAll(actions);

loop.start();
```

- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 **and** `npm run build` exits 0.

---

## Task 2.8 — Create the randomness guard spec

- **File:** `test/no-math-random.spec.ts`
- **Action:** create
- **Preconditions:** M1 complete
- **Spec:** Reproducible tests are impossible if any subsystem reaches for `Math.random()`. This spec enforces the ban across the whole source tree. Write exactly:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const ALLOWED = ['src/util/rng.ts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('Math.random is never called outside src/util/rng.ts', () => {
  const offenders = walk('src')
    .filter((f) => !ALLOWED.includes(f))
    .filter((f) => readFileSync(f, 'utf8').includes('Math.random('));
  expect(offenders, 'files calling Math.random()').toEqual([]);
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 2.9 — Create the deterministic-stepping spec

- **File:** `test/loop.spec.ts`
- **Action:** create
- **Preconditions:** Task 2.7 complete
- **Spec:** This proves the debug drivers work, which every later milestone's tests rely on. Write exactly:

```ts
import { expect, test } from '@playwright/test';

test.describe('deterministic loop', () => {
  test('step(120) advances simTime by one second', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      const before = window.__GAME__.stats.simTime;
      window.__GAME__.step(120);
      return { before, after: window.__GAME__.stats.simTime };
    });

    expect(Math.abs(result.after - result.before - 1)).toBeLessThan(1e-9);
  });

  test('paused loop does not advance on its own', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.evaluate(() => window.__GAME__.setPaused(true));
    const a = await page.evaluate(() => window.__GAME__.stats.simTick);
    await page.waitForTimeout(300);
    const b = await page.evaluate(() => window.__GAME__.stats.simTick);

    expect(b).toBe(a);
  });

  test('enqueued input is applied on the next tick', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const lane = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['left']);
      window.__GAME__.step(1);
      return window.__GAME__.player.lane;
    });

    expect(lane).toBe(0);
  });

  test('a real keydown reaches the input queue', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.evaluate(() => window.__GAME__.setPaused(true));
    await page.keyboard.press('ArrowRight');
    const lane = await page.evaluate(() => {
      window.__GAME__.step(1);
      return window.__GAME__.player.lane;
    });

    expect(lane).toBe(2);
  });
});
```

- **Verification:** `npx tsc --noEmit -p tsconfig.node.json` exits 0.

---

## Task 2.10 — Verify module size budget

- **File:** none
- **Action:** run command
- **Preconditions:** Tasks 2.1 through 2.7 complete
- **Spec:** Run:

```
wc -l src/core/Renderer.ts src/core/SceneRoot.ts src/core/Loop.ts src/core/Sim.ts src/input/InputQueue.ts src/input/KeyboardInput.ts src/main.ts
```

- **Verification:** Every individual file reports fewer than 150 lines. If any exceeds it, stop and report — do not split it yourself.

---

## Task 2.11 — Run the full gate

- **File:** none
- **Action:** run command
- **Preconditions:** all previous tasks complete
- **Spec:** Run `npm run gate`.
- **Verification:** Exit code 0, and the Playwright output shows **11 passed** (6 from M1, 1 randomness guard, 4 loop specs). If any test fails, report the failing test name and its full output. Do not modify a test to make it pass.

---

## Milestone Definition of Done

1. `npm run gate` — exit 0, 11 tests passed
2. `grep -rn "Math.random(" src/` — returns only lines in `src/util/rng.ts`
3. Every file listed in Task 2.10 is under 150 lines
4. `src/main.ts` contains no `THREE.` usage — all Three.js access now lives in `Renderer.ts` and `SceneRoot.ts`

**Report on completion:** the Playwright summary line and the `wc -l` output from Task 2.10. Do not begin M3 — its microplan does not exist yet and must be generated against the real files this milestone produced.
