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
