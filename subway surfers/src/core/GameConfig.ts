export const LANE_POSITIONS = [-3, 0, 3] as const;
export const LANE_WIDTH = 2.5;

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.8;
export const PLAYER_DEPTH = 0.6;
export const PLAYER_SLIDE_SCALE = 0.5;

export const PLATFORM_HEIGHT = 1.0;

export const TRAIN_LENGTH = 9;
export const TRAIN_ROOF_HEIGHT = 2.5;
export const RAMP_LENGTH = 3.0;
export const FAST_TRAIN_EXTRA_SPEED = 10;

export const LERP_SPEED = 12;
export const JUMP_VELOCITY = 9;
export const GRAVITY = -22;
export const FAST_FALL_SPEED = 16;
export const SLIDE_DURATION = 0.6;

export const BASE_SPEED = 14;
export const MAX_SPEED = 28;
export const SPEED_INCREMENT = 0.5;
export const SPEED_INTERVAL = 30;

export const SPAWN_DISTANCE = 120;
export const DESPAWN_DISTANCE = 20;
export const CHUNK_SIZE = 50;
export const MIN_SPAWN_GAP = 12;
export const MAX_SPAWN_GAP = 22;
export const TUNNEL_MIN_GAP = 70;
export const TUNNEL_MAX_GAP = 120;

export const CAMERA_POSITION = { x: 0, y: 5.5, z: -9 } as const;
export const CAMERA_TARGET = { x: 0, y: 1.5, z: 8 } as const;

export const SKY_COLOR = 0x87ceeb;
export const GROUND_COLOR = 0x555555;
export const FOG_COLOR = 0x87ceeb;
export const FOG_NEAR = 60;
export const FOG_FAR = 140;

export const DISTANCE_SCORE_MULTIPLIER = 1;
export const COIN_VALUE = 10;

export const FIXED_TIMESTEP = 1 / 120;
