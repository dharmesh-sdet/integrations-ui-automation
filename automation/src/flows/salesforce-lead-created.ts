// Helpers for "Lead is created in Salesforce" (tests/salesforce/lead-created.spec.ts).
// Each row makes a Lead through the Salesforce REST API (no Lightning form), starts the
// workflow at once through Refold run-now (no 3-hour cron wait) and checks the prospect in
// Saleshandy. Findings behind these helpers: context/salesforce/salesforce-created-progress.md
// (2026-11-09 probes).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/index.ts';
import type { SalesforceIntegrationPage } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { SaleshandyCrmPage } from '../pages/saleshandy/crm.page.ts';
import { SalesforceApi, type LeadInput } from '../utils/salesforce-api.ts';
import { untilPasses } from '../utils/wait.ts';
import { RefoldRunNow } from './refold-run-now.ts';

// LEAD_TRIGGER_NAME overrides the name (production may show another one, staging has no "(V1)" either).
export const TRIGGER = process.env.LEAD_TRIGGER_NAME ?? 'Lead is created in Salesforce';
export const ACT = {
  add: 'Add Prospect in Saleshandy',
  move: 'Move Prospect to another Sequence in Saleshandy',
  unsubscribed: 'Mark Prospect as Unsubscribed in Saleshandy',
  finished: 'Mark Prospect as Finished in Saleshandy',
  replied: 'Mark Prospect as Replied in Saleshandy',
  paused: 'Mark Prospect as Paused in Saleshandy',
  resume: 'Mark Prospect as Resume(Un-pause) in Saleshandy',
  tag: 'Assign a tag to Prospect in Saleshandy',
  blacklist: 'Blacklist a Domain in Saleshandy',
} as const;
export const SEQ_A = 'Sequence A'; // one step, active
export const SEQ_B = 'Sequence B'; // four steps, active: status rows
export const TAG = 'TagA';
export const STEP_1 = 'Step 1 - Day 1';
export const VIEWS = ["All Open Leads", 'My Unread Leads', "Today's Leads", 'View - Custom 2', 'View - Custom 1', 'Recently Viewed Leads'];

export type Pick = { activity: string; seq?: string; step?: boolean; days?: boolean; tag?: boolean };

// The "Select a list" field is one workflow-level multi-select shared by all activities and it
// keeps earlier picks, so every row sets exactly the lists it wants.
export async function setLists(i: SalesforceIntegrationPage, lists: string[]): Promise<void> {
  const dialog = i.extraConfiguration();
  if ((await dialog.getByText('Select a list', { exact: true }).count()) === 0) return;
  const box = dialog.locator('.bs-select-box').last();
  await expect(box).not.toHaveText('Loading...', { timeout: 30_000 });
  await i.page.waitForTimeout(3000);
  await box.click();
  const items = i.page.locator('.transfer-list li');
  await items.first().waitFor({ timeout: 15_000 });
  for (const li of await items.all()) {
    const name = (await li.innerText()).trim();
    const on = await li.locator('input[type=checkbox]').isChecked();
    if (on !== lists.includes(name)) await li.click();
  }
}

// Only `picks` under the trigger, each with its Extra Configuration and `lists`, the trigger on
// and every other trigger off, saved. Every chip is removed first, so no earlier pick stays.
export async function useActivities(i: SalesforceIntegrationPage, picks: Pick[], lists: string[] = []): Promise<void> {
  await i.openTriggers();
  await i.enableOnly(TRIGGER);
  for (const chip of await i.selectedActivities(TRIGGER)) await i.removeActivity(TRIGGER, chip);
  for (const p of picks) {
    await i.selectActivity(TRIGGER, p.activity);
    const dialog = await i.extraConfiguration().waitFor({ timeout: 6_000 }).then(() => true, () => false);
    if (!dialog) continue;
    if (p.seq) await i.chooseConfigOption('Sequence', p.seq);
    if (p.step) await i.chooseConfigOption('Sequence Steps', STEP_1);
    if (p.days) await i.pauseDays().fill('1');
    if (p.tag) await i.createAndSelectTag(TAG);
    await setLists(i, lists);
    await i.extraConfiguration().getByText('Extra Configuration').first().click();
    await i.configSaveButton().click();
  }
  await i.save();
  await expect(i.savedToast(), 'save confirmation').toBeVisible();
}

// ---- runs and the Leads window ----

// The workflow reads only Leads created since its last run, so the start time of the last run
// is kept in a file (a rerun of one row still knows it).
// LEAD_LAST_RUN_FILE gives the production smoke its own file, so a staging run does not move its window.
const lastFile = (): string => process.env.LEAD_LAST_RUN_FILE ?? path.join(os.tmpdir(), 'lead-created-lastrun.txt');
const lastRun = (): string => (fs.existsSync(lastFile()) ? fs.readFileSync(lastFile(), 'utf8').trim() : new Date(Date.now() - 10 * 60_000).toISOString());

export type RunResult = { id: string; skipped: string[] };

export async function runNow(page: Page): Promise<RunResult> {
  const started = new Date().toISOString();
  const refoldPage = await page.context().newPage();
  try {
    const refold = await RefoldRunNow.open(refoldPage);
    const id = await refold.run(TRIGGER);
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

// Like runNow, but the run is expected to end ERRORED at exactly the named step (QA 2026-11-11:
// a domain that is already on the Do Not Contact list makes "Blacklist Domains (Bulk)" fail).
export async function runNowExpectingError(page: Page, step: string): Promise<RunResult> {
  const started = new Date().toISOString();
  const refoldPage = await page.context().newPage();
  try {
    const refold = await RefoldRunNow.open(refoldPage);
    const id = await refold.run(TRIGGER);
    const run = await refold.waitForEnd(id, 10 * 60_000);
    fs.writeFileSync(lastFile(), started);
    test.info().annotations.push({ type: 'Refold run', description: `${id}: ${run.status}` });
    const errored = (run.nodes ?? []).filter((n) => /error/i.test(n.node_status ?? '')).map((n) => n.node_name);
    expect(run.status, `Refold run ${id}`).toBe('ERRORED');
    expect(errored, `steps that errored in run ${id}`).toEqual([step]);
    return { id, skipped: [] };
  } finally {
    await refoldPage.close();
  }
}

// Leads created since the last run started: the window the next run reads.
export async function windowCount(sf: SalesforceApi): Promise<number> {
  return (await sf.query(`SELECT Id FROM Lead WHERE CreatedDate > ${lastRun().replace(/\.\d+Z$/, '.000Z')}`)).length;
}

// ---- people ----

const PEOPLE: [string, string, string, string][] = [
  ['Ingrid', 'Solberg', 'Solberg Marine', 'Port Coordinator'], ['Chloe', 'Dubois', 'Dubois Bakery', 'Owner'],
  ['Mateo', 'Rivas', 'Rivas Cycles', 'Shop Owner'], ['Freya', 'Lindgren', 'Lindgren Marine', 'Dock Manager'],
  ['Tomas', 'Havel', 'Havel Glass', 'Plant Owner'], ['Nadia', 'Rahman', 'Rahman Tailors', 'Founder'],
  ['Elena', 'Marin', 'Marin Ceramics', 'Studio Owner'], ['Marta', 'Silva', 'Silva Imports', 'Buyer'],
  ['Oskar', 'Lund', 'Lund Timber', 'Site Manager'], ['Ines', 'Calderon', 'Calderon Textiles', 'Buyer'],
  ['Pavel', 'Novak', 'Novak Metalworks', 'Plant Manager'], ['Sofia', 'Lindqvist', 'Lindqvist Design', 'Creative Lead'],
  ['Jonas', 'Keller', 'Keller Optics', 'Store Manager'], ['Rafael', 'Ortega', 'Ortega Foods', 'Sales Director'],
  ['Hannah', 'Weiss', 'Weiss Analytics', 'Data Lead'], ['Diego', 'Fuentes', 'Fuentes Marine', 'Fleet Manager'],
  ['Mei', 'Tanaka', 'Tanaka Robotics', 'Engineering Manager'], ['Olga', 'Petrova', 'Petrova Dental', 'Practice Owner'],
  ['Kwame', 'Mensah', 'Mensah Coffee', 'Roaster'], ['Priya', 'Nair', 'Nair Pharma', 'Regulatory Lead'],
  ['Lucas', 'Moreau', 'Moreau Wines', 'Cellar Master'], ['Amara', 'Okafor', 'Okafor Logistics', 'Fleet Planner'],
  ['Nils', 'Berg', 'Berg Shipping', 'Operations Lead'], ['Leila', 'Haddad', 'Haddad Spices', 'Export Manager'],
  ['Viktor', 'Orlov', 'Orlov Steel', 'Procurement Lead'], ['Yuki', 'Sato', 'Sato Ceramics', 'Production Lead'],
  ['Camila', 'Reyes', 'Reyes Coffee', 'Roastmaster'], ['Anders', 'Holm', 'Holm Boats', 'Yard Manager'],
  ['Zainab', 'Bello', 'Bello Textiles', 'Merchandiser'], ['Hugo', 'Martin', 'Martin Bikes', 'Workshop Lead'],
];
let next = Math.floor(Math.random() * PEOPLE.length);
const stamp = Date.now().toString(36);
let counter = 0;

// A new person per call. The email is new on every run (Salesforce rejects look-alike Leads).
export function newLead(over: Partial<LeadInput> = {}): LeadInput & { email: string; fullName: string } {
  const [first, last, company, title] = PEOPLE[next++ % PEOPLE.length];
  counter += 1;
  const email = `${first}.${last}.${stamp}${counter}@mailinator.com`.toLowerCase();
  return { firstName: first, lastName: last, company, title, phone: '+1 646 555 0113', email, fullName: `${first} ${last}`, ...over } as LeadInput & { email: string; fullName: string };
}

// ---- checks ----

export type Want = {
  status?: string;
  sequence?: string;
  tag?: string;
  fields?: Record<string, string>;
  none?: boolean;
  // Text in the Activities section of the prospect details.
  activity?: RegExp;
};

export async function expectProspect(crm: SaleshandyCrmPage, email: string, fullName: string, want: Want, timeoutMs = 90_000): Promise<void> {
  await untilPasses(`Prospect ${email} did not reach the expected state`, async () => {
    const n = await crm.search(email || fullName.split(' ').pop()!);
    if (want.none) return expect(n, `prospects with ${email}`).toBe(0);
    expect(n, `prospects with ${email}`).toBe(1);
    // The sidebar can cover the table and block the click on the prospect's name (seen 2026-11-09).
    await crm.closeSidebar();
    if (want.status) expect(await crm.latestStatus(email), `Latest Status of ${email}`).toBe(want.status);
    if (want.sequence) expect(await crm.sequenceAssociated(email), `Sequence of ${email}`).toBe(want.sequence);
    if (want.tag) expect(await crm.prospectTags(email), `Tags of ${email}`).toContain(want.tag);
    if (want.fields || want.activity) {
      await crm.openProspect(fullName);
      for (const [label, value] of Object.entries(want.fields ?? {})) await expect(crm.field(label), label).toHaveText(value);
      if (want.activity) await expect(crm.page.getByRole('dialog'), 'Activities section').toContainText(want.activity);
      await crm.page.keyboard.press('Escape');
    }
  }, timeoutMs);
}
