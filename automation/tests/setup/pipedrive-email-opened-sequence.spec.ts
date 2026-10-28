import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of the sequence for the Pipedrive "Email is Opened in Saleshandy" tests (AL-4174)
// on the gpipedrive account. Two steps, Track email opens on, Track link clicks off (a click also counts
// as an open). The sender is not used by the other Pipedrive sequences (Kartik 2, 3, 4 in 197336,
// Kartik 5 in 197337 and Reply Received, Kartik 7 in Link Clicked, Kartik 60 in 197339).
// Creates nothing that is already there; the id is printed either way.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-email-opened-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into PD_OPEN_SEQUENCE_ID for tests/pipedrive/email-opened.spec.ts.
const NAME = 'Pipedrive Email Opened QA';
// TODO(needs-input): QA to confirm a free sender mailbox on gpipedrive; set PD_OPEN_SENDER to use another.
const SENDER = process.env.PD_OPEN_SENDER ?? '2kartiktest+8@gmail.com';
const STEP_1_SUBJECT = 'Quick question about your outreach';
const STEP_2_SUBJECT = 'Following up on my last note';
const LINKS = ['https://www.saleshandy.com'];
const body = (intro: string) => `<p>${intro} <a href="${LINKS[0]}">our site</a>.</p>`;

test.describe('Setup: Pipedrive Email Opened sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'gpipedrive' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add steps 1 and 2, turn on open tracking, add the sender and activate it`, async ({
    saleshandySequenceBuilder: builder,
    saleshandySequence,
  }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    let id = '';
    if (await builder.exists(NAME)) {
      // A first run stopped part way: open the sequence and do only what is missing.
      await test.step(`Open the existing "${NAME}"`, async () => {
        id = await builder.idOf(NAME);
        await builder.goto(`/sequence/${id}/steps`);
      });
      await test.step('Add the steps that are missing', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().waitFor({ timeout: 30_000 }).catch(() => {});
        if ((await builder.page.getByText(STEP_1_SUBJECT).count()) === 0) {
          await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, please see'), LINKS);
        }
        if ((await builder.page.getByText(STEP_2_SUBJECT).count()) === 0) {
          await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
          await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, the details are on'), LINKS);
        }
      });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, please see'), LINKS);
      });
      await test.step('Add step 2', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
        await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, the details are on'), LINKS);
      });
    }
    await test.step('Turn on Track email opens in Safety Settings (left alone when on)', async () => {
      await builder.page.getByRole('tab', { name: 'Settings' }).click();
      await builder.page.waitForURL(/\/settings/);
      await builder.page.getByRole('button', { name: 'Safety Settings' }).click();
      if (!(await builder.safetySettingChecked('Track email opens'))) {
        await builder.page.getByRole('button', { name: 'Track email opens' }).click();
        // The confirm dialog is seen for link tracking ("Enable Anyway"); open tracking is expected to match.
        const enable = builder.page.getByRole('button', { name: 'Enable Anyway' });
        if (await enable.isVisible({ timeout: 5_000 }).catch(() => false)) await enable.click();
        await builder.page.getByRole('alert').filter({ hasText: 'Sequence settings updated successfully' }).waitFor();
      }
    });
    await test.step('Check Track email opens is on and Track link clicks is off', async () => {
      expect(await builder.safetySettingChecked('Track email opens')).toBe(true);
      expect(await builder.safetySettingChecked('Track link clicks')).toBe(false);
    });
    await test.step(`Add the sender ${SENDER}`, async () => {
      await builder.addEmailAccounts(id, [SENDER]);
    });
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
    await test.step('Check the sequence is in the list', async () => {
      await builder.openList();
      expect(await builder.exists(NAME)).toBe(true);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
  });
});
