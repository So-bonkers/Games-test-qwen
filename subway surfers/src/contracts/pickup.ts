export type PowerUpType = 'COIN_MAGNET' | 'SUPER_SNEAKERS' | 'JETPACK' | 'HOVERBOARD';

export interface CoinSpec {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface PowerUpSpec {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  z: number;
}
