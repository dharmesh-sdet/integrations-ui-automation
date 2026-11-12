// Helpers for the production smoke of "Account is created in Salesforce"
// (tests/salesforce/account-created-smoke.spec.ts). The staging rows keep their own helpers in
// salesforce-to-saleshandy.ts. On production a run reads only the Accounts created since its last run (proven
// 2026-11-12: the first run read 38 Accounts, the next run 80 s later read the 1 new Account, although 37 Accounts were
// younger than 3 hours; the staging workflow version reads 3 hours). The start time of the last run is kept in a file.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '../fixtures/index.ts';
import type { Page } from '@playwright/test';
import { SalesforceApi } from '../utils/salesforce-api.ts';
import { RefoldRunNow } from './refold-run-now.ts';

// ACCOUNT_TRIGGER_NAME overrides the name if production shows another one.
export const ACC_TRIGGER = process.env.ACCOUNT_TRIGGER_NAME ?? 'Account is created in Salesforce';

// The start time of the last run of this workflow on production. ACC_LAST_RUN_FILE overrides the path. If the file is
// missing, the window is the last 10 minutes.
const lastFile = (): string => process.env.ACC_LAST_RUN_FILE ?? path.resolve(import.meta.dirname, '../../test-data/salesforce/account-created-smoke-lastrun.txt');
const lastRun = (): string => (fs.existsSync(lastFile()) ? fs.readFileSync(lastFile(), 'utf8').trim() : new Date(Date.now() - 10 * 60_000).toISOString());
const sinceLast = (): string => lastRun().replace(/\.\d+Z$/, '.000Z');

export type AccRun = { id: string; skipped: string[] };

// Starts the workflow now through Refold and waits for COMPLETED. The Logs tab is not opened.
export async function runAccountNow(page: Page): Promise<AccRun> {
  const started = new Date().toISOString();
  const refoldPage = await page.context().newPage();
  try {
    const refold = await RefoldRunNow.open(refoldPage);
    const id = await refold.run(ACC_TRIGGER);
    const run = await refold.waitForEnd(id, 10 * 60_000);
    fs.mkdirSync(path.dirname(lastFile()), { recursive: true });
    fs.writeFileSync(lastFile(), started);
    const bad = (run.nodes ?? []).filter((n) => n.node_status && !/complete|success|skip/i.test(n.node_status));
    test.info().annotations.push({ type: 'Refold run', description: `${id}: ${run.status}` });
    expect(run.status, `Refold run ${id}; steps not completed: ${bad.map((n) => `${n.node_name} (${n.node_status})`).join(', ') || 'none'}`).toBe('COMPLETED');
    return { id, skipped: (run.nodes ?? []).filter((n) => /skip/i.test(n.node_status ?? '')).map((n) => n.node_name) };
  } finally {
    await refoldPage.close();
  }
}

// Accounts created since the last run whose name does not hold this run's stamp: other people's Accounts that the
// next run would read.
export async function foreignAccountsInWindow(sf: SalesforceApi, stamp: string): Promise<number> {
  return (await sf.query(`SELECT Id FROM Account WHERE CreatedDate > ${sinceLast()} AND (NOT Name LIKE '%${stamp}%')`)).length;
}

// Emails of the Contacts on Accounts created since the last run: the people the next run reads. A Move run moves all of
// them, not only the one the check made, so the sends of a Move run are counted from this list.
export async function contactEmailsInWindow(sf: SalesforceApi): Promise<string[]> {
  const rows: { Email: string }[] = await sf.query(`SELECT Email FROM Contact WHERE Email != null AND AccountId != null AND Account.CreatedDate > ${sinceLast()} LIMIT 2000`);
  return [...new Set(rows.map((r) => r.Email.toLowerCase()))];
}
