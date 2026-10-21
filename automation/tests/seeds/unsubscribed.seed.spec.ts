// Seed for the Playwright test agents (planner, generator, healer): account
// `unsubscribed`. Pass this path as `seedFile` (and project "chromium") to
// planner_setup_page and generator_setup_page. It uses the saved session of
// this account (npm run login:saleshandy -- unsubscribed) and opens the HubSpot
// Triggers & Activity tab. It does not change any data and is never part of a
// workflow run: run specs by file path, not the whole folder.
import { test } from '@playwright/test';
import { platforms } from '../../src/config/environments.ts';
import { authFile } from '../../src/utils/session.ts';

test.use({
  baseURL: platforms.saleshandy.baseURL,
  storageState: authFile('saleshandy', 'unsubscribed', 'chromium'),
});

test('seed', async ({ page }) => {
  // The HubSpot integration page took longer than the test agents' setup tools
  // wait (seed interrupted at about 5.5 s, 2026-10-15), while /sequence loads in
  // time (same as linkclick.seed.spec.ts). Agents open Triggers & Activity
  // themselves: /api-and-integrations/integrations/hubspot?tab=triggers-activity
  await page.goto('/sequence');
});
