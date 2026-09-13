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
