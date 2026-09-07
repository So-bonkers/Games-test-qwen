// ─── Game States ───────────────────────────────────────────────
export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

// ─── Lane System ───────────────────────────────────────────────
export const enum Lane {
  Left = 0,
  Center = 1,
  Right = 2,
}

// ─── Entity Types ──────────────────────────────────────────────
export const enum EntityType {
  Player = 'player',
  Obstacle = 'obstacle',
  Coin = 'coin',
  PowerUp = 'powerup',
}

// ─── Obstacle Types ────────────────────────────────────────────
export const enum ObstacleType {
  LowBarrier = 'low_barrier',    // Requires jump
  HighBarrier = 'high_barrier',  // Requires slide
  FullBlock = 'full_block',      // Requires lane switch (train)
}

// ─── Power-Up Types ────────────────────────────────────────────
export const enum PowerUpType {
  CoinMagnet = 'coin_magnet',
  SuperSneakers = 'super_sneakers',
  Jetpack = 'jetpack',
  Hoverboard = 'hoverboard',
  Multiplier = 'multiplier',
}

// ─── Player State ──────────────────────────────────────────────
export const enum PlayerState {
  Running = 'running',
  Jumping = 'jumping',
  Sliding = 'sliding',
  Crashing = 'crashing',
  Jetpacking = 'jetpacking',
}

// ─── Rideable Train (ramp trains — run on top) ─────────────────
export interface RideTarget {
  x: number;          // train center X (lane position)
  frontZ: number;     // Z of the ramp's low end (front, player-facing side)
  rearZ: number;      // Z of the train's rear end
  roofY: number;      // height to ride at on the roof
  rampLength: number; // length of the sloped section (from frontZ)
}

// ─── Input Events ──────────────────────────────────────────────
export const enum InputDirection {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down',
}

// ─── Power-Up Data Schema ──────────────────────────────────────
export interface PowerUpConfig {
  type: PowerUpType;
  duration: number;    // seconds
  icon: string;        // emoji or CSS class
  color: string;       // visual indicator color
}

// ─── Obstacle Config ───────────────────────────────────────────
export interface ObstacleConfig {
  type: ObstacleType;
  lane: Lane;
  height: number;      // world units
  width: number;       // world units (along Z)
  color: number;       // hex color
}

// ─── Score Data ────────────────────────────────────────────────
export interface ScoreData {
  highScore: number;
  totalCoins: number;
  gamesPlayed: number;
}

// ─── Spawnable Entity (generic) ────────────────────────────────
export interface SpawnConfig {
  zPosition: number;
  lane: Lane;
  type: EntityType | ObstacleType | PowerUpType;
}
