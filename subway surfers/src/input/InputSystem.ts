/**
 * InputSystem — unified keyboard + touch input handler.
 * Normalizes all player input into directional events consumed by the game loop.
 */

// ─── Input Events ──────────────────────────────────────────────
export type InputEvent =
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'up' }
  | { type: 'down' };

/** Swipe threshold in pixels */
const SWIPE_THRESHOLD = 30;
/** Maximum time to register a swipe (ms) */
const SWIPE_MAX_TIME = 500;

export class InputSystem {
  private listeners: Set<(event: InputEvent) => void> = new Set();
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private isSwiping = false;

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
  }

  // ─── Keyboard ──────────────────────────────────────────────
  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      const event = this.keyToEvent(e.key);
      if (event) {
        e.preventDefault();
        this.dispatch(event);
      }
    });
  }

  private keyToEvent(key: string): InputEvent | null {
    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return { type: 'left' };
      case 'ArrowRight':
      case 'd':
      case 'D':
        return { type: 'right' };
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        return { type: 'up' };
      case 'ArrowDown':
      case 's':
      case 'S':
        return { type: 'down' };
      default:
        return null;
    }
  }

  // ─── Touch / Swipe ─────────────────────────────────────────
  private setupTouch(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = Date.now();
      this.isSwiping = true;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (!this.isSwiping) return;
      this.isSwiping = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;
      const elapsed = Date.now() - this.touchStartTime;

      if (elapsed > SWIPE_MAX_TIME) return; // Too slow

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Determine dominant axis
      if (absDx > absDy && absDx > SWIPE_THRESHOLD) {
        this.dispatch(dx > 0 ? { type: 'right' } : { type: 'left' });
      } else if (absDy > SWIPE_THRESHOLD) {
        this.dispatch(dy < 0 ? { type: 'up' } : { type: 'down' });
      }
    }, { passive: true });
  }

  // ─── Event Dispatch ────────────────────────────────────────
  public subscribe(listener: (event: InputEvent) => void): void {
    this.listeners.add(listener);
  }

  public unsubscribe(listener: (event: InputEvent) => void): void {
    this.listeners.delete(listener);
  }

  private dispatch(event: InputEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────
  public destroy(): void {
    this.listeners.clear();
  }
}
