import { expect, test } from '@playwright/test';

test.describe('coins and power-ups', () => {
  test('coin magnet pulls an out-of-range coin in', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const coinsCollected = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      const px = window.__GAME__.player.x;
      window.__GAME__.spawnTestCoin(px + 4, 0.75, window.__GAME__.world.distance);
      window.__GAME__.grantPowerUp('COIN_MAGNET');
      window.__GAME__.step(150);
      return window.__GAME__.world.coins;
    });

    expect(coinsCollected).toBe(1);
  });

  test('super sneakers roughly doubles jump height at the same tick', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const feetY = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.grantPowerUp('SUPER_SNEAKERS');
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(60);
      return window.__GAME__.player.feetY;
    });

    expect(Math.abs(feetY - 3.9541666667)).toBeLessThan(1e-6);
  });

  test('jetpack hovers at a fixed height and ends with a normal fall', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.grantPowerUp('JETPACK');
      window.__GAME__.step(1);
      const duringFeetY = window.__GAME__.player.feetY;
      const duringElevation = window.__GAME__.player.elevation;
      window.__GAME__.step(950); // just past the 8s (960-tick) duration
      const afterExpiry = window.__GAME__.player.feetY;
      window.__GAME__.step(200); // let the fall complete
      const grounded = window.__GAME__.player.feetY === 0;
      return { duringFeetY, duringElevation, afterExpiry, grounded };
    });

    expect(result.duringFeetY).toBe(3.2);
    expect(result.duringElevation).toBe('AIRBORNE');
    expect(result.grounded).toBe(true);
  });

  test('hoverboard converts a fatal hit into survival', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.grantPowerUp('HOVERBOARD');
      window.__GAME__.step(200);
      return {
        state: window.__GAME__.state,
        hoverboardCharges: window.__GAME__.powerUp.hoverboardCharges,
        events: window.__GAME__.events,
      };
    });

    expect(result.state).toBe('playing');
    expect(result.hoverboardCharges).toBe(0);
    expect(result.events.some((e: { type: string }) => e.type === 'hoverboardSave')).toBe(true);
    expect(result.events.some((e: { type: string }) => e.type === 'collision')).toBe(false);
  });

  test('score includes the coin bonus on top of the distance score', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const score = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      const px = window.__GAME__.player.x;
      window.__GAME__.spawnTestCoin(px, 0.75, window.__GAME__.world.distance);
      window.__GAME__.step(120);
      return { score: window.__GAME__.world.score, coins: window.__GAME__.world.coins };
    });

    expect(score.coins).toBe(1);
    expect(score.score).toBe(14 + 10); // distance term unchanged from M5's verified 14, plus one COIN_VALUE
  });
});
