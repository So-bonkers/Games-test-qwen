/**
 * Test Harness — loads the game in a headless browser, captures errors,
 * takes a screenshot, and reports findings.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

async function run() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('=== SUBWAY SURFERS TEST HARNESS ===\n');

  // ── Step 1: Quick HTTP check before launching browser ──────
  console.log('[1] Checking dev server HTTP responses...');
  const assets = [
    '/',
    '/src/main.ts',
    '/src/style.css',
    '/node_modules/three/build/three.module.js',
    '/node_modules/three/examples/jsm/loaders/GLTFLoader.js',
    '/node_modules/three/examples/jsm/loaders/DRACOLoader.js',
  ];

  for (const asset of assets) {
    try {
      const resp = await fetch(URL + asset);
      const status = resp.status;
      const size = (await resp.arrayBuffer()).byteLength;
      const ok = status === 200 ? '✅' : '❌';
      console.log(`    ${ok} ${asset.padEnd(55)} ${status} (${size.toLocaleString()} bytes)`);
    } catch (err) {
      console.log(`    ❌ ${asset.padEnd(55)} FAILED: ${err.message}`);
    }
  }

  // ── Step 2: Launch headless browser ────────────────────────
  console.log('\n[2] Launching headless Chromium...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage();
  const errors = [];
  const consoleLogs = [];

  // Collect console messages and JS errors
  page.on('console', (msg) => {
    const text = `${msg.type().padEnd(8)} ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      errors.push(text);
      console.log(`    ❌ CONSOLE ERROR: ${msg.text()}`);
    } else if (msg.type() === 'log') {
      // Only print Game-related logs
      if (msg.text().includes('[Game]')) {
        console.log(`    🟢 ${msg.text()}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    const msg = `PAGE ERROR: ${err.message}`;
    errors.push(msg);
    console.log(`    ❌ ${msg}`);
  });

  // ── Step 3: Navigate to the page ───────────────────────────
  console.log('\n[3] Navigating to ' + URL + '...');
  try {
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('    ✅ Page loaded successfully');
  } catch (err) {
    console.log(`    ⚠️  Navigation timeout/warning: ${err.message}`);
  }

  // Wait a bit for any deferred rendering
  await page.waitForTimeout(3000);

  // ── Step 4: Check canvas ───────────────────────────────────
  console.log('\n[4] Checking canvas element...');
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { exists: false };
    return {
      exists: true,
      width: canvas.width,
      height: canvas.height,
      displayWidth: canvas.clientWidth,
      displayHeight: canvas.clientHeight,
      styleDisplay: canvas.style.display,
      hasWebGL: !!canvas.getContext('webgl2') || !!canvas.getContext('webgl'),
    };
  });

  console.log(`    Canvas exists: ${canvasInfo.exists}`);
  if (canvasInfo.exists) {
    console.log(`    Dimensions: ${canvasInfo.width}x${canvasInfo.height}`);
    console.log(`    Display size: ${canvasInfo.displayWidth}x${canvasInfo.displayHeight}`);
    console.log(`    WebGL context: ${canvasInfo.hasWebGL ? '✅ Yes' : '❌ No'}`);
  }

  // ── Step 5: Check for debug cube (confirms rendering) ──────
  console.log('\n[5] Checking for debug elements...');
  const debugCube = await page.evaluate(() => {
    const cubes = document.querySelectorAll('[class*=""]');
    // Check if there's a red element visible (our debug cube is in the scene, not DOM)
    // Instead check the debug overlay
    const hud = document.querySelector('div[style*="absolute"][style*="monospace"]');
    return {
      hud: hud ? true : false,
      hudText: hud ? hud.textContent : null,
    };
  });

  console.log(`    Debug HUD visible: ${debugCube.hud}`);
  if (debugCube.hudText) {
    console.log(`    HUD text: "${debugCube.hudText}"`);
  }

  // ── Step 6: Check scene objects via injected script ────────
  console.log('\n[6] Checking Three.js scene...');
  const sceneInfo = await page.evaluate(() => {
    // We need to access the game instance
    // Since we can't easily access it, let's check if WebGL is rendering anything
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'No WebGL context' };

    // Check for drawn triangles and frames
    return {
      drawCalls: gl.getParameter(gl.FRAMEBUFFER_BINDING),
      width: canvas.width,
      height: canvas.height,
    };
  });

  console.log(`    Scene info: ${JSON.stringify(sceneInfo)}`);

  // ── Step 7: Take screenshot ────────────────────────────────
  const screenshotPath = path.join(OUTPUT_DIR, 'screenshot.png');
  console.log('\n[7] Taking screenshot...');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`    Saved to: ${screenshotPath}`);

  // ── Step 8: Print all console output ───────────────────────
  console.log('\n[8] Full console output:');
  for (const log of consoleLogs) {
    console.log(`    ${log}`);
  }

  // ── Summary ────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  if (errors.length === 0) {
    console.log('✅ No errors detected!');
  } else {
    console.log(`❌ ${errors.length} error(s) found:`);
    for (const err of errors) {
      console.log(`   - ${err}`);
    }
  }

  if (!canvasInfo.exists) {
    console.log('⚠️  Canvas element not found in DOM');
  } else if (!canvasInfo.hasWebGL) {
    console.log('⚠️  WebGL context NOT available — this is why the screen is black');
  } else if (canvasInfo.width === 0 || canvasInfo.height === 0) {
    console.log('⚠️  Canvas has 0 dimensions — renderer can\'t draw anything');
  }

  // ── Cleanup ────────────────────────────────────────────────
  await browser.close();
  console.log('\nDone. Check the screenshot at:', screenshotPath);
}

run().catch((err) => {
  console.error('Harness failed:', err);
  process.exit(1);
});
