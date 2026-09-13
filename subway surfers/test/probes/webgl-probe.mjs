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
