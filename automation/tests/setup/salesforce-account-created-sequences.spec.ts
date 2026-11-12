import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates, stepHeading } from '../../src/config/account-setup.ts';
import { addListedSender } from '../../src/flows/smoke-sender.ts';

// One-time setup of Sequence A and Sequence B for "Account is created in Salesforce" (AL-4143) on the
// sfemailsent account (QA 2026-11-12: create A and B, leave the two existing sequences alone).
// Sequence A has 2 Email steps and stops follow-ups on a reply (switch ON). Sequence B has 4 Email steps and
// keeps sending (switch OFF), as on the Lead run. A sender from the Add dialog list is added and both
// sequences are activated. Existing sequences with the same name are reused: missing steps, sender and
// activation are filled in.
//   SETUP_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-account-created-sequences.spec.ts --project=chromium --workers=1
const SEQUENCES = [
  { name: 'Sequence A', steps: 2, stopOnReply: true },
  { name: 'Sequence B', steps: 4, stopOnReply: false },
] as const;
const STOP_LABEL = 'Stop sending follow-ups';

test.describe('Setup: Account is created in Salesforce sequences', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to change the sequences');
  test.use({ account: 'sfemailsent' });
  test.describe.configure({ retries: 0, mode: 'serial' });

  for (const seq of SEQUENCES) {
    test(`${seq.name}: ${seq.steps} Email steps, "${STOP_LABEL}" ${seq.stopOnReply ? 'ON' : 'OFF'}, sender, active`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
      test.setTimeout(20 * 60_000);
      await builder.openList();
      let id: string;
      if (await builder.exists(seq.name)) {
        id = await builder.idOf(seq.name);
        test.info().annotations.push({ type: 'reused', description: `${seq.name} already exists (${id})` });
      } else {
        id = await builder.create(seq.name);
      }
      const steps = builder.page.getByText(/^Step \d+$/);
      for (let n = 1; n <= seq.steps; n++) {
        await builder.goto(`/sequence/${id}/steps`);
        await builder.page.getByRole('button', { name: 'Email', exact: true }).or(builder.page.getByRole('button', { name: /Add Step/ })).first().waitFor({ timeout: 30_000 });
        if ((await steps.count()) >= n) continue;
        await test.step(`Add Step ${n}`, async () => {
          if (n > 1) await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
          await builder.addEmailStep(libraryTemplates[(n - 1) % libraryTemplates.length], stepHeading(seq.name, { step: n, variant: 'A', template: n }));
        });
      }
      await test.step(`Turn "${STOP_LABEL}" ${seq.stopOnReply ? 'on' : 'off'}`, async () => {
        await builder.goto(`/sequence/${id}/steps`);
        await builder.setSafetySetting(STOP_LABEL, seq.stopOnReply);
      });
      expect(await builder.safetySettingChecked(STOP_LABEL), STOP_LABEL).toBe(seq.stopOnReply);
      await test.step('Add a sender from the list the dialog shows', async () => {
        console.log(`${seq.name} SENDER=${await addListedSender(builder.page, id, [])}`);
      });
      await test.step('Activate the sequence', async () => {
        await saleshandySequence.resumeSequence(id);
      });
      test.info().annotations.push({ type: 'sequence id', description: `${seq.name} ${id}` });
      console.log(`${seq.name} SEQUENCE_ID=${id}`);
    });
  }
});
