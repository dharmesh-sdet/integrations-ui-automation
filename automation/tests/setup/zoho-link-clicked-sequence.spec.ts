import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of the sequence for the Zoho "Link is Clicked in Saleshandy" tests on the
// notemailsentzoho account. Two steps with two links each, Track link clicks on, Track email opens off
// (so a click does not also fire Email Opened). It adds no sender: QA connects the mailbox by hand
// (a sender that other Zoho sequences do not use). Creates nothing that is already there; the id is printed either way.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/zoho-link-clicked-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into ZOHO_LC_SEQUENCE_ID.
const NAME = 'Zoho Link Clicked QA';
const STEP_1_SUBJECT = 'Quick question about your outreach';
const STEP_2_SUBJECT = 'Following up on my last note';
const LINKS = ['https://www.saleshandy.com', 'https://www.saleshandy.com/pricing/'];
const body = (intro: string) =>
  `<p>${intro} <a href="${LINKS[0]}">home</a> and <a href="${LINKS[1]}">pricing</a>.</p>`;

test.describe('Setup: Zoho Link Clicked sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'notemailsentzoho' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add steps 1 and 2 with two links, turn link tracking on and open tracking off, activate it`, async ({
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
    await test.step('Turn off Track email opens in Safety Settings (left alone when off)', async () => {
      await builder.setSafetySetting('Track email opens', false);
    });
    await test.step('Check the two switches', async () => {
      expect(await builder.safetySettingChecked('Track link clicks')).toBe(true);
      expect(await builder.safetySettingChecked('Track email opens')).toBe(false);
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
