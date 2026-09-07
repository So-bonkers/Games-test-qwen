// ─── Game Configuration Constants ──────────────────────────────
import { PowerUpType } from '@/types';

/** Lane positions (X-axis) */
export const LANE_POSITIONS = [-3, 0, 3] as const;

/** Lane width for collision bounds */
export const LANE_WIDTH = 2.5;

/** Player dimensions */
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.8;
export const PLAYER_DEPTH = 0.6;
export const PLAYER_SLIDE_SCALE = 0.5; // Y-axis scale when sliding

/** Platforms (outer lanes are elevated walkways, center lane stays as track) */
export const PLATFORM_HEIGHT = 1.0; // Platform top surface above track level

/** Trains */
export const TRAIN_LENGTH = 9;          // Train body length (units)
export const TRAIN_ROOF_HEIGHT = 2.5;   // Ride height on a ramp train's roof
export const RAMP_LENGTH = 3.0;         // Ramp slope length at the train front
export const FAST_TRAIN_EXTRA_SPEED = 10; // Extra speed for express trains (units/sec)

/** Tunnels (full-width gates as landmarks) */
export const TUNNEL_MIN_GAP = 70;
export const TUNNEL_MAX_GAP = 120;

/** Movement settings */
export const LERP_SPEED = 12;       // Lane switch speed (lerp factor per second)
export const JUMP_VELOCITY = 9;     // Initial upward velocity
export const GRAVITY = -22;         // Gravity acceleration
export const FAST_FALL_SPEED = 16;  // Dive-slam: press down in air → fast drop (units/sec)
export const SLIDE_DURATION = 0.6;  // Seconds

/** World movement */
export const BASE_SPEED = 14;       // Starting world speed (units/sec)
export const MAX_SPEED = 28;        // Maximum world speed
export const SPEED_INCREMENT = 0.5; // Speed increase every...
export const SPEED_INTERVAL = 30;   // ...seconds

/** Spawn settings */
export const SPAWN_DISTANCE = 120;  // How far ahead to spawn (units)
export const DESPAWN_DISTANCE = 20; // How far behind to remove (units)
export const CHUNK_SIZE = 50;       // Ground segment length

/** Obstacle spacing */
export const MIN_SPAWN_GAP = 12;    // Minimum distance between obstacles
export const MAX_SPAWN_GAP = 22;    // Maximum distance between obstacles

/** Camera settings */
export const CAMERA_POSITION = { x: 0, y: 5.5, z: -9 };
export const CAMERA_TARGET = { x: 0, y: 1.5, z: 8 };

/** Scene colors */
export const SKY_COLOR = 0x87ceeb;       // Sky blue
export const GROUND_COLOR = 0x555555;    // Dark gray
export const FOG_COLOR = 0x87ceeb;
export const FOG_NEAR = 60;
export const FOG_FAR = 140;

/** Scoring */
export const DISTANCE_SCORE_MULTIPLIER = 1;     // 1 point per meter
export const COIN_VALUE = 10;                   // Score points per coin
export const BASE_MULTIPLIER = 1;               // Default score multiplier

/** Power-Up durations (seconds) */
export const POWER_UP_DURATIONS = {
  [PowerUpType.CoinMagnet]: 8,
  [PowerUpType.SuperSneakers]: 8,
  [PowerUpType.Jetpack]: 4,
  [PowerUpType.Hoverboard]: Infinity, // Lasts until hit
  [PowerUpType.Multiplier]: 10,
};

/** Power-Up visual configs */
export const POWER_UP_COLORS = {
  [PowerUpType.CoinMagnet]: '#ff6b6b',
  [PowerUpType.SuperSneakers]: '#51cf66',
  [PowerUpType.Jetpack]: '#ffd43b',
  [PowerUpType.Hoverboard]: '#74c0fc',
  [PowerUpType.Multiplier]: '#cc5de8',
};

/** Power-Up icons (emoji) */
export const POWER_UP_ICONS = {
  [PowerUpType.CoinMagnet]: '🧲',
  [PowerUpType.SuperSneakers]: '👟',
  [PowerUpType.Jetpack]: '🚀',
  [PowerUpType.Hoverboard]: '🛹',
  [PowerUpType.Multiplier]: '✨',
};
