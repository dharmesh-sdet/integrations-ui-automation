import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of the sequence for the Pipedrive "Link is Clicked in Saleshandy" tests (AL-4175)
// on the gpipedrive account. Two steps with two links each, Track link clicks on, sender Kartik 7
// (not used by the other Pipedrive sequences: Kartik 2, 3, 4 in 197336, Kartik 5 in 197337, 197338,
// Kartik 60 in 197339). Creates nothing that is already there; the id is printed either way.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-link-clicked-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into tests/pipedrive/link-clicked.spec.ts.
const NAME = 'Pipedrive Link Clicked QA';
const STEP_1_SUBJECT = 'Quick question about your outreach';
const STEP_2_SUBJECT = 'Following up on my last note';
const LINKS = ['https://www.saleshandy.com', 'https://www.saleshandy.com/pricing/'];
const body = (intro: string) =>
  `<p>${intro} <a href="${LINKS[0]}">home</a> and <a href="${LINKS[1]}">pricing</a>.</p>`;

test.describe('Setup: Pipedrive Link Clicked sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'gpipedrive' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add steps 1 and 2 with two links, turn on link tracking, activate it`, async ({
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
        // Wait for the steps list to load: a step subject, or the empty-sequence Email button.
        await builder.page
          .getByText(STEP_1_SUBJECT)
          .or(builder.page.getByRole('button', { name: 'Email', exact: true }))
          .first()
          .waitFor({ timeout: 30_000 });
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
      await test.step('Add step 1 with the subject and two links in the body', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, please see'), LINKS);
      });
      await test.step('Add step 2 with the subject and two links in the body', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
        await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, the details are on'), LINKS);
      });
    }
    await test.step('Turn on Track link clicks in Safety Settings (left alone when on)', async () => {
      await builder.enableLinkTrackingIfOff();
    });
    await test.step('Check Track link clicks is on', async () => {
      expect(await builder.safetySettingChecked('Track link clicks')).toBe(true);
    });
    // QA connected the sender accounts to the sequence by hand (2026-10-28). Kartik 7 is not offered in
    // the add dialog ("No email account available"), so this spec adds none.
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
