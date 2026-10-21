import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the production sequence for the Reply Received smoke run
// (QA, 2026-10-15: "you need to create the sequence"). Same shape as
// email-bounced-smoke-sequence.spec.ts, with 2 steps like the staging Reply
// sequence (196293). A production write, so it only runs with
// SETUP_SMOKE_SEQUENCE=1, creates nothing if the sequence is already in the
// list, and is never retried. Sender, schedule and Stop on reply are left as
// the account defaults. It adds no prospect and sends nothing.
//   SETUP_SMOKE_SEQUENCE=1 REPORTS_DIR=reports/reply-smoke-setup REPORT_OPEN=never npx playwright test tests/setup/reply-received-smoke-sequence.spec.ts --project=chromium --workers=1
const NAME = 'HubSpot Reply Received Smoke';
// Staging Reply sequence: step 1 Quick email, step 2 Upselling.
const STEP_TEMPLATES = [libraryTemplates[0], libraryTemplates[2]];

test.describe('Production setup: Reply Received smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });

  test(`Create "${NAME}", add 2 steps and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    // Resume path (2026-10-15): the first run created the sequence and step 1, then
    // the Steps tab stayed blank and step 2 was not added. RESUME_FROM_STEP=2 opens
    // the existing sequence and continues from that step.
    const resumeFrom = Number(process.env.RESUME_FROM_STEP ?? 0);
    let id = '';
    if (await builder.exists(NAME)) {
      if (!resumeFrom) {
        test.info().annotations.push({ type: 'skipped', description: `${NAME} already exists, left as it is` });
        return;
      }
      await builder.openExisting(NAME);
      id = builder.currentSequenceId();
      await builder.page.getByRole('button', { name: 'Add Step' }).first().waitFor({ timeout: 60_000 });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
        console.log(`SEQUENCE_ID=${id}`);
      });
    }
    for (const [i, template] of STEP_TEMPLATES.entries()) {
      if (resumeFrom && i + 1 < resumeFrom) continue;
      await test.step(`Add Step ${i + 1} from the "${template}" library template`, async () => {
        // The second step needs "Add Step" first (two buttons match; exact picks the one under the steps).
        if (i > 0) {
          const add = builder.page.getByRole('button', { name: 'Add Step', exact: true });
          await add.waitFor({ timeout: 60_000 });
          await add.click();
        }
        await builder.addEmailStep(template, `${NAME} step ${i + 1}`);
      });
    }
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
    await test.step('Check the sequence is in the list', async () => {
      await builder.openList();
      expect(await builder.exists(NAME)).toBe(true);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
  });
});
