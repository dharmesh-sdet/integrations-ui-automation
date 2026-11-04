import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/index.ts';
import { STEP_1_SUBJECT } from '../../src/flows/salesforce-link-clicked.ts';

// Production setup for the Salesforce "Link is Clicked in Saleshandy" smoke run
// (notes/production-testing/24-salesforce-link-clicked.md), run by scripts/run-salesforce-link-clicked-smoke.sh
// after the gate. Creates the day's sequence "Salesforce Link Clicked Smoke <date>": one email step with two
// different links in the body, Track link clicks on, Track email opens off, one sender added in Settings > Email
// Account, then activated. If today's sequence is already in the list it is reused: a sender is added when none is
// on it, and it is activated if paused. A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is
// never retried.
//   SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-link-clicked-smoke-sequence.spec.ts --project=chromium --workers=1
// Sender (QA, 2026-11-03): a preferred sender is used when the Add email accounts dialog lists it, otherwise the
// listed account with the fewest active sequences. SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the preferred
// ones. One sender is enough for the 10 sends of the run, but the run is capped by the sender limit (SEND_CAP).
// The account has the custom tracking domain link.saleshandy.com; without one, Track link clicks shows
// "Custom Domain Required" and this spec fails.
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Salesforce Link Clicked Smoke ${new Date().toISOString().slice(0, 10)}`;
const PREFERRED = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
const LINK_1 = 'https://www.saleshandy.com';
const LINK_2 = 'https://www.saleshandy.com/pricing';
const BODY_HTML = `<p>Hello, I wanted to ask a quick question about your outreach. Please see <a href="${LINK_1}">saleshandy.com</a> and <a href="${LINK_2}">our pricing</a>.</p>`;

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

test.describe('Production setup: Salesforce Link Clicked smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add step 1 with two links, turn on link tracking, add a sender, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    let id = await test.step('Open the Sequences list and look for the sequence by name', () => idOfSequence(builder.page, NAME));
    if (id) {
      test.info().annotations.push({ type: 'reused', description: `${NAME} already exists (id ${id}), only the sender and activation are checked` });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1 with the subject and two links in the body', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, BODY_HTML, [LINK_1, LINK_2]);
      });
      await test.step('Turn on Track link clicks in Safety Settings', async () => {
        await builder.setSafetySetting('Track link clicks', true);
      });
      await test.step('Turn off Track email opens in Safety Settings (left alone when off)', async () => {
        await builder.setSafetySetting('Track email opens', false);
      });
      await test.step('Make sure that Track link clicks is on and the other two switches are off', async () => {
        expect(await builder.safetySettingChecked('Track link clicks')).toBe(true);
        expect(await builder.safetySettingChecked('Track email opens')).toBe(false);
        expect(await builder.safetySettingChecked('Send emails as text only')).toBe(false);
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
