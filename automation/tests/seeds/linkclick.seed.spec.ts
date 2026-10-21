// Seed for the Playwright test agents (planner, generator, healer): account
// `linkclick`. Pass this path as `seedFile` (and project "chromium") to
// planner_setup_page and generator_setup_page. It uses the saved session of
// this account (npm run login:saleshandy -- linkclick) and opens the Sequences
// list. It does not change any data and is never part of a workflow run: run
// specs by file path, not the whole folder.
import { test } from '@playwright/test';
import { platforms } from '../../src/config/environments.ts';
import { authFile } from '../../src/utils/session.ts';

test.use({
  baseURL: platforms.saleshandy.baseURL,
  storageState: authFile('saleshandy', 'linkclick', 'chromium'),
});

test('seed', async ({ page }) => {
  await page.goto('/sequence');
});
