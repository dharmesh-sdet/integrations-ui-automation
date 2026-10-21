import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of the production sequence for the Link Clicked smoke run.
// A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1, creates
// nothing if the sequence is already in the list, and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/link-clicked-smoke-sequence.spec.ts --project=chromium --workers=1
// Plan: specs/link-clicked-smoke-sequence.md. Seed: tests/seeds/linkclick.seed.spec.ts.
const NAME = 'HubSpot Link Clicked Smoke';
// The smoke run reads this subject as SMOKE_STEP1_SUBJECT (printed at the end).
const STEP_1_SUBJECT = 'Quick question about your outreach';
const LINKS = ['https://www.saleshandy.com', 'https://www.saleshandy.com/pricing/'];
const BODY_HTML =
  '<p>Hello, please see <a href="https://www.saleshandy.com">home</a> and ' +
  '<a href="https://www.saleshandy.com/pricing/">pricing</a>.</p>';

test.describe('Production setup: Link Clicked smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add step 1 with 2 links, turn on Track link clicks and activate it`, async ({
    saleshandySequenceBuilder: builder,
    saleshandySequence,
  }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    let id = '';
    if (await builder.exists(NAME)) {
      // A first run created the sequence and stopped part way (2026-10-15). Open it
      // and do only what is missing.
      await test.step(`Open the existing "${NAME}"`, async () => {
        await builder.openExisting(NAME);
        id = builder.currentSequenceId();
      });
      await test.step('Add step 1 if the sequence has none', async () => {
        if ((await builder.page.getByText(STEP_1_SUBJECT).count()) === 0) {
          await builder.addEmailStepWithLinks(STEP_1_SUBJECT, BODY_HTML, LINKS);
        }
      });
      await test.step('Turn on Track link clicks if it is off', async () => {
        await builder.enableLinkTrackingIfOff();
      });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1 with the subject and two links in the body', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, BODY_HTML, LINKS);
      });
      await test.step('Turn on Track link clicks in Safety Settings', async () => {
        await builder.enableLinkTracking();
      });
    }
    await test.step('Check Track link clicks is on and the other two switches are off', async () => {
      expect(await builder.safetySettingChecked('Track link clicks')).toBe(true);
      expect(await builder.safetySettingChecked('Track email opens')).toBe(false);
      expect(await builder.safetySettingChecked('Send emails as text only')).toBe(false);
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
    console.log(`STEP_1_SUBJECT=${STEP_1_SUBJECT}`);
  });
});
