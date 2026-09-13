import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const profile = JSON.parse(readFileSync('test/gl-profile.json', 'utf8')) as {
  headless: boolean;
  args?: string[];
};

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    headless: profile.headless,
    launchOptions: { args: profile.args ?? [] },
  },
  webServer: {
    command: 'npm run build:test && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
