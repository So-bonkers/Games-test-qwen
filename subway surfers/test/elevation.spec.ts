import { expect, test } from '@playwright/test';

test.describe('elevation state machine', () => {
  test('platform then train-roof ride, ending back on the ground', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(450);
    });

    const result = await page.evaluate(() => ({
      elevation: window.__GAME__.player.elevation,
      feetY: window.__GAME__.player.feetY,
      events: window.__GAME__.events,
    }));

    const order = result.events
      .filter((e) => e.type === 'land' || e.type === 'dismount')
      .map((e) => `${e.type}:${e.data.surfaceKind}`);

    expect(order).toEqual(['land:PLATFORM', 'dismount:PLATFORM', 'land:TRAIN_ROOF', 'dismount:TRAIN_ROOF']);
    expect(result.elevation).toBe('GROUND');
    expect(result.feetY).toBe(0);
  });

  test('grounded player who never jumps never lands on the platform', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return { elevation: window.__GAME__.player.elevation, events: window.__GAME__.events };
    });

    expect(result.elevation).toBe('GROUND');
    expect(result.events.filter((e) => e.type === 'land')).toEqual([]);
  });
});
