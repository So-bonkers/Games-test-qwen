import { FIXED_TIMESTEP } from '@/core/GameConfig';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputAction, InputQueue } from '@/input/InputQueue';
import { debugHook } from '@/core/DebugHook';
import { mulberry32, type Rng } from '@/util/rng';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);

  constructor(
    private readonly scene: SceneRoot,
    private readonly input: InputQueue,
  ) {}

  setSeed(seed: number): void {
    this.rng = mulberry32(seed);
  }

  get simTime(): number {
    return this.tickCount * FIXED_TIMESTEP;
  }

  tick(): void {
    const actions = this.input.drain();
    for (const action of actions) this.applyAction(action);

    this.tickCount++;
    this.scene.update(this.simTime);

    debugHook.stats.simTick = this.tickCount;
    debugHook.stats.simTime = this.simTime;
    debugHook.player.y = this.scene.placeholder.position.y;
  }

  private applyAction(action: InputAction): void {
    if (action === 'left') debugHook.player.lane = Math.max(0, debugHook.player.lane - 1) as 0 | 1 | 2;
    if (action === 'right') debugHook.player.lane = Math.min(2, debugHook.player.lane + 1) as 0 | 1 | 2;
  }
}
