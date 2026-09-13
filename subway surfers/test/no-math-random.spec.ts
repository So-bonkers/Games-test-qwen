import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const ALLOWED = ['src/util/rng.ts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('Math.random is never called outside src/util/rng.ts', () => {
  const offenders = walk('src')
    .filter((f) => !ALLOWED.includes(f))
    .filter((f) => readFileSync(f, 'utf8').includes('Math.random('));
  expect(offenders, 'files calling Math.random()').toEqual([]);
});
