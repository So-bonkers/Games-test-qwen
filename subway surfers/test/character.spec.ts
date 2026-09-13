import { expect, test } from '@playwright/test';

test.describe('character rig and animation state', () => {
  test('character rig loads and replaces the capsule placeholder', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);
    await page.waitForFunction(() => window.__GAME__.characterLoaded === true, null, { timeout: 45000 });

    const loaded = await page.evaluate(() => window.__GAME__.characterLoaded);
    expect(loaded).toBe(true);
  });

  test('animState transitions RUN -> JUMP -> LAND -> RUN across a scripted jump', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(5);
      const beforeJump = window.__GAME__.player.animState;
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(1);
      const rightAfterJump = window.__GAME__.player.animState;
      // Step counts are robust to the pre-pause live ticks (the game runs a few ticks
      // before setPaused, shifting all distance-based events): J+97 and J+217 are inside
      // a land-hold window in every regime (platform catch or pure-ground landing), and
      // J+517 is past the last M4-track hold window (which ends by absolute tick 520).
      window.__GAME__.step(97);
      const atLanding = window.__GAME__.player.animState;
      window.__GAME__.step(120);
      const stillLanding = window.__GAME__.player.animState;
      window.__GAME__.step(300);
      const afterLandHold = window.__GAME__.player.animState;
      return { beforeJump, rightAfterJump, atLanding, stillLanding, afterLandHold };
    });

    expect(result.beforeJump).toBe('RUN');
    expect(result.rightAfterJump).toBe('JUMP');
    expect(result.atLanding).toBe('LAND');
    expect(result.stillLanding).toBe('LAND');
    expect(result.afterLandHold).toBe('RUN');
  });

  test('animState is SLIDE while sliding on the ground', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.enqueue(['slide']);
      window.__GAME__.step(1);
      return window.__GAME__.player.animState;
    });

    expect(result).toBe('SLIDE');
  });

  test('crash animState maps FULL_BLOCK to CRASH_FALL', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, animState: window.__GAME__.player.animState };
    });

    expect(result.state).toBe('gameover');
    expect(result.animState).toBe('CRASH_FALL');
  });

  test('crash animState maps HIGH_BARRIER to CRASH_TRIP', async ({ page }) => {
    await page.goto('/?fixture=platform-ride-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(30);
      window.__GAME__.enqueue(['jump']);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, animState: window.__GAME__.player.animState };
    });

    expect(result.state).toBe('gameover');
    expect(result.animState).toBe('CRASH_TRIP');
  });

  test('crash animState maps LOW_BARRIER to CRASH_LEGS', async ({ page }) => {
    await page.goto('/?fixture=low-barrier-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const result = await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
      return { state: window.__GAME__.state, animState: window.__GAME__.player.animState };
    });

    expect(result.state).toBe('gameover');
    expect(result.animState).toBe('CRASH_LEGS');
  });
});
