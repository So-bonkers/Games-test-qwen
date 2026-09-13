import { expect, test } from '@playwright/test';

test.describe('collision, death, and score', () => {
  test('front-face hit while GROUND causes gameover', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    const collision = result.events.find((e) => e.type === 'collision');
    expect(result.state).toBe('gameover');
    expect(collision).toBeTruthy();
    expect(collision!.data.obstacleId).toBe(20);
    expect(collision!.data.elevation).toBe('GROUND');
    expect(result.events.some((e) => e.type === 'gameover' && e.data.cause === 'collision')).toBe(true);
  });

  test('front-face hit while ON_PLATFORM causes gameover', async ({ page }) => {
    await page.goto('/?fixture=platform-ride-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    const collision = result.events.find((e) => e.type === 'collision');
    expect(result.state).toBe('gameover');
    expect(collision).toBeTruthy();
    expect(collision!.data.obstacleId).toBe(11);
    expect(collision!.data.elevation).toBe('ON_PLATFORM');
  });

  test('riding the platform without an overhead hazard causes no death', async ({ page }) => {
    await page.goto('/?fixture=platform-ride-safe');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    expect(result.state).toBe('playing');
    expect(result.events.filter((e) => e.type === 'collision')).toEqual([]);
    expect(result.events.some((e) => e.type === 'land' && e.data.surfaceKind === 'PLATFORM')).toBe(true);
  });

  test('front-face hit while ON_TRAIN_ROOF causes gameover', async ({ page }) => {
    await page.goto('/?fixture=train-roof-ride-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(400);
      return { state: window.__GAME__.state, events: window.__GAME__.events };
    });

    const collision = result.events.find((e) => e.type === 'collision');
    expect(result.state).toBe('gameover');
    expect(collision).toBeTruthy();
    expect(collision!.data.obstacleId).toBe(31);
    expect(collision!.data.elevation).toBe('ON_TRAIN_ROOF');
  });

  test('score increments with distance while playing', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const delta = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      const before = window.__GAME__.world.score;
      window.__GAME__.step(120);
      return window.__GAME__.world.score - before;
    });

    expect(delta).toBe(14); // BASE_SPEED=14, DISTANCE_SCORE_MULTIPLIER=1, 120 ticks = 1 second
  });

  test('high score persists to localStorage on gameover', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return {
        state: window.__GAME__.state,
        score: window.__GAME__.world.score,
        stored: localStorage.getItem('subway-surfers-high-score'),
      };
    });

    expect(result.state).toBe('gameover');
    expect(result.stored).toBe(String(result.score));
  });
});
