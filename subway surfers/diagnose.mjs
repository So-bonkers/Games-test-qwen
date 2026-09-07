/**
 * Lightweight diagnostic — checks all assets the game loads via HTTP,
 * reports errors, CSP issues, and common failure modes.
 */

const BASE = 'http://localhost:5173';

// ── Asset URLs to check ────────────────────────────────────────
const ASSETS = [
  { path: '/', desc: 'HTML page' },
  { path: '/src/main.ts', desc: 'Entry point (TS)' },
  { path: '/src/style.css', desc: 'Stylesheet' },
  { path: '/src/core/Game.ts', desc: 'Game engine' },
  { path: '/src/core/GameConfig.ts', desc: 'Game config' },
  { path: '/src/core/AssetManager.ts', desc: 'Asset manager' },
  { path: '/src/entities/Player.ts', desc: 'Player entity' },
  { path: '/src/input/InputSystem.ts', desc: 'Input system' },
  { path: '/src/types/index.ts', desc: 'Type definitions' },
  { path: '/node_modules/three/build/three.module.js', desc: 'Three.js core' },
  { path: '/node_modules/three/examples/jsm/loaders/GLTFLoader.js', desc: 'GLTF loader' },
  { path: '/node_modules/three/examples/jsm/loaders/DRACOLoader.js', desc: 'Draco loader' },
  { path: '/@vite/client', desc: 'Vite HMR client' },
];

// ── Check for common failure patterns in JS responses ──────────
function analyzeJS(content, url) {
  const issues = [];

  // Check for syntax errors (very basic — looks for obvious patterns)
  if (content.includes('Uncaught ReferenceError') || content.includes('TypeError:')) {
    issues.push('Contains error text in source');
  }

  // Check for import resolution failures
  if (/import\s+.*from\s+['"]\/@fs\//.test(content)) {
    issues.push('Has /@fs/ path (Vite alias issue)');
  }

  // Check for empty/minimal content that suggests failed load
  if (content.length < 50 && !content.includes('<!DOCTYPE')) {
    issues.push('Content too short — may be a 404 page or error response');
  }

  // Check for HTML in JS file (suggests wrong MIME type)
  if (content.trim().startsWith('<') && content.includes('DOCTYPE')) {
    issues.push('JS file returned HTML — possible MIME type issue');
  }

  return issues;
}

async function checkAsset(asset) {
  try {
    const resp = await fetch(BASE + asset.path, {
      headers: { 'Accept': '*/*' },
    });

    const contentType = resp.headers.get('content-type') || '(none)';
    const body = await resp.text();
    const size = new TextEncoder().encode(body).byteLength;

    let status = '✅';
    let issues = [];

    if (resp.status !== 200) {
      status = '❌';
      issues.push(`HTTP ${resp.status}`);
    }

    // Check JS files for issues
    if (asset.path.endsWith('.ts') || asset.path.endsWith('.js')) {
      const jsIssues = analyzeJS(body, asset.path);
      if (jsIssues.length > 0) {
        status = '⚠️';
        issues.push(...jsIssues);
      }
    }

    // Check HTML for script errors
    if (asset.path === '/' && body.includes('<script')) {
      const scripts = [...body.matchAll(/<script[^>]*src=["']([^"']+)["']/g)];
      if (scripts.length > 0) {
        issues.push(`Scripts: ${scripts.map(s => s[1]).join(', ')}`);
      }
    }

    // Check for CSP headers that might block execution
    const csp = resp.headers.get('content-security-policy');
    if (csp && csp.includes('unsafe-inline') === false) {
      issues.push(`CSP: ${csp.substring(0, 80)}...`);
    }

    return {
      ...asset,
      status,
      size,
      contentType,
      issues,
    };
  } catch (err) {
    return {
      ...asset,
      status: '❌',
      size: 0,
      contentType: '(error)',
      issues: [err.message],
    };
  }
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('=== SUBWAY SURFERS DIAGNOSTIC ===\n');
  console.log(`Target: ${BASE}\n`);

  const results = await Promise.all(ASSETS.map(a => checkAsset(a)));

  let hasErrors = false;
  for (const r of results) {
    const sizeStr = r.size > 1024 * 1024
      ? `${(r.size / 1024 / 1024).toFixed(1)}MB`
      : r.size > 1024
        ? `${(r.size / 1024).toFixed(1)}KB`
        : `${r.size}B`;

    console.log(`${r.status} ${r.path.padEnd(55)} ${sizeStr.padEnd(12)} ${r.contentType.split(';')[0]}`);

    if (r.issues.length > 0) {
      hasErrors = true;
      for (const issue of r.issues) {
        console.log(`     ↳ ⚠️ ${issue}`);
      }
    }
  }

  // ── Additional checks ────────────────────────────────────────
  console.log('\n=== ADDITIONAL CHECKS ===\n');

  // Check if the HTML references the correct entry point
  const htmlResp = await fetch(BASE + '/');
  const html = await htmlResp.text();

  const hasAppDiv = html.includes('id="app"');
  const hasModuleScript = html.includes('type="module"') && html.includes('src="/src/main.ts"');

  console.log(`#app div in HTML: ${hasAppDiv ? '✅' : '❌'}`);
  console.log(`Module script tag: ${hasModuleScript ? '✅' : '❌'}`);

  // Check if the CSS has canvas styles
  const cssResp = await fetch(BASE + '/src/style.css');
  const css = await cssResp.text();

  const hasCanvasDisplay = css.includes('display') && (css.includes('block') || css.includes('none'));
  const hasOverflowHidden = css.includes('overflow: hidden');
  const hasTouchAction = css.includes('touch-action');

  console.log(`\nCSS - canvas display rule: ${hasCanvasDisplay ? '✅' : '❌'}`);
  console.log(`CSS - overflow hidden: ${hasOverflowHidden ? '✅' : '❌'}`);
  console.log(`CSS - touch-action: none: ${hasTouchAction ? '✅' : '❌'}`);

  // Check for common Three.js issues in the Game.ts source
  const gameResp = await fetch(BASE + '/src/core/Game.ts');
  const gameSrc = await gameResp.text();

  console.log('\n=== CODE CHECKS ===\n');

  // Check that Game.ts imports correctly
  const hasThreeImport = gameSrc.includes("from 'three'") || gameSrc.includes('from "three"');
  const hasPlayerImport = gameSrc.includes('@/entities/Player') || gameSrc.includes('"@/entities/Player"');
  const hasInputImport = gameSrc.includes('@/input/InputSystem') || gameSrc.includes('"@/input/InputSystem"');

  console.log(`Game.ts imports THREE: ${hasThreeImport ? '✅' : '❌'}`);
  console.log(`Game.ts imports Player: ${hasPlayerImport ? '✅' : '❌'}`);
  console.log(`Game.ts imports InputSystem: ${hasInputImport ? '✅' : '❌'}`);

  // Check for canvas texture creation (needs browser context)
  const hasCanvasEl = gameSrc.includes("document.createElement('canvas')");
  console.log(`Game.ts creates canvas element: ${hasCanvasEl ? '✅' : '⚠️ No — might cause issues'}`);

  // Check if GameConfig imports PowerUpType (the bug we just fixed)
  const configResp = await fetch(BASE + '/src/core/GameConfig.ts');
  const configSrc = await configResp.text();
  const hasPowerUpImport = configSrc.includes("from '@/types'");
  console.log(`GameConfig.ts imports PowerUpType: ${hasPowerUpImport ? '✅' : '❌ MISSING — will crash!'}`);

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===\n');
  if (hasErrors) {
    console.log('⚠️  ISSUES FOUND — check the lines above for details.');
    console.log('\nCommon causes of a black screen:');
    console.log('  1. WebGL not supported by the browser');
    console.log('  2. Canvas has 0x0 dimensions');
    console.log('  3. JS errors preventing scene creation');
    console.log('  4. CSP headers blocking module execution');
    console.log('  5. Renderer failed to create WebGL context');
  } else {
    console.log('✅ All assets loaded successfully. If the screen is still black,');
    console.log('   the issue is likely WebGL-related (browser support, GPU driver, etc.)');
  }
}

main().catch(err => {
  console.error('Diagnostic failed:', err.message);
  process.exit(1);
});
