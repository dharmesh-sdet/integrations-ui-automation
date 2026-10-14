// Data check for test-data/hubspot/email-opened.csv: no row's email may
// already exist in HubSpot. The generator only avoids people in the current
// CSVs and .used.txt files, so a person created by an earlier run can come
// back (seen 2026-10-13: yui.morikawa and serena.caruso). Such a row makes
// "Contact in HubSpot" rows fail at the Create Contact panel and lets
// "Contact not in HubSpot" rows pass wrongly.
// Colliding emails are added to email-opened.used.txt; the next run replaces
// them (use TEST_DATA_ONLY=hubspot/email-opened) and this check is run again
// until it finds none.
import type { Page } from '@playwright/test';
import { readCsv } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { HUBSPOT_PORTAL_ID } from '../../src/pages/hubspot/hubspot.page.ts';

const CSV = 'hubspot/email-opened.csv';

test.use({ account: 'emailopened' });

// How many contacts HubSpot's contacts list finds for the email. The result
// row shows only the name and a truncated email (seen 2026-10-13), so the
// list's footer count ("1 contact", "0 contacts") is read instead.
async function contactsFor(page: Page, email: string): Promise<number> {
  await page.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list?query=${encodeURIComponent(email)}`);
  const count = page.getByText(/^\d+ contacts?$/).first();
  await expect(count, `contact count for ${email}`).toBeVisible({ timeout: 30_000 });
  // The count can still be the unfiltered total for a moment; wait until it settles.
  let last = '';
  await expect(async () => {
    const now = (await count.innerText()).trim();
    const settled = now === last;
    last = now;
    expect(settled, 'contact count settled').toBe(true);
  }).toPass({ timeout: 15_000, intervals: [1_000] });
  return Number(last.match(/^\d+/)![0]);
}

// The check below only means something if it can see a contact that exists,
// and see none for an address nobody has. serena.caruso@mailinator.com was
// reported as existing by HubSpot's Create Contact panel on 2026-10-13.
test('Email Opened data: sanity, the check sees an existing and a missing contact', async ({ hubspotPage }) => {
  expect(await contactsFor(hubspotPage, 'serena.caruso@mailinator.com'), 'existing contact').toBeGreaterThanOrEqual(1);
  expect(await contactsFor(hubspotPage, 'no.such.person.zz9@mailinator.com'), 'missing contact').toBe(0);
});

test('Email Opened data: no row email exists in HubSpot yet', async ({ hubspotPage }) => {
  test.setTimeout(30 * 60_000);
  const emails = [...new Set(readCsv(CSV).map((r) => r['Email']).filter(Boolean))];
  const taken: string[] = [];
  for (const email of emails) {
    if ((await contactsFor(hubspotPage, email)) > 0) {
      taken.push(email);
      markUsed(CSV, email);
    }
  }
  test.info().annotations.push({ type: 'Emails already in HubSpot (marked used)', description: taken.join(', ') || 'none' });
  expect(taken, 'row emails that already exist in HubSpot (marked used; run again after the rows are replaced)').toEqual([]);
});
