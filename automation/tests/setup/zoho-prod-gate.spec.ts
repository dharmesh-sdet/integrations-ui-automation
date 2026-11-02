import fs from 'node:fs';
import path from 'node:path';
import { isAccount } from '../../src/config/accounts.ts';
import { ZOHO_FIELD_MAPPING, ZOHO_MAPPING_CARDS } from '../../src/config/zoho-field-mapping.ts';
import { expect, test } from '../../src/fixtures/index.ts';

// Gate for the production smoke run of Zoho > Email is Opened in Saleshandy
// (notes/production-testing/16-zoho-email-opened.md). Run first by scripts/run-zoho-email-opened-smoke.sh;
// the smoke spec runs only if this passes.
//   1. Zoho is connected on the account: the integration page does not show Re-connect. If it does,
//      nothing else runs and the script tells QA to reconnect.
//   2. Contact, Lead, Account and Deal Fields: every pair in ZOHO_FIELD_MAPPING shows its Zoho field.
//      Missing or different pairs are mapped and saved, then the card is reopened and every pair is read
//      again. The gate passes only when all four match after the reload.
// The outcome goes to test-data/zoho/prod-gate.status (passed | reconnect | mapping).
// GATE_ACCOUNT=notemailsentzoho runs the same reads on staging, to check the selectors.
const STATUS_FILE = path.resolve(import.meta.dirname, '../../test-data/zoho/prod-gate.status');

function writeStatus(status: 'passed' | 'reconnect' | 'mapping'): void {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, status);
}

const override = process.env.GATE_ACCOUNT;
test.describe.configure({ mode: 'serial' });
test.use({ account: isAccount(override) ? override : 'emailopenedprod' });

test.describe('Gate: Zoho Email Opened, production', () => {
  test('Zoho is connected', async ({ zohoIntegration }) => {
    test.setTimeout(5 * 60_000);
    // The page can send a connected account to the list for a moment, so look three times, 20 s apart.
    let connected = false;
    for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
      connected = await zohoIntegration.isConnected();
      if (!connected && attempt < 3) await zohoIntegration.page.waitForTimeout(20_000);
    }
    if (!connected) {
      writeStatus('reconnect');
      throw new Error('Zoho is not connected on this account (API & Integrations > Integrations > Zoho). Connect it, then run again. The smoke rows were not run.');
    }
  });

  for (const card of ZOHO_MAPPING_CARDS) {
    test(`Field Mapping > ${card}: every expected pair is mapped`, async ({ zohoIntegration }) => {
      test.setTimeout(5 * 60_000);
      await test.step(`Open ${card}`, async () => {
        await zohoIntegration.openMappingCard(card);
      });
      const expected = Object.entries(ZOHO_FIELD_MAPPING[card]);
      const wrong: string[] = [];
      for (const [field, property] of expected) {
        if ((await zohoIntegration.mappedValue(field)) !== property) wrong.push(field);
      }
      test.info().annotations.push({ type: `${card}: missing or different`, description: wrong.length ? wrong.join(', ') : 'none' });

      if (wrong.length) {
        await test.step(`Map ${wrong.length} field(s) and Save`, async () => {
          for (const field of wrong) await zohoIntegration.mapField(field, ZOHO_FIELD_MAPPING[card][field]);
          // Save again when the page shows "Something went wrong" (3 tries, 5 s apart). The reload below
          // is the real check: it reads what was stored, not what the toast said.
          let saved = false;
          for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
            saved = await zohoIntegration.trySaveMapping();
            if (!saved && attempt < 3) await zohoIntegration.page.waitForTimeout(5_000);
          }
          test.info().annotations.push({ type: `${card}: save confirmed`, description: String(saved) });
        });
      }

      await test.step('Reopen the card and read every pair again', async () => {
        await zohoIntegration.openMappingCard(card);
        const problems: string[] = [];
        for (const [field, property] of expected) {
          const shown = await zohoIntegration.mappedValue(field);
          if (shown !== property) problems.push(`${field}: "${shown}" (expected "${property}")`);
        }
        if (problems.length) writeStatus('mapping');
        expect(problems, `${card} after reload`).toEqual([]);
      });
    });
  }

  test('Gate passed', async () => {
    writeStatus('passed');
  });
});
