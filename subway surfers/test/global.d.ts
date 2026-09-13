import type { DebugHook } from '@/contracts/debug';

declare global {
  interface Window {
    __GAME__: DebugHook;
  }
}
