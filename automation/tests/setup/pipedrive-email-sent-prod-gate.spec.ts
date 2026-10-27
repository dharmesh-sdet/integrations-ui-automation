import fs from 'node:fs';
import path from 'node:path';
import { EXPECTED_MAPPING, type PipedriveMappingCard } from '../../src/config/pipedrive-field-mapping.ts';
import { isAccount } from '../../src/config/accounts.ts';
import { expect, test } from '../../src/fixtures/index.ts';

// Gate for the production smoke run of Pipedrive > Email Sent from Saleshandy
// (notes/production-testing/09-pipedrive-email-sent.md). Run first by
// scripts/run-pipedrive-email-sent-smoke.sh; the smoke spec runs only if this passes.
//   1. Pipedrive is connected: the integration page shows "Disconnect". If it does not, nothing
//      else runs and the script tells QA to reconnect.
//   2. Contact Fields, Deal Fields and Organisation Fields: every pair in EXPECTED_MAPPING shows
//      its Pipedrive field. Missing or different pairs are mapped and saved, then the card is
//      reopened and every pair is read again. The gate passes only when all three match after the
//      reload; any leftover difference stops the run and is listed.
// The outcome goes to test-data/pipedrive/prod-gate.status (passed | reconnect | mapping).
// GATE_ACCOUNT=gpipedrive runs the same reads on staging, to check the selectors.
const STATUS_FILE = path.resolve(import.meta.dirname, '../../test-data/pipedrive/prod-gate.status');

function writeStatus(status: 'passed' | 'reconnect' | 'mapping'): void {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, status);
}

const override = process.env.GATE_ACCOUNT;
test.describe.configure({ mode: 'serial' });
test.use({ account: isAccount(override) ? override : 'emailopenedprod' });

const CARDS: PipedriveMappingCard[] = ['Contact Fields', 'Deal Fields', 'Organisation Fields'];

test.describe('Gate: Pipedrive Email Sent, production', () => {
  test('Pipedrive is connected (Disconnect shows)', async ({ pipedriveIntegration }) => {
    test.setTimeout(5 * 60_000);
    // The page can send a connected account to the list for a moment, so look three times, 20 s apart.
    let connected = false;
    for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
      connected = await pipedriveIntegration.isConnected();
      if (!connected && attempt < 3) await pipedriveIntegration.page.waitForTimeout(20_000);
    }
    if (!connected) {
      writeStatus('reconnect');
      throw new Error('Pipedrive shows "Re-connect" on this account. Reconnect it (API & Integrations > Integrations > Pipedrive), then run again. The smoke rows were not run.');
    }
  });

  for (const card of CARDS) {
    test(`Field Mapping > ${card}: every expected pair is mapped`, async ({ pipedriveIntegration }) => {
      test.setTimeout(5 * 60_000);
      await test.step(`Open ${card}`, async () => {
        await pipedriveIntegration.openMappingCard(card);
      });
      const expected = Object.entries(EXPECTED_MAPPING[card]);
      const wrong: string[] = [];
      for (const [field, property] of expected) {
        if ((await pipedriveIntegration.mappedValue(field)) !== property) wrong.push(field);
      }
      test.info().annotations.push({ type: `${card}: missing or different`, description: wrong.length ? wrong.join(', ') : 'none' });

      if (wrong.length) {
        await test.step(`Map ${wrong.length} field(s) and Save`, async () => {
          for (const field of wrong) await pipedriveIntegration.mapField(field, EXPECTED_MAPPING[card][field]);
          // Save again when the page shows "Something went wrong" (3 tries, 5 s apart). The reload below
          // is the real check: it reads what was stored, not what the toast said.
          let saved = false;
          for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
            saved = await pipedriveIntegration.trySaveMapping();
            if (!saved && attempt < 3) await pipedriveIntegration.page.waitForTimeout(5_000);
          }
          test.info().annotations.push({ type: `${card}: save confirmed`, description: String(saved) });
        });
      }

      await test.step('Reopen the card and read every pair again', async () => {
        await pipedriveIntegration.openMappingCard(card);
        const problems: string[] = [];
        for (const [field, property] of expected) {
          const shown = await pipedriveIntegration.mappedValue(field);
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
