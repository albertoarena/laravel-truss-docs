import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests for the hand-authored demo shells.
 *
 * The suite next door reads markup and cannot see a rendered box. Four layout
 * failures have shipped on these four files: a hidden attribution, the footer
 * clipped at desktop widths, the footer clipped on a phone, and the site bar
 * overflowing on /demo/ between 561 and 688. None was visible to a test. Two of
 * them were caught by eye on a phone, which is not a process.
 *
 * Against dist/, not the dev server: the menu script is inlined at build, so a
 * spec pointed at `astro dev` would be testing pages without it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // preview serves dist/, which is where the inlining has happened. It does
    // not build, deliberately: CI builds once and both suites read that output.
    command: 'npx astro preview --port 4321',
    url: 'http://localhost:4321/demo/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
