import './style.css';
import { Game } from './core/Game';

// ─── Error Display Overlay ─────────────────────────────────────
function showError(msg: string): void {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    padding: '20px', background: '#300', color: '#f66', fontFamily: 'monospace',
    fontSize: '14px', maxWidth: '80vw', whiteSpace: 'pre-wrap', zIndex: '9999',
    border: '2px solid #f00', borderRadius: '8px', textAlign: 'center',
  });
  el.textContent = `ERROR:\n\n${msg}`;
  document.body.appendChild(el);
}

// ─── Bootstrap ─────────────────────────────────────────────────
try {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found in DOM');
  console.log('[Boot] Creating Game...');
  const game = new Game(app);
  game.start();
  console.log('[Boot] Game started! Lane positions: [-3, 0, 3]');
  console.log('[Boot] Press ←/→ to switch lanes (← should move LEFT on screen)');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  showError(msg);
  console.error('Game init failed:', err);
}
