# M0 — Environment Gate

**Depends on:** nothing. This is the first milestone.

**Executor instructions:** Execute tasks in order. Do exactly what each task specifies — no extra files, abstractions, comments, error handling, or "improvements". Do not create anything under `src/` in this milestone. If a Verification step fails, stop and report the exact command output. Do not redesign, do not try an alternative approach, do not skip ahead.

**Why this milestone exists:** a previous attempt at this project built for days and then hit a black screen it could not diagnose. This milestone proves the render pipeline works, bottom to top, before any game code exists. Every task here is a rung on a ladder; if one fails, the fault is localized to that rung.

**Working directory for every command:** `/home/shubhankar/Desktop/games-test/subway surfers`

---

## Task 0.1 — Create package.json

- **File:** `package.json`
- **Action:** create
- **Preconditions:** none
- **Spec:** Write exactly this content. Versions are pinned deliberately; do not change, upgrade, or add dependencies.

```json
{
  "name": "subway-surfers-clone",
  "private": true,
  "version": "0.2.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:test": "vite build --mode staging",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "test": "playwright test",
    "gate": "npm run typecheck && npm run build && npm run test",
    "probe:webgl:headed": "node test/probes/webgl-probe.mjs",
    "probe:webgl:headless": "node test/probes/webgl-probe.mjs --headless",
    "probe:vite": "node test/probes/vite-render-probe.mjs"
  },
  "dependencies": {
    "three": "0.170.0"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@types/node": "22.10.2",
    "@types/three": "0.170.0",
    "typescript": "5.6.3",
    "vite": "6.4.3"
  }
}
```

- **Verification:** `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exits 0.

---

## Task 0.2 — Create .gitignore

- **File:** `.gitignore`
- **Action:** create
- **Preconditions:** none
- **Spec:** Write exactly:

```
node_modules/
dist/
test-results/
playwright-report/
.vite/
*.local
```

- **Verification:** `test -f .gitignore` exits 0.

---

## Task 0.3 — Install dependencies

- **File:** none (creates `node_modules/`, `package-lock.json`)
- **Action:** run command
- **Preconditions:** Task 0.1 complete
- **Spec:** Run `npm install`. Do not add flags. Do not run `npm audit fix`.
- **Verification:** `npm ls three vite typescript @playwright/test --depth=0` prints `three@0.170.0`, `vite@6.4.3`, `typescript@5.6.3`, `@playwright/test@1.63.0` with no `UNMET` lines.

---

## Task 0.4 — Install the Chromium browser binary

- **File:** none (installs to `~/.cache/ms-playwright`)
- **Action:** run command
- **Preconditions:** Task 0.3 complete
- **Spec:** Run `npx playwright install --with-deps chromium`. If `--with-deps` fails because it requires sudo, rerun as `npx playwright install chromium` and report that the system-dependency step was skipped.
- **Verification:** `npx playwright --version` exits 0 **and** `ls ~/.cache/ms-playwright | grep chromium` prints at least one line.

---

## Task 0.5 — G1: confirm native GL

- **File:** none
- **Action:** run command
- **Preconditions:** none
- **Spec:** Run `glxinfo -B | grep -E "direct rendering|Device|OpenGL version"`.
- **Verification:** Output contains `direct rendering: Yes`. If `glxinfo` is not installed, run `sudo apt install -y mesa-utils` and retry. If it still fails, **stop and report** — every later rung depends on this one.

---

## Task 0.6 — Write the WebGL probe

- **File:** `test/probes/webgl-probe.mjs`
- **Action:** create
- **Preconditions:** Task 0.4 complete
- **Spec:** Write exactly this content. It launches Chromium, gets a WebGL2 context on a bare canvas with no Three.js and no Vite involved, clears to a known color, and reads the pixel back. Headless mode passes the ANGLE + SwiftShader flags, because since Chrome 119 `--disable-gpu` alone yields a null context — that is the specific mistake that broke the previous attempt's harness.

```js
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const HEADLESS = process.argv.includes('--headless');
const HEADLESS_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl',
  '--enable-unsafe-swiftshader',
  '--no-sandbox',
];
const args = HEADLESS ? HEADLESS_ARGS : [];
const label = HEADLESS ? 'G3-headless' : 'G2-headed';

const browser = await chromium.launch({ headless: HEADLESS, args });
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="64" height="64"></canvas>');

const result = await page.evaluate(() => {
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2');
  if (!gl) return { ok: false, reason: 'getContext("webgl2") returned null' };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  gl.clearColor(0.2, 0.5, 0.8, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return {
    ok: true,
    version: gl.getParameter(gl.VERSION),
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'unknown',
    pixel: [px[0], px[1], px[2], px[3]],
  };
});

await browser.close();

if (!result.ok) {
  console.log(`FAIL ${label} expected=non-null-webgl2 actual=null hint=${result.reason}`);
  console.log('NEXT: test/probes/webgl-probe.mjs launch args');
  process.exit(2);
}

const [r, g, b] = result.pixel;
const cleared = Math.abs(r - 51) <= 2 && Math.abs(g - 128) <= 2 && Math.abs(b - 204) <= 2;
if (!cleared) {
  console.log(`FAIL ${label} expected=[51,128,204] actual=[${result.pixel}] hint=Context exists but does not rasterize; the GPU path is broken`);
  console.log('NEXT: test/probes/webgl-probe.mjs');
  process.exit(2);
}

console.log(`PASS ${label}`);
console.log(`  version=${result.version}`);
console.log(`  renderer=${result.renderer}`);
console.log(`  vendor=${result.vendor}`);

if (HEADLESS) {
  mkdirSync('test', { recursive: true });
  writeFileSync(
    'test/gl-profile.json',
    JSON.stringify({ headless: true, args, renderer: result.renderer, version: result.version }, null, 2) + '\n',
  );
  console.log('WROTE test/gl-profile.json');
}
process.exit(0);
```

- **Verification:** `node --check test/probes/webgl-probe.mjs` exits 0.

---

## Task 0.7 — G2: run the headed WebGL probe

- **File:** none
- **Action:** run command
- **Preconditions:** Task 0.6 complete
- **Spec:** Run `npm run probe:webgl:headed`. This opens a real browser window on `DISPLAY=:0`; that is expected.
- **Verification:** Output starts with `PASS G2-headed` and exit code is 0. If it fails, **stop and report** — do not proceed to Task 0.8.

---

## Task 0.8 — G3: run the headless WebGL probe

- **File:** writes `test/gl-profile.json`
- **Action:** run command
- **Preconditions:** Task 0.7 passed
- **Spec:** Run `npm run probe:webgl:headless`.
- **Verification:** Output starts with `PASS G3-headless`, prints `WROTE test/gl-profile.json`, and exit code is 0.

  **If G2 passed but G3 fails:** this is a known, handled outcome and is **not** a code problem. Record it by writing `test/gl-profile.json` with exactly `{ "headless": false, "args": [], "note": "G3 failed; harness must run headed" }` and report that later Playwright runs must use `headless: false`. Do not modify the probe script and do not investigate further.

---

## Task 0.9 — Create the probe page HTML

- **File:** `probe/index.html`
- **Action:** create
- **Preconditions:** Task 0.3 complete
- **Spec:** Write exactly:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Render Probe</title>
    <style>
      body { margin: 0; background: #000; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- **Verification:** `test -f probe/index.html` exits 0.

---

## Task 0.10 — Create the probe scene

- **File:** `probe/main.ts`
- **Action:** create
- **Preconditions:** Task 0.9 complete
- **Spec:** Write exactly this content. A rotating lit cube, plus a `window.__PROBE__` function that reads pixels back and returns luminance statistics. `preserveDrawingBuffer` is required so `readPixels` is valid outside the draw call; it is a probe-only setting and must not be copied into the real app.

```ts
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
```

- **Verification:** `test -f probe/main.ts` exits 0. Do not run `tsc` on this file — there is no tsconfig yet; that arrives in M1.

---

## Task 0.11 — Write the Vite render probe

- **File:** `test/probes/vite-render-probe.mjs`
- **Action:** create
- **Preconditions:** Tasks 0.8 and 0.10 complete
- **Spec:** Write exactly this content. It boots Vite against the `probe/` directory — which exercises the project path containing a space — then checks that TypeScript modules are served with a JavaScript MIME type (G4) and that the scene actually rasterizes and animates (G5).

```js
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const profile = JSON.parse(readFileSync('test/gl-profile.json', 'utf8'));

const server = spawn('npx', ['vite', 'probe', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});

const fail = async (name, expected, actual, hint, next, code) => {
  console.log(`FAIL ${name} expected=${expected} actual=${actual} hint=${hint}`);
  console.log(`NEXT: ${next}`);
  server.kill();
  process.exit(code);
};

let up = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(BASE);
    if (r.ok) { up = true; break; }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!up) await fail('G4-server-up', '200', 'unreachable', 'Vite did not start; run "npx vite probe" manually and read the error', 'package.json', 2);

const modRes = await fetch(`${BASE}/main.ts`);
const ctype = modRes.headers.get('content-type') || '';
if (!ctype.includes('javascript')) {
  await fail('G4-module-mime', 'text/javascript', ctype, 'Vite served the TS module with a non-JS MIME type; the browser will refuse it', 'probe/index.html', 2);
}
console.log('PASS G4-module-mime');

const browser = await chromium.launch({ headless: profile.headless, args: profile.args ?? [] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__PROBE__ === 'function', null, { timeout: 10000 });

if (errors.length > 0) {
  await browser.close();
  await fail('G5-no-errors', '0 errors', `${errors.length}: ${errors[0]}`, 'The probe page threw; fix the reported error before continuing', 'probe/main.ts', 3);
}

const a = await page.evaluate(() => window.__PROBE__());
await new Promise((r) => setTimeout(r, 1000));
const b = await page.evaluate(() => window.__PROBE__());
await browser.close();
server.kill();

if (b.frame - a.frame < 20) {
  await fail('G5-loop-advancing', '>=20 frames/sec', `${b.frame - a.frame}`, 'requestAnimationFrame is not advancing; the render loop is stalled', 'probe/main.ts', 3);
}
if (b.p99 <= 0.06) {
  await fail('G5-not-black', 'p99 luma > 0.06', b.p99.toFixed(4), 'The canvas is rendering but every pixel is near-black', 'probe/main.ts', 3);
}
if (b.distinctBuckets < 8) {
  await fail('G5-tonal-spread', '>=8 distinct luma buckets', String(b.distinctBuckets), 'The frame is a flat fill, not a rendered scene', 'probe/main.ts', 3);
}
if (Math.abs(b.mean - a.mean) < 1e-6) {
  await fail('G5-motion', 'mean luma changes between samples', 'identical', 'The image is frozen; the cube is not rotating', 'probe/main.ts', 3);
}

console.log('PASS G5-loop-advancing');
console.log('PASS G5-not-black');
console.log('PASS G5-tonal-spread');
console.log('PASS G5-motion');
console.log(`  frames/sec=${b.frame - a.frame} p99=${b.p99.toFixed(4)} buckets=${b.distinctBuckets}`);
process.exit(0);
```

- **Verification:** `node --check test/probes/vite-render-probe.mjs` exits 0.

---

## Task 0.12 — G4 + G5: run the Vite render probe

- **File:** none
- **Action:** run command
- **Preconditions:** Task 0.11 complete
- **Spec:** Run `npm run probe:vite`.
- **Verification:** Output contains all five lines `PASS G4-module-mime`, `PASS G5-loop-advancing`, `PASS G5-not-black`, `PASS G5-tonal-spread`, `PASS G5-motion`, and exit code is 0.

  If the port is already in use, run `pkill -f "vite probe"` once and retry. If it fails a second time, stop and report.

---

## Amendment 1 — Task 0.10 correction (probe/main.ts)

**Why:** dsh ran Task 0.12 and got `FAIL G5-tonal-spread actual=3` — the 64×64 center sample saw only background + one flat cube color (2–3 distinct luma values total). Root cause, confirmed by isolated testing on this machine: `MeshStandardMaterial` lit only by `AmbientLight(0.4)` + `DirectionalLight(2.0)` renders as a near-flat fill on this GPU/ANGLE/Mesa path — the directional term contributes almost nothing next to the ambient term, so a rotating cube's faces barely differ in brightness. This is a real driver/lighting-units quirk, not a probe bug, and it is **not worth chasing right now** — it's tracked as a risk for M10 (see `plan.md`).

The fix is not "make the lighting shade more" — it's "don't make this gate depend on subtle lighting response at all." A vertical gradient background guarantees dozens of distinct luma values regardless of how any material lights, and doubles as the gradient-sky placeholder the original plan always wanted (Phase 1 / M10). This is a genuine design correction to the probe scene, not a threshold change — `distinctBuckets >= 8` stays as specified.

**Redo Task 0.10 with this content instead** (only the background line changes; everything else in the file is unchanged):

```ts
import * as THREE from 'three';

function makeGradientBackground(topHex: number, bottomHex: number): THREE.CanvasTexture {
  const top = new THREE.Color(topHex);
  const bottom = new THREE.Color(bottomHex);
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

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(400, 300);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeGradientBackground(0x87ceeb, 0x0d1420);

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
```

The `window.__PROBE__` function below this (from the original Task 0.10 spec) is unchanged — keep it exactly as already written. **This probe file intentionally has no `src/` imports** — the gradient helper is duplicated inline here rather than shared, to keep `probe/` isolated from the app per the original M0 design.

- **Verification:** `test -f probe/main.ts` exits 0. Then re-run Task 0.12 (`npm run probe:vite`) — expect all five `PASS G4-*`/`PASS G5-*` lines and exit 0.

---

## Milestone Definition of Done

All of the following, in one run:

1. `npm ls three vite typescript @playwright/test --depth=0` — no `UNMET`
2. `npm run probe:webgl:headed` — `PASS G2-headed`, exit 0
3. `npm run probe:webgl:headless` — `PASS G3-headless`, exit 0 (or the documented headed-fallback outcome from Task 0.8)
4. `npm run probe:vite` — all five `PASS` lines, exit 0
5. `test/gl-profile.json` exists and is valid JSON

`probe/` and `test/probes/` are **permanent**. If the real app ever goes black, run these to bisect: they isolate the GPU, the browser, the bundler, and the scene from each other.

**Report on completion:** the contents of `test/gl-profile.json` and the `renderer=` line from G3. Do not begin M1.
