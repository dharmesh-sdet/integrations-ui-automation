import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/index.ts';
import { STEP_1_SUBJECT, STEP_2_SUBJECT } from '../../src/flows/salesforce-email-bounced.ts';

// Production setup for the Salesforce "Email is Bounced in Saleshandy" smoke run
// (notes/production-testing/25-salesforce-email-bounced.md), run by scripts/run-salesforce-email-bounced-smoke.sh
// after the gate. Creates the day's sequence "Salesforce Email Bounced Smoke <date>": two email steps, one sender
// added in Settings > Email Account, then activated. A bounce needs no open or click tracking, so the Safety
// Settings stay as they are. If today's sequence is already in the list it is reused: a sender is added when none
// is on it, and it is activated if paused. A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is
// never retried.
//   SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-email-bounced-smoke-sequence.spec.ts --project=chromium --workers=1
// Sender (QA, 2026-11-03): a preferred sender is used when the Add email accounts dialog lists it, otherwise the
// listed account with the fewest active sequences. SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the preferred
// ones. Only one send is made (check 1, the real bounce).
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Salesforce Email Bounced Smoke ${new Date().toISOString().slice(0, 10)}`;
const PREFERRED = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
const LINK_1 = 'https://www.saleshandy.com';
const body = (text: string) => `<p>${text} <a href="${LINK_1}">saleshandy.com</a>.</p>`;

// The Sequences list is no longer a table (2026-11-02), so the id is read from the list request.
async function idOfSequence(page: Page, name: string): Promise<string> {
  const listLoaded = page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
  await page.goto('/sequence');
  const body = JSON.stringify(await (await listLoaded).json());
  const found = body.match(new RegExp(`"id":(\\d+)[^{}]*"title":"${name}"|"title":"${name}"[^{}]*"id":(\\d+)`));
  return found?.[1] ?? found?.[2] ?? '';
}

// Adds one sender if the sequence has none. Returns the sender email.
async function addListedSender(page: Page, sequenceId: string): Promise<string> {
  await page.goto(`/sequence/${sequenceId}/settings`);
  const add = page.getByRole('button', { name: /Add (more )?email accounts?/i }).first();
  await add.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  const onPage = (await page.locator('body').innerText()).match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
  const known = onPage.filter((e) => !/@saleshandy\.com$/i.test(e) || PREFERRED.some((p) => p.toLowerCase() === e.toLowerCase()));
  if (known.length > 0) return `already on the sequence (${known[0]})`;
  await add.click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Select email accounts to add to the sequence' });
  await dialog.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(3_000);
  const boxes = dialog.locator('input[type="checkbox"]');
  await boxes.first().waitFor({ timeout: 20_000 });
  // For each checkbox, the email and the active-sequence count come from its nearest ancestor that shows an email.
  const listed = await boxes.evaluateAll((els) =>
    els.map((el, index) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && !/[\w.+-]+@[\w.-]+\.\w+/.test(node.innerText ?? '')) node = node.parentElement;
      const text = node?.innerText ?? '';
      const email = text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? '';
      const active = Number(text.split(/\s+/).find((w) => /^\d+$/.test(w)) ?? 0);
      return { index, email, active };
    }),
  );
  const usable = listed.filter((l) => l.email);
  if (!usable.length) throw new Error('The Add email accounts dialog lists no account. Connect one on the Email Accounts page, then run again.');
  const preferred = usable.find((l) => PREFERRED.some((p) => p.toLowerCase() === l.email.toLowerCase()));
  const pick = preferred ?? [...usable].sort((a, b) => a.active - b.active)[0];
  test.info().annotations.push({ type: 'sender', description: `${pick.email} (${preferred ? 'preferred' : 'first free in the list'}; listed: ${usable.map((l) => l.email).join(', ')})` });
  await boxes.nth(pick.index).check();
  await dialog.getByRole('button', { name: 'Add to Sequence', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
  return pick.email;
}

test.describe('Production setup: Salesforce Email Bounced smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add steps 1 and 2, add a sender, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    let id = await test.step('Open the Sequences list and look for the sequence by name', () => idOfSequence(builder.page, NAME));
    if (id) {
      test.info().annotations.push({ type: 'reused', description: `${NAME} already exists (id ${id}), only the sender and activation are checked` });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, I wanted to ask a quick question about your outreach.'), [LINK_1]);
      });
      await test.step('Add step 2', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
        await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, I am following up on my last note.'), [LINK_1]);
      });
    }
    await test.step('Add a sender from the accounts the dialog lists', async () => {
      console.log(`SENDER=${await addListedSender(builder.page, id)}`);
    });
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
    await test.step('Make sure that the sequence is in the list', async () => {
      expect(await idOfSequence(builder.page, NAME)).toBe(id);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
    console.log(`STEP_1_SUBJECT=${STEP_1_SUBJECT}`);
  });
});
