import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4173';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=gl', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__GAME__?.stats.luma.distinctBuckets > 0);

// Compare readPixels results across two frames vs the actual animation
const cmp = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas');
  // get the context three is using (it's already webgl2)
  const gl = canvas.getContext('webgl2');
  const W = canvas.width, H = canvas.height;
  const w = 64, h = 64;
  const x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
  function read() {
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126*px[i] + 0.7152*px[i+1] + 0.0722*px[i+2];
    return { mean: sum / (w*h), first: [px[0], px[1], px[2]], mid: [px[(w*h*4)/2], px[(w*h*4)/2+1], px[(w*h*4)/2+2]] };
  }
  const a = read();
  await new Promise(r => setTimeout(r, 300));
  const b = read();
  return { a, b, gameLuma: window.__GAME__.stats.luma, frame: window.__GAME__.stats.frame };
});
console.log(JSON.stringify(cmp, null, 2));
await browser.close();
process.exit(0);
