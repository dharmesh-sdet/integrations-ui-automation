import { libraryTemplates } from '../../src/config/account-setup.ts';
import { expect, test } from '../../src/fixtures/index.ts';

// Throwaway exploration of the unconfirmed Zoho Reply Received rows (QA, 2026-10-29). Not a regression
// spec. Headless, so no window opens. The Zoho side is read separately.
//   ZOHO_REPLY_EXPLORE=1 npx playwright test tests/setup/zoho-reply-explore.spec.ts -g "P0" --project=chromium --workers=1
test.describe('Zoho Reply Received explore', () => {
  test.skip(process.env.ZOHO_REPLY_EXPLORE !== '1', 'Set ZOHO_REPLY_EXPLORE=1');
  test.use({ account: 'notemailsentzoho' });
  const NAME = 'Zoho Reply Received QA';

  test('P0 probe: Zoho connected, trigger state, sequence list', async ({ zohoIntegration: z, saleshandySequenceBuilder: builder, saleshandyPage: page }) => {
    console.log('P0 CONNECTED', await z.isConnected());
    await z.openTriggers();
    const body = await page.locator('body').innerText();
    console.log('P0 TRIGGERS PAGE\n' + body.slice(0, 1500));
    await builder.openList();
    const exists = await builder.exists(NAME);
    console.log('P0 SEQUENCE EXISTS', exists, exists ? await builder.idOf(NAME) : '');
    const list = await page.locator('body').innerText();
    console.log('P0 SEQUENCE LIST\n' + list.slice(0, 1500));
    expect(true).toBe(true);
  });

  test('P2 create the sequence with steps 1 and 2 and sender Rachel 10', async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    const SENDERS = ['Rachelgreen47sh+10@gmail.com'];
    await builder.openList();
    if (await builder.exists(NAME)) {
      const existing = await builder.idOf(NAME);
      await builder.addEmailAccounts(existing, SENDERS);
      await saleshandySequence.resumeSequence(existing);
      console.log(`SEQUENCE_ID=${existing}`);
      return;
    }
    const id = await builder.create(NAME);
    await builder.addEmailStep(libraryTemplates[0], `${NAME} - Step 1`);
    await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
    await builder.addEmailStep(libraryTemplates[1], `${NAME} - Step 2`);
    await builder.addEmailAccounts(id, SENDERS);
    await saleshandySequence.resumeSequence(id);
    console.log(`SEQUENCE_ID=${id}`);
  });

  const SEQ = '197387';
  const TRIGGER = 'Reply is Received in Saleshandy';
  const row = (first: string, last: string, email: string, extra: Record<string, string> = {}) => ({
    'First Name': first, 'Last Name': last, Email: email, ...extra,
  });

  async function replyFlow(s: { createAndAddProspect: (id: string, r: Record<string, string>) => Promise<void>; sendNow: (id: string, n: string, step: number, e: string) => Promise<void>; markAsReplied: (id: string, n: string, step: number, e: string) => Promise<void> }, r: Record<string, string>, tag: string) {
    const name = `${r['First Name']} ${r['Last Name']}`.trim();
    await s.createAndAddProspect(SEQ, r);
    await s.sendNow(SEQ, name, 1, r['Email']);
    await s.markAsReplied(SEQ, name, 1, r['Email']);
    console.log(`${tag} REPLIED`, new Date().toISOString(), r['Email']);
  }

  test('V1 Contact action, trigger save message, prospect has no last name', async ({ zohoIntegration: z, saleshandySequence: s }) => {
    await z.setActivities(TRIGGER, ['Create/Update a Contact in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    console.log('V1 SAVE TOAST', (await z.savedToast().innerText()).replace(/\s+/g, ' '));
    await replyFlow(s, row('Nora', '', 'dharmesh+zoho-v1@saleshandy.com', { Company: 'Harbor Freight Labs' }), 'V1');
  });

  test('V2 Lead action, prospect has no company', async ({ zohoIntegration: z, saleshandySequence: s }) => {
    await z.setActivities(TRIGGER, ['Create/Update a Lead in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await replyFlow(s, row('Devan', 'Anand', 'dharmesh+zoho-v2@saleshandy.com'), 'V2');
  });

  test('V3 Account action, prospect has a company, no contact', async ({ zohoIntegration: z, saleshandySequence: s }) => {
    await z.setActivities(TRIGGER, ['Create/Update Account in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await replyFlow(s, row('Mei', 'Tanaka', 'dharmesh+zoho-v3@saleshandy.com', { Company: 'Tanaka Robotics Works' }), 'V3');
  });

  test('V4 Account action, an account with the same name exists, no contact', async ({ zohoIntegration: z, saleshandySequence: s }) => {
    await z.setActivities(TRIGGER, ['Create/Update Account in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await replyFlow(s, row('Ines', 'Moreau', 'dharmesh+zoho-v4@saleshandy.com', { Company: 'Vega Marine Works' }), 'V4');
  });

  test('V5 Task action, Due In empty', async ({ zohoIntegration: z, saleshandySequence: s, saleshandyPage: page }) => {
    await z.openTriggers();
    await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, 'Create a Task in Zoho');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('textbox').first().fill('Follow up after reply');
    for (const [i, option] of [[0, 'Not Started'], [1, 'Normal']] as const) {
      await dialog.locator('.bs-select-box').nth(i).click();
      await page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await z.save();
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await replyFlow(s, row('Liam', 'Ortega', 'dharmesh+zoho-v5@saleshandy.com', { Company: 'Ortega Fleet Services' }), 'V5');
  });

  test('P1 probe: email accounts on the account', async ({ saleshandyPage: page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Email Accounts' }).first().click();
    await page.waitForTimeout(6_000);
    console.log('P1 URL', page.url());
    console.log('P1 EMAIL ACCOUNTS\n' + (await page.locator('main, body').first().innerText()).slice(0, 2500));
  });
});
