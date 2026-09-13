import { expect, test } from '@playwright/test';

test.describe('deterministic loop', () => {
  test('step(120) advances simTime by one second', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      const before = window.__GAME__.stats.simTime;
      window.__GAME__.step(120);
      return { before, after: window.__GAME__.stats.simTime };
    });

    expect(Math.abs(result.after - result.before - 1)).toBeLessThan(1e-9);
  });

  test('paused loop does not advance on its own', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.evaluate(() => window.__GAME__.setPaused(true));
    const a = await page.evaluate(() => window.__GAME__.stats.simTick);
    await page.waitForTimeout(300);
    const b = await page.evaluate(() => window.__GAME__.stats.simTick);

    expect(b).toBe(a);
  });

  test('enqueued input is applied on the next tick', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const lane = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['left']);
      window.__GAME__.step(1);
      return window.__GAME__.player.lane;
    });

    expect(lane).toBe(0);
  });

  test('a real keydown reaches the input queue', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.evaluate(() => window.__GAME__.setPaused(true));
    await page.keyboard.press('ArrowRight');
    const lane = await page.evaluate(() => {
      window.__GAME__.step(1);
      return window.__GAME__.player.lane;
    });

    expect(lane).toBe(2);
  });
});
