import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5176',
    channel: 'chrome',
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm vite --mode mock --host 127.0.0.1 --port 5176 --strictPort',
    url: 'http://127.0.0.1:5176/assistant',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
