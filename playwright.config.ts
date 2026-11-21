// Playwright: layout checks in a real browser (WebKit, Safari's engine) at phone and tablet widths.
// Run with `npm run test:layout`. Uses layout.html, which loads the real screens against the stand-in
// database, so it never touches Supabase. See docs/testing.md.
import { defineConfig, devices } from '@playwright/test';

// Set by GitHub Actions. (Declared here so the project needn't add Node's type definitions.)
declare const process: { env: Record<string, string | undefined> };
const CI = !!process.env.CI;
// LAYOUT_PORT lets a second worktree on the same computer run its own server instead of reusing another's.
const PORT = Number(process.env.LAYOUT_PORT ?? 5180);

export default defineConfig({
  testDir: 'tests/layout',
  outputDir: 'test-results/layout',
  // Approved gallery pictures (tests/layout/gallery.spec.ts), made on Linux by the layout check when missing, so one
  // set serves CI; they're compared in CI only (other systems draw text a little differently).
  snapshotPathTemplate: '{testDir}/gallery-baselines/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // In CI a JSON report too, kept with the screenshots (layout-screens-N): check.yml's redraw job reads it to tell
  // announced gallery redraws from any other failure (scripts/ci-redraws.mjs, ci-announced-redraws).
  reporter: CI ? [['github'], ['json', { outputFile: 'test-results/layout-report.json' }]] : 'list',
  // Which run attempt and commit drew the report (it lands in its config.metadata): the redraw job refuses a report
  // from an earlier attempt of the run or from other code, so a re-run never judges older pictures (#1082 review).
  metadata: CI ? { runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '', sha: process.env.GITHUB_SHA ?? '' } : {},
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Safari'],
  },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/layout.html`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
