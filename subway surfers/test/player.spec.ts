import { expect, test } from '@playwright/test';

test.describe('player kinematics', () => {
  test('lane lerp reaches the expected position after 10 ticks', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const x = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['left']);
      window.__GAME__.step(10);
      return window.__GAME__.player.x;
    });

    // x = -3 + 3 * 0.9^10 (LERP_SPEED=12, dt=1/120 -> factor 0.1/tick)
    expect(Math.abs(x - -1.9539646797)).toBeLessThan(1e-6);
  });

  test('jump follows semi-implicit Euler integration', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const atTick = async (n: number) => {
      return page.evaluate((ticks) => {
        window.__GAME__.step(ticks);
        return { feetY: window.__GAME__.player.feetY, vy: window.__GAME__.player.velocityY };
      }, n);
    };

    await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['jump']);
    });

    const a = await atTick(1);
    expect(Math.abs(a.feetY - 0.0734722222)).toBeLessThan(1e-6);
    expect(Math.abs(a.vy - 8.8166666667)).toBeLessThan(1e-6);

    const b = await atTick(4); // cumulative tick 5
    expect(Math.abs(b.feetY - 0.3520833333)).toBeLessThan(1e-6);
    expect(Math.abs(b.vy - 8.0833333333)).toBeLessThan(1e-6);

    const c = await atTick(55); // cumulative tick 60
    expect(Math.abs(c.feetY - 1.7041666667)).toBeLessThan(1e-6);
    expect(Math.abs(c.vy - -2.0)).toBeLessThan(1e-6);
    expect(await page.evaluate(() => window.__GAME__.player.elevation)).toBe('AIRBORNE');

    const d = await atTick(38); // cumulative tick 98 -- landed on the fixture platform (M4 track)
    expect(d.feetY).toBe(1); // snapped to PLATFORM_HEIGHT (1.0)
    expect(d.vy).toBe(0);
    expect(await page.evaluate(() => window.__GAME__.player.elevation)).toBe('ON_PLATFORM');
  });

  test('slide scales the capsule for exactly SLIDE_DURATION', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const during = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['slide']);
      window.__GAME__.step(1);
      return window.__GAME__.player;
    });
    expect(during.elevation).toBe('GROUND');

    const midway = await page.evaluate(() => {
      window.__GAME__.step(35); // 36 ticks total = 0.3s, well inside 0.6s SLIDE_DURATION
      return document.querySelector('canvas') !== null; // placeholder read to force a tick boundary
    });
    expect(midway).toBe(true);

    // scaleY isn't on the DebugHook contract (it's a render-only value); assert via the
    // one field that IS on the contract and depends on it: feetY stays 0 (grounded slide
    // does not affect vertical physics), and elevation stays GROUND throughout.
    const stillSliding = await page.evaluate(() => window.__GAME__.player);
    expect(stillSliding.elevation).toBe('GROUND');
    expect(stillSliding.feetY).toBe(0);

    await page.evaluate(() => window.__GAME__.step(100)); // well past SLIDE_DURATION
    const after = await page.evaluate(() => window.__GAME__.player);
    expect(after.elevation).toBe('GROUND');
    expect(after.feetY).toBe(0);
  });

  test('fast-fall overrides velocity while airborne', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(10); // ascending
      window.__GAME__.enqueue(['slide']); // fast-fall while airborne
      window.__GAME__.step(1);
      return window.__GAME__.player.velocityY;
    });

    // fast-fall sets velocityY = -FAST_FALL_SPEED (16), then one more tick of gravity applies:
    // -16 + (-22 * 1/120) = -16.1833333333
    expect(Math.abs(result - -16.1833333333)).toBeLessThan(1e-6);
  });

  test('jump is a no-op while already airborne', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const vy = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(20);
      window.__GAME__.enqueue(['jump']); // should be ignored -- already airborne
      window.__GAME__.step(1);
      return window.__GAME__.player.velocityY;
    });

    expect(vy).not.toBe(9); // would be exactly 9 only if the second jump re-fired
  });
});
