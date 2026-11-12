// Helpers for the production smoke of "Opportunity is created in Salesforce"
// (tests/salesforce/opportunity-created-smoke.spec.ts). The staging rows keep their own helpers in
// salesforce-to-saleshandy.ts. This file adds what the smoke needs: its own last-run file (so staging runs do not
// move the window), a run-now that opens its own page, and the count of Opportunities in the window.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/index.ts';
import { SalesforceApi } from '../utils/salesforce-api.ts';
import { RefoldRunNow } from './refold-run-now.ts';

// OPPORTUNITY_TRIGGER_NAME overrides the name if production shows another one.
export const OPP_TRIGGER = process.env.OPPORTUNITY_TRIGGER_NAME ?? 'Opportunity is created in Salesforce';

// The workflow reads only Opportunities created since its last run (proven on staging 2026-11-11: a second run 30 s
// later read 0 records for a deal the first run read). The start time of the last run is kept in a file.
const lastFile = (): string => process.env.OPP_LAST_RUN_FILE ?? path.join(os.tmpdir(), 'opportunity-created-smoke-lastrun.txt');
const lastRun = (): string => (fs.existsSync(lastFile()) ? fs.readFileSync(lastFile(), 'utf8').trim() : new Date(Date.now() - 10 * 60_000).toISOString());

export type OppRun = { id: string; skipped: string[] };

// Starts the workflow now through Refold and waits for COMPLETED. The Logs tab is not opened.
export async function runOpportunityNow(page: Page): Promise<OppRun> {
  const started = new Date().toISOString();
  const refoldPage = await page.context().newPage();
  try {
    const refold = await RefoldRunNow.open(refoldPage);
    const id = await refold.run(OPP_TRIGGER);
    const run = await refold.waitForEnd(id, 10 * 60_000);
    fs.writeFileSync(lastFile(), started);
    const bad = (run.nodes ?? []).filter((n) => n.node_status && !/complete|success|skip/i.test(n.node_status));
    test.info().annotations.push({ type: 'Refold run', description: `${id}: ${run.status}` });
    expect(run.status, `Refold run ${id}; steps not completed: ${bad.map((n) => `${n.node_name} (${n.node_status})`).join(', ') || 'none'}`).toBe('COMPLETED');
    return { id, skipped: (run.nodes ?? []).filter((n) => /skip/i.test(n.node_status ?? '')).map((n) => n.node_name) };
  } finally {
    await refoldPage.close();
  }
}

// Opportunities created since the last run started: the window the next run reads.
export async function opportunitiesInWindow(sf: SalesforceApi): Promise<number> {
  return (await sf.query(`SELECT Id FROM Opportunity WHERE CreatedDate > ${lastRun().replace(/\.\d+Z$/, '.000Z')}`)).length;
}
