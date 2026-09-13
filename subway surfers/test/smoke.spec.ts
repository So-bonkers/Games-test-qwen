import { expect, test } from '@playwright/test';
import { isBenign } from './benign-console';

test.describe('smoke', () => {
  test('no fatal console or page errors', async ({ page }) => {
    const fatal: string[] = [];
    page.on('pageerror', (e) => fatal.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !isBenign(m.text())) fatal.push(`console: ${m.text()}`);
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 5);
    expect(fatal).toEqual([]);
  });

  test('canvas geometry is nonzero', async ({ page }) => {
    await page.goto('/');
    const dims = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!c) return null;
      return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight };
    });
    expect(dims).not.toBeNull();
    expect(dims!.w).toBeGreaterThan(0);
    expect(dims!.h).toBeGreaterThan(0);
    expect(dims!.cw).toBeGreaterThan(0);
    expect(dims!.ch).toBeGreaterThan(0);
  });

  test('webgl2 context is live', async ({ page }) => {
    await page.goto('/');
    const gl = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!c) return null;
      const ctx = c.getContext('webgl2');
      return ctx ? { lost: ctx.isContextLost() } : null;
    });
    expect(gl, 'getContext("webgl2") returned null').not.toBeNull();
    expect(gl!.lost).toBe(false);
  });

  test('render loop advances', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.frame > 0);
    const a = await page.evaluate(() => window.__GAME__.stats.frame);
    await page.waitForTimeout(500);
    const b = await page.evaluate(() => window.__GAME__.stats.frame);
    expect(b - a, 'frames rendered in 500ms').toBeGreaterThanOrEqual(20);
  });

  test('draw calls are nonzero', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.drawCalls > 0);
    const stats = await page.evaluate(() => window.__GAME__.stats);
    expect(stats.drawCalls).toBeGreaterThan(0);
    expect(stats.triangles).toBeGreaterThan(0);
  });

  test('frame is not black and has tonal spread', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME__?.stats.luma.distinctBuckets > 0);
    const a = await page.evaluate(() => ({ ...window.__GAME__.stats.luma }));
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => ({ ...window.__GAME__.stats.luma }));

    expect(b.p99, 'p99 luminance').toBeGreaterThan(0.06);
    expect(b.distinctBuckets, 'distinct luma buckets').toBeGreaterThanOrEqual(8);
    expect(Math.abs(b.mean - a.mean), 'mean luma delta between samples').toBeGreaterThan(0);
  });
});
