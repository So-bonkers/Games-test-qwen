import { FIXED_TIMESTEP } from '@/core/GameConfig';
import { debugHook } from '@/core/DebugHook';
import { PlayerController } from '@/core/PlayerController';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputQueue } from '@/input/InputQueue';
import { mulberry32, type Rng } from '@/util/rng';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);
  private readonly player = new PlayerController();

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
    for (const action of actions) this.player.applyAction(action);

    this.player.tick(FIXED_TIMESTEP);
    this.tickCount++;
    this.scene.update(this.player.x, this.player.feetY, this.player.scaleY);

    debugHook.stats.simTick = this.tickCount;
    debugHook.stats.simTime = this.simTime;
    debugHook.player.lane = this.player.lane;
    debugHook.player.x = this.player.x;
    debugHook.player.feetY = this.player.feetY;
    debugHook.player.y = this.scene.placeholder.position.y;
    debugHook.player.elevation = this.player.elevation;
    debugHook.player.velocityY = this.player.velocityY;
    debugHook.player.grounded = this.player.grounded;
  }
}
