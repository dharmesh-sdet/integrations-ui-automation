// Seed for the Playwright test agents (planner, generator, healer). Prospect is
// Unsubscribed in Saleshandy only (AL-4015), on the unsubscribed account.
// It uses the saved session (npm run login:saleshandy -- unsubscribed) and opens
// the HubSpot Triggers & Activity tab. It does not change any data, and it is
// never part of a workflow run: run specs by file path, not the whole folder.
import { test } from '@playwright/test';
import { platforms } from '../src/config/environments.ts';
import { authFile } from '../src/utils/session.ts';

test.use({
  baseURL: platforms.saleshandy.baseURL,
  storageState: authFile('saleshandy', 'unsubscribed', 'chromium'),
});

test('seed', async ({ page }) => {
  await page.goto('/api-and-integrations/integrations/hubspot?tab=triggers-activity');
});
