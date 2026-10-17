import { defineConfig, devices, type Project } from '@playwright/test';
import { browsers, type Browser } from './src/config/environments.ts';

// One project per browser. Each test opens its own HubSpot and Saleshandy pages
// with the saved logins of its spec's account for that browser (src/fixtures/index.ts).
// npm test runs Chromium only; npm run test:edge runs Edge.
function project(browser: Browser): Project {
  return {
    name: browser,
    metadata: { browser },
    use: {
      ...devices[browsers[browser].device],
      channel: browsers[browser].channel,
    },
  };
}

// Where a run writes its results. Default "reports" is what QA's runs use.
// A Claude session that develops one workflow sets REPORTS_DIR=reports/<slug>
// so two sessions can run at the same time without clearing each other's
// traces (clash seen 2026-10-09).
const reports = process.env.REPORTS_DIR ?? './reports';

export default defineConfig({
  testDir: './tests',
  // Before each run: every row of the CSV of each workflow being run gets a new
  // person, other CSVs get their used rows replaced (src/data/global-setup.ts).
  globalSetup: './src/data/global-setup.ts',
  outputDir: `${reports}/test-results`,
  // A test creates a record, then waits up to about 1 minute for the sync.
  timeout: 5 * 60_000,
  // Spec files (workflows) run in parallel; tests inside a file run in order.
  fullyParallel: false,
  // 4 locally: RAM, not CPU, is the limit (two browser contexts per worker).
  // Drop to --workers=3 if runs swap or time out while Chrome is busy.
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${reports}/html`, open: 'never' }],
    // Read by the skill's results stage to write reports/failures.md.
    ['json', { outputFile: `${reports}/results.json` }],
    // Plain-English review page with Jira drafts, written as soon as the run ends.
    // It opens in the browser only with REPORT_OPEN=always.
    ['./reporter/plain-report.ts', { outputFile: `${reports}/report.html` }],
  ],
  use: {
    screenshot: 'on',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [project('chromium'), project('edge')],
});
