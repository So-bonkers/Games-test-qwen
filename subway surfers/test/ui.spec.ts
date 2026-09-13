import { expect, test } from '@playwright/test';

test.describe('menu, HUD, and gameover flow', () => {
  test('menu screen is visible on load; HUD and gameover screen are hidden', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const state = await page.evaluate(() => window.__GAME__.state);
    expect(state).toBe('menu');
    await expect(page.locator('#menu-screen')).toBeVisible();
    await expect(page.locator('#hud')).toBeHidden();
    await expect(page.locator('#gameover-screen')).toBeHidden();
  });

  test('clicking Play hides the menu and shows the HUD', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.click('#btn-play');
    await page.waitForFunction(() => window.__GAME__.state === 'playing');

    await expect(page.locator('#menu-screen')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
  });

  test('full loop: menu -> play -> gameover -> restart returns to the menu', async ({ page }) => {
    await page.goto('/?fixture=ground-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.click('#btn-play');
    await page.waitForFunction(() => window.__GAME__.state === 'playing');

    await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.step(200);
    });

    const state = await page.evaluate(() => window.__GAME__.state);
    expect(state).toBe('gameover');
    await expect(page.locator('#gameover-screen')).toBeVisible();
    await expect(page.locator('#hud')).toBeHidden();

    await Promise.all([page.waitForNavigation(), page.click('#btn-restart')]);
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    const stateAfterRestart = await page.evaluate(() => window.__GAME__.state);
    expect(stateAfterRestart).toBe('menu');
    await expect(page.locator('#menu-screen')).toBeVisible();
  });

  test('HUD shows an active power-up timer and hides it once it expires', async ({ page }) => {
    // train-roof-ride-hit is survivable for a grounded runner (the ramp train has no deadly
    // faces and the overhead barrier sits above ground level), so the magnet can expire by
    // timer instead of the run ending in gameover, which would hide the whole HUD.
    await page.goto('/?fixture=train-roof-ride-hit');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);

    await page.click('#btn-play');
    await page.waitForFunction(() => window.__GAME__.state === 'playing');

    await page.evaluate(() => {
      window.__GAME__.setPaused(true);
      window.__GAME__.seed(1);
      window.__GAME__.grantPowerUp('COIN_MAGNET');
      window.__GAME__.step(1);
    });

    await expect(page.locator('#hud-magnet')).toBeVisible();
    await expect(page.locator('#hud-magnet')).toContainText('Magnet');

    await page.evaluate(() => window.__GAME__.step(960));

    await expect(page.locator('#hud-magnet')).toBeHidden();
  });
});
