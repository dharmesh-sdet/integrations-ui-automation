import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import type { Row } from '../../src/data/csv.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { sendStep } from '../../src/flows/zoho-email-sent.ts';
import { TRIGGER as EO } from '../../src/flows/zoho-email-opened.ts';
import { TRIGGER as EB, realBounceEmail, bounce } from '../../src/flows/zoho-email-bounced.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';

// Throwaway exploration of unconfirmed Zoho Email Opened / Email Bounced rows (QA, 2026-10-30). Not a regression spec.
//   ZOHO_EXPLORE_EOEB=1 KEEP_TEST_DATA=1 xvfb-run -a npx playwright test tests/setup/zoho-explore-eo-eb.spec.ts -g "E1" --project=chromium --workers=1
process.env.KEEP_OTHER_TRIGGERS = '1';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-explore-a-profile');
const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [async ({}, use) => {
    const { context, crm } = await openZohoProfile(PROFILE);
    await use(crm);
    await context.close();
  }, { scope: 'worker' }],
});
test.describe('Zoho EO/EB explore', () => {
  test.skip(process.env.ZOHO_EXPLORE_EOEB !== '1', 'Set ZOHO_EXPLORE_EOEB=1');
  test.use({ account: 'notemailsentzoho' });
  test.setTimeout(12 * 60_000);
  const SEQ = '197387';
  const SUBJECT = /Zoho Reply Received QA - Step 1/;
  const ts = (tag: string, extra = '') => console.log(`${tag} @ ${new Date().toISOString()} ${extra}`);
  const base21 = (first: string, last: string, email: string, company: string, extra: Row = {}): Row => ({
    'First Name': first, 'Last Name': last, Email: email, 'Phone Number': '+1 555-0148-3321', 'Job Title': 'Procurement Lead', Department: 'Operations',
    Industry: 'Logistics', Experience: '9', LinkedIn: '', Twitter: first.toLowerCase() + last.toLowerCase(), Facebook: '', Website: '', Icebreaker: '',
    City: 'Rotterdam', State: 'South Holland', Country: 'Netherlands', Company: company, 'Company Website': '', 'Company Industry': 'Logistics',
    'Company Founded Year': '2009', 'Company LinkedIn': '', ...extra,
  });
  const dump = (tag: string, text: string, n = 4500) => console.log(`${tag}\n${text.slice(0, n)}`);

  test('P1 Track email opens ON (record original)', async ({ saleshandySequenceBuilder: b, saleshandyPage: page }) => {
    await b.goto(`/sequence/${SEQ}/steps`);
    await b.setSafetySetting('Track email opens', true);
    ts('P1 Track email opens now', String(await b.safetySettingChecked('Track email opens')));
    console.log('P1 Track link clicks', await b.safetySettingChecked('Track link clicks'));
    expect(page).toBeTruthy();
  });

  async function openAndCount(seq: any, mailinator: any, row: Row, tag: string): Promise<number> {
    await seq.page.waitForTimeout(10_000);
    const subject = await mailinator.latestSubject(row.Email);
    console.log(`${tag} REAL SUBJECT`, subject);
    await mailinator.openEmail(row.Email, subject);
    ts(`${tag} OPENED mailinator`, row.Email);
    await seq.page.waitForTimeout(10_000);
    let n = await seq.openedCount(SEQ, fullName(row), 1);
    for (let i = 0; i < 6 && n < 1; i++) { await seq.page.waitForTimeout(10_000); n = await seq.openedCount(SEQ, fullName(row), 1); }
    ts(`${tag} Opened count`, String(n));
    return n;
  }

  test('E1 Email Opened Trigger and setup 4: Contact action, second open', async ({ zohoIntegration: z, saleshandyPage: page, saleshandySequence: seq, mailinator, crm }) => {
    const row = base21('Henrik', 'Solberg', 'henrik.solberg.eo4@mailinator.com', 'Solberg Freight Systems');
    await configure(z, page, EO, [{ action: ZOHO_ACTION.contact }]);
    ts('E1 trigger saved');
    await sendStep(seq, SEQ, row);
    ts('E1 SENT');
    const c1 = await openAndCount(seq, mailinator, row, 'E1 first');
    const found = await crm.waitForRecord('Contacts', row.Email, 120_000);
    ts('E1 contact found', JSON.stringify(found));
    if (!found) return;
    await crm.page.waitForTimeout(10_000);
    dump('E1 AFTER FIRST OPEN', await crm.recordText('Contacts', found.id));
    const c2 = await openAndCount(seq, mailinator, row, 'E1 second');
    ts('E1 counts', `${c1} -> ${c2}`);
    await crm.page.waitForTimeout(15_000);
    dump('E1 AFTER SECOND OPEN +15s', await crm.recordText('Contacts', found.id));
    await crm.page.waitForTimeout(30_000);
    dump('E1 AFTER SECOND OPEN +60s', await crm.recordText('Contacts', found.id));
    console.log('E1 CONTACT RECORDS', JSON.stringify((await crm.find('Contacts', row.Email)).map((r) => r.id)));
  });

  test('E2 Email Opened Combined 2: Contact + Deal, prospect not in Zoho, then second open', async ({ zohoIntegration: z, saleshandyPage: page, saleshandySequence: seq, mailinator, crm }) => {
    const row = base21('Marit', 'Eikeland', 'marit.eikeland.eoc2@mailinator.com', 'Eikeland Cold Storage', { 'Deal Value': '5500' });
    const dealsBefore = await crm.ids('Deals');
    await configure(z, page, EO, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '7' }]);
    ts('E2 trigger saved');
    await sendStep(seq, SEQ, row);
    ts('E2 SENT');
    const c1 = await openAndCount(seq, mailinator, row, 'E2 first');
    const found = await crm.waitForRecord('Contacts', row.Email, 120_000);
    ts('E2 contact found', JSON.stringify(found));
    await crm.page.waitForTimeout(15_000);
    const newDeals = async () => (await crm.find('Deals', '')).filter((d) => !dealsBefore.includes(d.id));
    ts('E2 NEW DEALS after first', JSON.stringify(await newDeals()));
    if (found) dump('E2 CONTACT AFTER FIRST OPEN', await crm.recordText('Contacts', found.id), 3500);
    for (const d of await newDeals()) dump(`E2 DEAL ${d.id} AFTER FIRST OPEN`, await crm.recordText('Deals', d.id), 3500);
    const c2 = await openAndCount(seq, mailinator, row, 'E2 second');
    ts('E2 counts', `${c1} -> ${c2}`);
    await crm.page.waitForTimeout(45_000);
    ts('E2 NEW DEALS after second', JSON.stringify(await newDeals()));
    if (found) dump('E2 CONTACT AFTER SECOND OPEN', await crm.recordText('Contacts', found.id), 3500);
    for (const d of await newDeals()) dump(`E2 DEAL ${d.id} AFTER SECOND OPEN`, await crm.recordText('Deals', d.id), 3500);
    console.log('E2 CONTACT RECORDS', JSON.stringify((await crm.find('Contacts', row.Email)).map((r) => r.id)));
  });

  test('P2 switch triggers for Bounced: Opened off, Bounced on with Contact', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await z.turnOff(EO);
    await z.save();
    await z.savedToast().waitFor({ timeout: 20_000 });
    await configure(z, page, EB, [{ action: ZOHO_ACTION.contact }]);
    await z.openTriggers();
    for (const r of await page.locator('div:has(> .switchToggle)').all()) console.log('P2 TRIGGER', JSON.stringify((await r.innerText()).trim()), await r.locator('input[name="Switch"]').isChecked());
  });

  async function bounceFlow(tag: string, row: Row, crm: ZohoCrmPage, seq: any) {
    await bounce(seq, SEQ, row);
    ts(`${tag} MARKED BOUNCED`, row.Email);
    const found = await crm.waitForRecord('Contacts', row.Email, 120_000);
    ts(`${tag} contact found`, JSON.stringify(found));
    if (!found) return;
    await crm.page.waitForTimeout(15_000);
    dump(`${tag} CONTACT`, await crm.recordText('Contacts', found.id), 5000);
    console.log(`${tag} CONTACT RECORDS`, JSON.stringify((await crm.find('Contacts', row.Email)).map((r) => r.id)));
  }

  test('B1 Email Bounced Trigger and setup 3: Contact action, not in Zoho', async ({ saleshandySequence: seq, crm }) => {
    await bounceFlow('B1', base21('Marguerite', 'Aubin', 'marguerite.aubin.eb3b@mailinator.com', 'Aubin Textile Works'), crm, seq);
  });

  test('B2 Email Bounced Contact 1: not in Zoho, 11 mapped fields', async ({ saleshandySequence: seq, crm }) => {
    await bounceFlow('B2', base21('Rafael', 'Oyelaran', 'rafael.oyelaran.eb1b@mailinator.com', 'Oyelaran Port Logistics'), crm, seq);
  });

  test('B3 Email Bounced Trigger and setup 4: real bounce (1 send)', async ({ saleshandySequence: seq, crm }) => {
    const row = base21('Ingrid', 'Haugland', 'ingrid.haugland.eb5@mailinator.com', 'Haugland Marine Supply');
    row.Email = realBounceEmail(row);
    console.log('B3 EMAIL', row.Email);
    await seq.createAndAddProspect(SEQ, row);
    await seq.sendNow(SEQ, fullName(row), 1, row.Email);
    ts('B3 SENT');
    await seq.waitUntilBounced(SEQ, fullName(row), 1, 8 * 60_000);
    ts('B3 EMAILS TAB SHOWS BOUNCED');
    const found = await crm.waitForRecord('Contacts', row.Email, 120_000);
    ts('B3 contact found', JSON.stringify(found));
    if (!found) return;
    await crm.page.waitForTimeout(15_000);
    dump('B3 CONTACT', await crm.recordText('Contacts', found.id), 5000);
  });

  test('P3 tag probe on a contact id (EXPLORE_ID)', async ({ crm }) => {
    const id = process.env.EXPLORE_ID!;
    await crm.recordText('Contacts', id);
    const page = crm.page;
    await page.locator('button:has-text("...")').first().click().catch(() => undefined);
    await page.mouse.click(1457, 86);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/claude-1002/p3.png' });
    console.log('P3 MENU\n' + (await page.locator('[role=menu], [role=listbox], ul:visible').allInnerTexts()).join('\n---\n').slice(0, 1500));
    const tag = page.getByText(/^(Add Tag|Tags?|Manage Tags)$/).first();
    if (await tag.count()) { await tag.click(); await page.waitForTimeout(2500); await page.screenshot({ path: '/tmp/claude-1002/p3b.png' }); console.log('P3 AFTER TAG CLICK\n' + (await page.locator('body').innerText()).slice(0, 1500)); }
  });

  test('R restore: Track email opens, triggers', async ({ saleshandySequenceBuilder: b, zohoIntegration: z, saleshandyPage: page }) => {
    await b.goto(`/sequence/${SEQ}/steps`);
    await b.setSafetySetting('Track email opens', false);
    ts('R Track email opens', String(await b.safetySettingChecked('Track email opens')));
    await z.openTriggers();
    await z.turnOff(EO);
    await z.turnOff(EB);
    await z.save();
    await z.savedToast().waitFor({ timeout: 20_000 });
    await z.openTriggers();
    for (const r of await page.locator('div:has(> .switchToggle)').all()) console.log('R TRIGGER', JSON.stringify((await r.innerText()).trim()), await r.locator('input[name="Switch"]').isChecked());
  });
});
test.describe('Zoho EO/EB probe', () => {
  test.skip(process.env.ZOHO_EXPLORE_EOEB !== '1', 'Set ZOHO_EXPLORE_EOEB=1');
  test.use({ account: 'notemailsentzoho' });
  test('P1b click Track email opens and read what shows', async ({ saleshandyPage: page }) => {
    await page.goto('/sequence/197387/settings');
    await page.getByRole('button', { name: 'Safety Settings' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Track email opens' }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/claude-1002/p1b.png' });
    console.log('P1b BODY\n' + (await page.locator('body').innerText()).slice(-1500));
    await page.getByRole('button', { name: 'Set Up Custom Domain' }).click();
    await page.waitForTimeout(4000);
    console.log('P1b URL', page.url());
    console.log('P1b DOMAIN PAGE\n' + (await page.locator('body').innerText()).slice(0, 2500));
    console.log('P1b CHECKED', await page.locator('label', { hasText: 'Track email opens' }).first().locator('xpath=..').locator('input').first().isChecked());
  });
});
