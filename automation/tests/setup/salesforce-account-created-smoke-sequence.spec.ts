import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/index.ts';
import { STEP_1_SUBJECT, STEP_2_SUBJECT } from '../../src/flows/salesforce-link-clicked.ts';

// Production setup for the Salesforce "Account is created in Salesforce" smoke run
// (notes/production-testing/30-salesforce-account-created.md), run by scripts/run-salesforce-account-created-smoke.sh
// after the gate. Creates the day's sequence "Salesforce Account Created Smoke <date>": four email steps (a one-step
// sequence completes the prospect before Paused, Replied or Resume can show), "Stop sending follow-ups if reply is
// received" OFF (so Replied stays Replied), one sender added in the sequence settings, then activated.
// If today's sequence is already in the list it is reused: a sender is added when none is on it, and it is activated
// if paused. A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-account-created-smoke-sequence.spec.ts --project=chromium --workers=1
// Sender (QA, 2026-11-03): a preferred sender is used when the Add email accounts dialog lists it, otherwise the
// listed account with the fewest active sequences. SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the preferred ones.
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Salesforce Account Created Smoke ${new Date().toISOString().slice(0, 10)}`;
const PREFERRED = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
const LINK_1 = 'https://www.saleshandy.com';
const STEPS = 4;
const STOP_LABEL = 'Stop sending follow-ups';
const body = (text: string) => `<p>${text} <a href="${LINK_1}">saleshandy.com</a>.</p>`;
const SUBJECTS = [STEP_1_SUBJECT, STEP_2_SUBJECT, 'One more question about your outreach', 'Last note about your outreach'];
const BODIES = [
  'Hello, I wanted to ask a quick question about your outreach.',
  'Hi again, I am following up on my last note.',
  'I wanted to check in once more about the earlier questions.',
  'This is my last note. Please tell me if the timing is wrong.',
];

// The Sequences list is not a table, so the id is read from the list request.
async function idOfSequence(page: Page, name: string): Promise<string> {
  const listLoaded = page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
  await page.goto('/sequence');
  const text = JSON.stringify(await (await listLoaded).json());
  const found = text.match(new RegExp(`"id":(\\d+)[^{}]*"title":"${name}"|"title":"${name}"[^{}]*"id":(\\d+)`));
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
  // The button reads "Add more email accounts" once a sender is attached (seen 2026-11-12, sequence 997965, where the
  // sender was on the sequence and the dialog then listed none). Every @saleshandy.com sender is skipped above, so
  // this is the check that stops a second add.
  if (/more/i.test(await add.innerText())) return `already on the sequence (${onPage[0] ?? 'sender row'})`;
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
  await boxes.nth(pick.index).check({ timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Add to Sequence', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
  return pick.email;
}

test.describe('Production setup: Salesforce Account is created smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add ${STEPS} steps, switch off "${STOP_LABEL}", add a sender, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    test.setTimeout(15 * 60_000);
    let id = await test.step('Open the Sequences list and look for the sequence by name', () => idOfSequence(builder.page, NAME));
    if (id) {
      test.info().annotations.push({ type: 'reused', description: `${NAME} already exists (id ${id}), only the switch, the sender and the activation are checked` });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      for (let n = 1; n <= STEPS; n++) {
        await test.step(`Add step ${n}`, async () => {
          if (n > 1) await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
          await builder.addEmailStepWithLinks(SUBJECTS[n - 1], body(BODIES[n - 1]), [LINK_1]);
        });
      }
    }
    await test.step(`Turn "${STOP_LABEL}" off`, async () => {
      await builder.goto(`/sequence/${id}/steps`);
      await builder.setSafetySetting(STOP_LABEL, false);
    });
    expect(await builder.safetySettingChecked(STOP_LABEL), `${STOP_LABEL} is off after the change`).toBe(false);
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
    console.log(`SEQUENCE_NAME=${NAME}`);
  });
});
