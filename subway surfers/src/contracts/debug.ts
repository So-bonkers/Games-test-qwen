import type { Elevation } from '@/contracts/elevation';
import type { ObstacleType } from '@/contracts/obstacle';

export interface LumaStats {
  mean: number;
  p99: number;
  distinctBuckets: number;
}

export interface DebugEvent {
  tick: number;
  type: 'collision' | 'land' | 'dismount' | 'coin' | 'spawnRow' | 'gameover';
  data: Record<string, number | string>;
}

export interface DebugObstacle {
  id: number;
  type: ObstacleType;
  lane: 0 | 1 | 2;
  z: number;
  topY: number | null;
  zRange: [number, number];
  relativeSpeed: number;
}

export interface DebugHook {
  version: 1;
  state: 'menu' | 'playing' | 'gameover';
  stats: {
    frame: number;
    simTick: number;
    simTime: number;
    drawCalls: number;
    triangles: number;
    luma: LumaStats;
  };
  player: {
    lane: 0 | 1 | 2;
    x: number;
    y: number;
    feetY: number;
    elevation: Elevation;
    velocityY: number;
    grounded: boolean;
  };
  world: { speed: number; distance: number; score: number; coins: number };
  pool: { obstaclesActive: number; obstaclesFree: number; chunksActive: number };
  obstacles(): DebugObstacle[];
  events: DebugEvent[];
  seed(n: number): void;
  setPaused(paused: boolean): void;
  step(ticks: number): void;
  enqueue(inputs: Array<'left' | 'right' | 'jump' | 'slide'>): void;
}
