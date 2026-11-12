import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates, stepHeading } from '../../src/config/account-setup.ts';

// One-time setup of Sequence A and Sequence B for "Contact is created in Salesforce" (AL-4141) on the
// sfemailopened account (QA 2026-11-09). Each gets four Email steps, so a prospect can reach Replied,
// Paused and Active before it completes the sequence (one step ends Completed, QA 2026-11-09).
// Sequence A stops follow-ups on a reply (switch ON), Sequence B keeps sending (switch OFF).
// The sequences are made by tests/setup/account-setup.spec.ts (SETUP_ACCOUNT=sfemailopened). This spec adds
// the missing steps and sets the switch. It does not add a sender and does not activate.
//   SETUP_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-contact-created-sequences.spec.ts --project=chromium --workers=1
const STEPS = 4;
const SEQUENCES = [
  { name: 'Sequence A', stopOnReply: true },
  { name: 'Sequence B', stopOnReply: false },
] as const;
const STOP_LABEL = 'Stop sending follow-ups';

test.describe('Setup: Contact is created in Salesforce sequences', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to change the sequences');
  test.use({ account: 'sfemailopened' });
  test.describe.configure({ retries: 0 });

  for (const seq of SEQUENCES) {
    test(`${seq.name}: ${STEPS} Email steps, "${STOP_LABEL}" ${seq.stopOnReply ? 'ON' : 'OFF'}`, async ({ saleshandySequenceBuilder: builder }) => {
      test.setTimeout(15 * 60_000);
      const id = await test.step('Find the sequence id in the Sequences list', async () => {
        const listLoaded = builder.page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
        await builder.goto('/sequence');
        const text = JSON.stringify(await (await listLoaded).json());
        const found = text.match(new RegExp(`"id":(\\d+)[^{}]*"title":"${seq.name}"|"title":"${seq.name}"[^{}]*"id":(\\d+)`));
        const value = found?.[1] ?? found?.[2];
        if (!value) throw new Error(`${seq.name} is not in the Sequences list. Run tests/setup/account-setup.spec.ts with SETUP_ACCOUNT=sfemailopened first.`);
        return value;
      });
      const steps = builder.page.getByText(/^Step \d+$/);
      for (let n = 1; n <= STEPS; n++) {
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
      test.info().annotations.push({ type: 'sequence id', description: `${seq.name} ${id}` });
    });
  }
});
