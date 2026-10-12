import { fieldMapping, libraryTemplates, sequences, stepHeading, type MappingObject } from '../../src/config/account-setup.ts';
import { isAccount } from '../../src/config/accounts.ts';
import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of a new workflow account, after QA has created it, turned
// off OTP and connected HubSpot. Safe to run again: mapping is set to the same
// values and existing sequences are left alone.
//   SETUP_ACCOUNT=companycreated REPORT_OPEN=never npm test -- tests/setup/account-setup.spec.ts --workers=1
// Without SETUP_ACCOUNT (e.g. a plain npm test) it is skipped.
const account = process.env.SETUP_ACCOUNT;

test.describe('Account setup', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!account, 'Set SETUP_ACCOUNT=<account> to run the account setup');
  if (account && !isAccount(account)) throw new Error(`Unknown SETUP_ACCOUNT "${account}" (src/config/accounts.ts)`);
  test.use({ account: isAccount(account) ? account : undefined });

  for (const object of Object.keys(fieldMapping) as MappingObject[]) {
    test(`Field mapping > ${object}`, async ({ saleshandyFieldMapping: mapping }) => {
      const wanted: Record<string, string> = fieldMapping[object];

      await test.step(`Open ${object} in Field Mapping`, async () => {
        await mapping.open(object);
      });

      await test.step('Choose the HubSpot property for each field, then Save', async () => {
        // Saved values load a moment after the rows, so every pair is chosen
        // (choosing the shown value again changes nothing). Other mapped fields are left as they are.
        for (const [field, property] of Object.entries(wanted)) await mapping.choose(field, property);
        await mapping.save();
      });

      await test.step('Reload and check every pair is saved', async () => {
        // Once seen 2026-10-09: the first Save dropped the last row (Closing Date).
        await mapping.open(object);
        await expect
          .poll(async () => {
            const saved = await mapping.mapped();
            return Object.entries(wanted).filter(([field, property]) => saved[field] !== property).map(([field]) => field);
          }, { message: 'Fields not saved with the wanted HubSpot property', timeout: 15_000 })
          .toEqual([]);
      });
    });
  }

  for (const sequence of (isAccount(account) && sequences[account]) || []) {
    test(`Sequence > ${sequence.name}`, async ({ saleshandySequenceBuilder: builder }) => {
      await test.step('Open the Sequences list', async () => {
        await builder.openList();
      });

      if (await builder.exists(sequence.name)) {
        test.info().annotations.push({ type: 'skipped', description: `${sequence.name} already exists, left as it is` });
        return;
      }

      await test.step(`Create the sequence "${sequence.name}"`, async () => {
        await builder.create(sequence.name);
      });

      for (const s of sequence.steps) {
        const template = libraryTemplates[s.template - 1];
        if (!template) throw new Error(`Template ${s.template} is not in libraryTemplates (src/config/account-setup.ts)`);
        await test.step(`Add Step ${s.step} ${s.variant} from Template ${s.template} (${template})`, async () => {
          await builder.addEmailStep(template, stepHeading(sequence.name, s));
        });
      }

      await test.step('Check the sequence is in the list', async () => {
        await builder.openList();
        expect(await builder.exists(sequence.name)).toBe(true);
      });
    });
  }
});
