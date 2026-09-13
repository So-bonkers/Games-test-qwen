import { BASE_SPEED, COIN_VALUE, DISTANCE_SCORE_MULTIPLIER, FIXED_TIMESTEP } from '@/core/GameConfig';
import { debugHook, pushDebugEvent } from '@/core/DebugHook';
import { PlayerController } from '@/core/PlayerController';
import { M4_SURFACES } from '@/fixtures/m4Track';
import { findFatalCollision, playerBox } from '@/core/Collision';
import { applyMagnetPull, collectCoins, collectPowerUp } from '@/core/Pickups';
import { Spawner } from '@/spawner/Spawner';
import type { ObstacleSpec } from '@/contracts/obstacle';
import type { PowerUpType } from '@/contracts/pickup';
import type { SceneRoot } from '@/core/SceneRoot';
import type { InputQueue } from '@/input/InputQueue';
import { mulberry32, type Rng } from '@/util/rng';
import { CRASH_CLIP_BY_OBSTACLE_TYPE } from '@/core/CharacterRig';

const HIGH_SCORE_KEY = 'subway-surfers-high-score';

export class Sim {
  private tickCount = 0;
  rng: Rng = mulberry32(1);
  private readonly player = new PlayerController();
  private readonly spawner: Spawner;
  private currentObstacles: ObstacleSpec[] = [];

  constructor(
    private readonly scene: SceneRoot,
    private readonly input: InputQueue,
    private readonly staticObstacles: ObstacleSpec[],
    private readonly useProcedural: boolean,
  ) {
    this.spawner = new Spawner(scene.scene);
    debugHook.obstacles = () =>
      this.currentObstacles.map((o) => ({
        id: o.id,
        type: o.type,
        lane: o.lane,
        z: o.bounds.z,
        topY: o.landableSurfaces[0]?.topY ?? null,
        zRange: [o.bounds.z - o.bounds.hz, o.bounds.z + o.bounds.hz] as [number, number],
        relativeSpeed: o.relativeSpeed,
      }));
  }

  setSeed(seed: number): void {
    this.rng = mulberry32(seed);
    this.tickCount = 0;
    debugHook.world.speed = 0;
    debugHook.world.distance = 0;
    debugHook.world.score = 0;
    debugHook.world.coins = 0;
    debugHook.events = [];
    debugHook.state = 'playing';
  }

  grantPowerUp(type: PowerUpType): void {
    this.player.grantPowerUp(type);
  }

  spawnTestCoin(x: number, y: number, z: number): void {
    this.spawner.addTestCoin(x, y, z);
  }

  get simTime(): number {
    return this.tickCount * FIXED_TIMESTEP;
  }

  tick(): void {
    if (debugHook.state === 'gameover') return;

    const actions = this.input.drain();
    for (const action of actions) this.player.applyAction(action);

    this.tickCount++;
    debugHook.world.speed = BASE_SPEED;
    debugHook.world.distance += BASE_SPEED * FIXED_TIMESTEP;

    if (this.useProcedural) this.spawner.update(FIXED_TIMESTEP, debugHook.world.distance, this.rng);

    this.currentObstacles = this.useProcedural ? this.spawner.activeObstacles() : this.staticObstacles;
    const surfaces = this.useProcedural
      ? this.currentObstacles.flatMap((o) => o.landableSurfaces)
      : M4_SURFACES;

    this.player.tick(FIXED_TIMESTEP, this.tickCount, debugHook.world.distance, surfaces);
    this.scene.update(
      this.player.x,
      this.player.feetY,
      this.player.scaleY,
      this.player.animState,
      FIXED_TIMESTEP,
      debugHook.world.distance,
    );

    if (this.player.magnetTimer > 0) {
      applyMagnetPull(this.spawner.activeCoins(), this.player.x, debugHook.world.distance, FIXED_TIMESTEP);
    }
    const collectedCoins = collectCoins(
      this.spawner.activeCoins(),
      this.player.x,
      debugHook.world.distance,
      this.player.feetY,
      this.player.scaleY,
    );
    for (const c of collectedCoins) {
      this.spawner.releaseCoin(c.id);
      debugHook.world.coins++;
      pushDebugEvent(this.tickCount, 'coin', { coinId: c.id });
    }

    const collectedPowerUp = collectPowerUp(
      this.spawner.activePowerUps(),
      this.player.x,
      debugHook.world.distance,
    );
    if (collectedPowerUp) {
      this.spawner.releasePowerUp(collectedPowerUp.id);
      this.player.grantPowerUp(collectedPowerUp.type);
      pushDebugEvent(this.tickCount, 'powerUp', { powerUpType: collectedPowerUp.type });
    }

    debugHook.stats.simTick = this.tickCount;
    debugHook.stats.simTime = this.simTime;
    debugHook.player.lane = this.player.lane;
    debugHook.player.x = this.player.x;
    debugHook.player.feetY = this.player.feetY;
    debugHook.player.y = this.scene.placeholder.position.y;
    debugHook.player.elevation = this.player.elevation;
    debugHook.player.velocityY = this.player.velocityY;
    debugHook.player.grounded = this.player.grounded;
    debugHook.player.animState = this.player.animState;
    debugHook.world.score =
      Math.floor(debugHook.world.distance * DISTANCE_SCORE_MULTIPLIER) + debugHook.world.coins * COIN_VALUE;

    debugHook.powerUp.magnetRemaining = this.player.magnetTimer;
    debugHook.powerUp.sneakersRemaining = this.player.sneakersTimer;
    debugHook.powerUp.jetpackRemaining = this.player.jetpackTimer;
    debugHook.powerUp.hoverboardCharges = this.player.hoverboardCharges;

    if (this.useProcedural) {
      const stats = this.spawner.poolStats;
      debugHook.pool.obstaclesActive = stats.active;
      debugHook.pool.obstaclesFree = stats.free;
    }

    if (!this.player.invulnerable) {
      const pBox = playerBox(this.player.x, this.player.feetY, debugHook.world.distance, this.player.scaleY);
      const hit = findFatalCollision(pBox, this.currentObstacles, this.player.onSurfaceOwnerId);
      if (hit) {
        if (this.player.hoverboardCharges > 0) {
          this.player.consumeHoverboard();
          pushDebugEvent(this.tickCount, 'hoverboardSave', { obstacleId: hit.id });
        } else {
          this.player.animState = CRASH_CLIP_BY_OBSTACLE_TYPE[hit.type];
          debugHook.player.animState = this.player.animState;
          pushDebugEvent(this.tickCount, 'collision', { obstacleId: hit.id, elevation: this.player.elevation });
          debugHook.state = 'gameover';
          pushDebugEvent(this.tickCount, 'gameover', { score: debugHook.world.score, cause: 'collision' });

          const stored = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? '0');
          if (debugHook.world.score > stored) {
            localStorage.setItem(HIGH_SCORE_KEY, String(debugHook.world.score));
          }
        }
      }
    }
  }
}
