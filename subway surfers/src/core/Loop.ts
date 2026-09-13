import { FIXED_TIMESTEP } from '@/core/GameConfig';

const MAX_FRAME_DELTA = 0.25;

export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private paused = false;
  private running = false;

  constructor(
    private readonly onTick: (dt: number) => void,
    private readonly onRender: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    requestAnimationFrame(this.frame);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.accumulator = 0;
    this.lastTime = performance.now() / 1000;
  }

  isPaused(): boolean {
    return this.paused;
  }

  stepTicks(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.onTick(FIXED_TIMESTEP);
    this.onRender();
  }

  private readonly frame = (): void => {
    const now = performance.now() / 1000;
    const delta = Math.min(now - this.lastTime, MAX_FRAME_DELTA);
    this.lastTime = now;

    if (!this.paused) {
      this.accumulator += delta;
      while (this.accumulator >= FIXED_TIMESTEP) {
        this.onTick(FIXED_TIMESTEP);
        this.accumulator -= FIXED_TIMESTEP;
      }
      this.onRender();
    }

    requestAnimationFrame(this.frame);
  };
}
