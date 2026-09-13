import {
  COIN_COLLECT_RADIUS_X,
  COIN_COLLECT_RADIUS_Y,
  COIN_COLLECT_RADIUS_Z,
  MAGNET_PULL_SPEED,
  MAGNET_RADIUS,
  POWERUP_PICKUP_RADIUS,
} from '@/core/GameConfig';
import type { CoinSpec, PowerUpSpec } from '@/contracts/pickup';

export function applyMagnetPull(coins: CoinSpec[], playerX: number, worldDistance: number, dt: number): void {
  for (const c of coins) {
    const dx = playerX - c.x;
    const dz = worldDistance - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0 && dist < MAGNET_RADIUS) {
      const pull = Math.min(1, (MAGNET_PULL_SPEED * dt) / dist);
      c.x += dx * pull;
      c.z += dz * pull;
    }
  }
}

export function collectCoins(
  coins: CoinSpec[],
  playerX: number,
  worldDistance: number,
  playerFeetY: number,
  playerScaleY: number,
): CoinSpec[] {
  const collected: CoinSpec[] = [];
  const feetTop = playerFeetY + 1.8 * playerScaleY;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const withinX = Math.abs(playerX - c.x) < COIN_COLLECT_RADIUS_X;
    const withinZ = Math.abs(worldDistance - c.z) < COIN_COLLECT_RADIUS_Z;
    const withinY = c.y > playerFeetY - COIN_COLLECT_RADIUS_Y && c.y < feetTop + COIN_COLLECT_RADIUS_Y;
    if (withinX && withinZ && withinY) {
      collected.push(c);
      coins.splice(i, 1);
    }
  }
  return collected;
}

export function collectPowerUp(
  powerUps: PowerUpSpec[],
  playerX: number,
  worldDistance: number,
): PowerUpSpec | null {
  for (let i = 0; i < powerUps.length; i++) {
    const p = powerUps[i];
    if (
      Math.abs(playerX - p.x) < POWERUP_PICKUP_RADIUS &&
      Math.abs(worldDistance - p.z) < POWERUP_PICKUP_RADIUS
    ) {
      powerUps.splice(i, 1);
      return p;
    }
  }
  return null;
}
