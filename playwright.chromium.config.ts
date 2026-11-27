// Playwright in Chromium, for a cloud container: it has Chromium but no WebKit (retro of loop 1, 27 Nov).
// The same layout checks as playwright.config.ts, only the browser differs, so a WebKit-only failure (a 0.5 px
// rounding, a Safari font) still shows only in CI. Run: npx playwright test -c playwright.chromium.config.ts <spec>
// PW_CHROMIUM names another Chromium binary. See docs/testing.md and .claude/briefs/builder-brief.md.
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  ...base,
  use: { ...base.use, ...devices['Desktop Chrome'] },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium_headless_shell' },
      },
    },
  ],
});
