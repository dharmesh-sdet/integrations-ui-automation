import fs from 'node:fs';
import path from 'node:path';
import { EXPECTED_MAPPING, EXPECTED_UNMAPPED } from '../../src/config/salesforce-field-mapping.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import type { MappingObject } from '../../src/pages/saleshandy/salesforce-integration.page.ts';

// Gate for the production smoke run of Salesforce > Email Sent from Saleshandy
// (notes/production-testing/07-salesforce-email-sent.md). Run first by
// scripts/run-salesforce-email-sent-smoke.sh; the smoke spec runs only if this passes.
//   1. Salesforce is connected. If the integrations list shows "Re-connect", nothing else
//      runs: the script stops and tells QA to reconnect.
//   2. Per object (Lead, Contact, Opportunity, Account): every pair in EXPECTED_MAPPING is
//      mapped. Missing or different pairs are mapped and saved, then the card is reopened
//      and every pair is read again. The gate passes only when all four match after reload.
// The gate writes the outcome to test-data/salesforce/prod-gate.status
// (passed | reconnect | mapping) for the script to read.
const STATUS_FILE = path.resolve(import.meta.dirname, '../../test-data/salesforce/prod-gate.status');

function writeStatus(status: 'passed' | 'reconnect' | 'mapping'): void {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, status);
}

test.describe.configure({ mode: 'serial' });
test.use({ account: 'emailopenedprod' });

const OBJECTS: MappingObject[] = ['Lead', 'Contact', 'Opportunity', 'Account'];

test.describe('Gate: Salesforce Email Sent, production', () => {
  test('Salesforce is connected (no Re-connect)', async ({ salesforceIntegration }) => {
    test.setTimeout(5 * 60_000);
    // The page can send a connected account to the list for a moment (seen on staging
    // 2026-10-22), so look three times, 20 s apart, before calling it disconnected.
    let connected = false;
    for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
      connected = await salesforceIntegration.isConnected();
      if (!connected && attempt < 3) await salesforceIntegration.page.waitForTimeout(20_000);
    }
    if (!connected) {
      writeStatus('reconnect');
      throw new Error('Salesforce shows "Re-connect" on the production account. Reconnect it (API & Integrations > Integrations > Salesforce), then run again. The smoke rows were not run.');
    }
  });

  for (const object of OBJECTS) {
    test(`Field Mapping > ${object} Properties: every expected pair is mapped`, async ({ salesforceIntegration }) => {
      test.setTimeout(5 * 60_000);
      // Every pair to be mapped, then every field that must show "Select".
      const expected: [string, string][] = [
        ...Object.entries(EXPECTED_MAPPING[object]),
        ...(EXPECTED_UNMAPPED[object] ?? []).map((field): [string, string] => [field, 'Select']),
      ];

      await test.step(`Open the ${object} Properties mapping`, async () => {
        await salesforceIntegration.openMapping(object);
      });

      const wrong: string[] = [];
      for (const [field, property] of expected) {
        if ((await salesforceIntegration.mappedValue(field)) !== property) wrong.push(field);
      }
      test.info().annotations.push({ type: `${object}: missing or different`, description: wrong.length ? wrong.join(', ') : 'none' });

      if (wrong.length) {
        await test.step(`Map ${wrong.length} field(s) and Save`, async () => {
          for (const field of wrong) {
            if (EXPECTED_UNMAPPED[object]?.includes(field)) await salesforceIntegration.unmapField(field);
            else await salesforceIntegration.mapField(field, EXPECTED_MAPPING[object][field]);
          }
          // Save again when the page shows "Something went wrong" (3 tries, 5 s apart). The
          // reload below is the real check: it reads what was stored, not what the toast said.
          let saved = false;
          for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
            saved = await salesforceIntegration.trySaveMapping();
            if (!saved && attempt < 3) await salesforceIntegration.page.waitForTimeout(5_000);
          }
          test.info().annotations.push({ type: `${object}: save confirmed`, description: String(saved) });
        });
      }

      await test.step('Reopen the mapping and read every pair again', async () => {
        await salesforceIntegration.openMapping(object);
        const problems: string[] = [];
        for (const [field, property] of expected) {
          const shown = await salesforceIntegration.mappedValue(field);
          if (shown !== property) problems.push(`${field}: "${shown}" (expected "${property}")`);
        }
        if (problems.length) writeStatus('mapping');
        expect(problems, `${object} Properties after reload`).toEqual([]);
      });
    });
  }

  test('Gate passed', async () => {
    writeStatus('passed');
  });
});
