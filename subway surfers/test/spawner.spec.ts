import { expect, test } from '@playwright/test';

test.describe('procedural spawner', () => {
  test('rows are solvable by construction: at most one TRAIN per row, always centered', async ({ page }) => {
    await page.goto('/?fixture=procedural');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const obstacles = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(7);
      window.__GAME__.step(1500);
      return window.__GAME__.obstacles();
    });

    expect(obstacles.length).toBeGreaterThan(0);

    const trains = obstacles.filter((o) => o.type === 'TRAIN');
    for (const t of trains) {
      expect(t.lane).toBe(1);
    }

    const byZ = new Map<number, number>();
    for (const t of trains) {
      const bucket = Math.round(t.z);
      byZ.set(bucket, (byZ.get(bucket) ?? 0) + 1);
    }
    for (const count of byZ.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test('pool size never grows once obstacles are recycling', async ({ page }) => {
    await page.goto('/?fixture=procedural');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(3);
      window.__GAME__.step(600);
      const early = { ...window.__GAME__.pool };
      window.__GAME__.step(2400); // 3000 ticks total = 25s of travel
      const late = { ...window.__GAME__.pool };
      return { early, late };
    });

    const totalEarly = result.early.obstaclesActive + result.early.obstaclesFree;
    const totalLate = result.late.obstaclesActive + result.late.obstaclesFree;
    expect(totalLate).toBe(totalEarly);
    expect(result.late.obstaclesActive).toBeLessThanOrEqual(totalLate);
  });
});
