import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// Production setup for the Zoho "Email is Bounced in Saleshandy" smoke run
// (notes/production-testing/18-zoho-email-bounced.md), run by scripts/run-zoho-email-bounced-smoke.sh after the
// gate. Creates the sequence for the day, "Zoho Email Bounced Smoke <date>": one email step, the production email
// accounts added in Settings > Email Account, then activated. If today's sequence is already in the list it is
// reused: missing email accounts are added and it is activated if paused.
// A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/zoho-email-bounced-smoke-sequence.spec.ts --project=chromium --workers=1
// Email accounts: the two read on the Email Accounts page on 2026-10-22. Read the page again before the run
// (notes/production-testing/README.md). SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides them.
// The run sends 1 email (check 8), far under the cap of 20 a day.
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Zoho Email Bounced Smoke ${new Date().toISOString().slice(0, 10)}`;
// Preferred senders, tried first. Production changes, so a sender that is not in the Add dialog is skipped and the
// accounts the dialog does list are used instead (QA, 2026-11-03: use what the list shows).
const PREFERRED = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
const STEP_1_HEADING = `${NAME} - Step 1`;

// Settings > Email Account: when the sequence has no sender yet, opens "Add more email accounts", takes the
// preferred sender if it is listed and otherwise the account in the list with the fewest active sequences, then
// Add to Sequence. One sender is enough: the run sends 1 email. Returns the sender email.
async function addListedSender(page: Page, sequenceId: string): Promise<string> {
  await page.goto(`/sequence/${sequenceId}/settings`);
  const table = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Active Sequence' }) });
  const add = page.getByRole('button', { name: /Add (more )?email accounts?/i }).first();
  await add.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  const have = await table.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).filter({ hasText: '@' }).count();
  if (have > 0) return 'already on the sequence';
  await add.click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Select email accounts to add to the sequence' });
  await dialog.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(3_000);
  const rows = dialog.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).filter({ has: page.getByRole('checkbox') });
  await rows.first().waitFor({ timeout: 20_000 });
  const listed: Array<{ index: number; email: string; active: number }> = [];
  for (let i = 0; i < (await rows.count()); i++) {
    const text = await rows.nth(i).innerText();
    const email = text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? '';
    const active = Number(text.split(/\s+/).find((w) => /^\d+$/.test(w)) ?? 0);
    if (email) listed.push({ index: i, email, active });
  }
  if (!listed.length) throw new Error('The Add email accounts dialog lists no account. Connect one on the Email Accounts page, then run again.');
  const preferred = listed.find((l) => PREFERRED.some((p) => p.toLowerCase() === l.email.toLowerCase()));
  const pick = preferred ?? [...listed].sort((a, b) => a.active - b.active)[0];
  test.info().annotations.push({ type: 'sender', description: `${pick.email} (${preferred ? 'preferred' : 'first free in the list'}; listed: ${listed.map((l) => l.email).join(', ')})` });
  await rows.nth(pick.index).getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Add to Sequence', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
  return pick.email;
}

test.describe('Production setup: Zoho Email Bounced smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add step 1 and the email accounts, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    let id = '';
    if (await builder.exists(NAME)) {
      test.info().annotations.push({ type: 'reused', description: `${NAME} already exists, only the email accounts and activation are checked` });
      id = await builder.idOf(NAME);
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStep(libraryTemplates[0], STEP_1_HEADING);
      });
    }
    await test.step('Add a sender from the accounts the dialog lists', async () => {
      console.log(`SENDER=${await addListedSender(builder.page, id)}`);
    });
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
    await test.step('Make sure that the sequence is in the list', async () => {
      await builder.openList();
      expect(await builder.exists(NAME)).toBe(true);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
  });
});
