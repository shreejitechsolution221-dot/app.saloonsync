import { defineConfig, devices } from '@playwright/test';
const baseURL=process.env.PLAYWRIGHT_BASE_URL??'http://localhost:3000';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true,
  use: { baseURL, trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: { command: process.env.PLAYWRIGHT_SERVER_COMMAND ?? 'npm run dev -- --hostname localhost', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120000, env: { APP_ORIGIN: baseURL } },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
});
