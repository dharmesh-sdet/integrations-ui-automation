import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '../../src/fixtures/index.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { sendStep } from '../../src/flows/zoho-email-sent.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import type { Row } from '../../src/data/csv.ts';


// Throwaway exploration (QA 2026-10-30): Zoho Prospect Unsubscribed and Conversation Category rows. Not a regression spec.
//   ZOHO_PUCC_EXPLORE=1 KEEP_TEST_DATA=1 npx playwright test tests/setup/zoho-explore-pu-cc.spec.ts -g "P0" --project=chromium --workers=1
process.env.KEEP_OTHER_TRIGGERS = '1';
test.describe('Zoho PU CC explore', () => {
  test.skip(process.env.ZOHO_PUCC_EXPLORE !== '1', 'Set ZOHO_PUCC_EXPLORE=1');
  test.use({ account: 'notemailsentzoho' });
  const SEQ = '197387';
  const SP = '/tmp/claude-1002/-home-dharmesh-Desktop-Dharmesh-Saleshandy-repo-local-project/3e429a81-ee1d-44cf-9471-4c1746acdc02/scratchpad';

  test('P0 probe: trigger states, sequence settings, category list', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    const names = ['Email Sent from Saleshandy', 'Reply is Received in Saleshandy', 'Link is Clicked in Saleshandy', 'Email is Opened in Saleshandy', 'Conversation Category is Updated in Saleshandy', 'Email is Bounced in Saleshandy', 'Prospect is Unsubscribed in Saleshandy'];
    for (const n of names) {
      const on = await z.isTriggerOn(n).catch(() => 'n/a');
      console.log('P0 TRIGGER', n, on, JSON.stringify(await z.selectedActivities(n).catch(() => [])));
    }
    console.log('P0 TRIGGERS TEXT\n' + (await page.locator('body').innerText()).slice(0, 2500));
    await page.screenshot({ path: SP + '/p0-triggers.png', fullPage: true });
    await page.goto('/sequence/' + SEQ + '/settings');
    await page.waitForTimeout(8000);
    console.log('P0 SETTINGS\n' + (await page.locator('body').innerText()).slice(0, 4000));
    await page.screenshot({ path: SP + '/p0-settings.png', fullPage: true });
    expect(true).toBe(true);
  });
  test('P1 probe: safety and unsubscribe settings', async ({ saleshandyPage: page }) => {
    await page.goto('/sequence/' + SEQ + '/settings');
    await page.waitForTimeout(8000);
    for (const nav of ['Safety Settings', 'Unsubscribe']) {
      await page.getByText(nav, { exact: true }).first().click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: SP + '/p1-' + nav.replace(/ /g, '') + '.png' });
    }
    const inputs = await page.locator('input[type="checkbox"], input[type="radio"]').evaluateAll((els) => els.map((e) => { const i = e as HTMLInputElement; const label = (i.closest('label, div')?.parentElement?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 70); return i.type + ' ' + (i.checked ? 'ON' : 'off') + ' | ' + label; }));
    console.log('P1 INPUTS\n' + inputs.join('\n'));
    expect(true).toBe(true);
  });
  test('P2 probe: category list of the Conversation Category actions (nothing saved)', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    const T = 'Conversation Category is Updated in Saleshandy';
    await z.openTriggers();
    await z.enableOnly(T); // unsaved, KEEP_OTHER_TRIGGERS=1
    for (const act of ['Create/Update a Contact in Zoho']) {
      console.log('P2 step: picking', act);
      await z.selectActivity(T, act);
      console.log('P2 step: picked');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 15000 });
      const lists = dialog.locator('.bs-select-box');
      console.log('P2', act, 'boxes', await lists.count(), 'DIALOG TEXT', (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 400));
      await page.screenshot({ path: SP + '/p2-dialog.png' });
      console.log('P2 HTML', (await dialog.innerHTML()).slice(0, 3000));
      await dialog.getByText('Extra Configuration').first().click();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 15000 });
      await page.waitForTimeout(3000);
    }
    expect(true).toBe(true);
  });
  const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-explore-b-profile');
  const OBS = SP + '/obs.log';
  const say = (...a: unknown[]) => { const line = new Date().toISOString() + ' ' + a.join(' '); console.log(line); fs.appendFileSync(OBS, line + '\n'); };
  const PU = 'Prospect is Unsubscribed in Saleshandy';
  const CC = 'Conversation Category is Updated in Saleshandy';

  const mk = (first: string, last: string, tag: string, extra: Record<string, string> = {}): Row => ({
    'First Name': first, 'Last Name': last, Email: first.toLowerCase() + '.' + last.toLowerCase() + '.' + tag + '@mailinator.com', ...extra,
  });

  // Reads Zoho: waits for a record by email (15 s first, then every 10 s), prints its page text.
  async function observe(crm: ZohoCrmPage, label: string, module: 'Contacts' | 'Leads', email: string, timeoutMs = 90_000) {
    const found = await crm.waitForRecord(module, email, timeoutMs);
    if (!found) { say(label, module, 'NOT FOUND for', email); return undefined; }
    const text = await crm.recordText(module, found.id);
    say(label, module, 'FOUND id', found.id, 'notes', ZohoCrmPage.noteCount(text));
    fs.appendFileSync(OBS, '--- ' + label + ' ' + module + ' record text ---\n' + text.slice(0, 6000) + '\n---\n');
    return { id: found.id, text };
  }

  test('SET-LINK Unsubscribe as Link saved on the sequence', async ({ saleshandyPage: page }) => {
    await page.goto('/sequence/' + SEQ + '/settings');
    await page.waitForTimeout(8000);
    await page.getByText('Unsubscribe', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText('Unsubscribe as Link', { exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SP + '/setlink.png' });
    await page.reload();
    await page.waitForTimeout(8000);
    await page.getByText('Unsubscribe', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    const radios = await page.locator('input[type="radio"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).checked));
    say('SET-LINK radios after reload (Text, list, Custom, Link):', JSON.stringify(radios));
  });

  test('RESTORE-TEXT Unsubscribe as Text saved again', async ({ saleshandyPage: page }) => {
    await page.goto('/sequence/' + SEQ + '/settings');
    await page.waitForTimeout(8000);
    await page.getByText('Unsubscribe', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText('Unsubscribe as Text', { exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: SP + '/restoretext-before-save.png' });
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForTimeout(8000);
    await page.getByText('Unsubscribe', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    const radios = await page.locator('input[type="radio"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).checked));
    say('RESTORE-TEXT radios after reload (Text, list, Custom, Link):', JSON.stringify(radios));
    await page.screenshot({ path: SP + '/restoretext-after.png' });
  });

  test('CFG-PU Prospect Unsubscribed ON with Contact action', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await configure(z, page, PU, [{ action: ZOHO_ACTION.contact }]);
    await z.openTriggers();
    say('CFG-PU states', 'PU', await z.isTriggerOn(PU), JSON.stringify(await z.selectedActivities(PU)), 'Reply', await z.isTriggerOn('Reply is Received in Saleshandy'), JSON.stringify(await z.selectedActivities('Reply is Received in Saleshandy')));
  });

  test('PU-LINK rows 4, 5, 6 on one prospect', async ({ saleshandySequence: s, mailinator, saleshandyPage: page }) => {
    test.setTimeout(20 * 60_000);
    const row = mk('Linnea', 'Bergstrom', 'zpu4c', { 'Phone Number': '+1 555-0141-2200', 'Job Title': 'Operations Director', Company: 'Bergstrom Print Works', City: 'Leeds', Country: 'United Kingdom' });
    const { context, crm } = await openZohoProfile(PROFILE);
    try {
      if (process.env.P4_SENT !== '1') await sendStep(s, SEQ, row);
      say('U4 step 1 sent (or already sent)', row['Email']);
      const subject = await mailinator.latestSubject(row['Email']);
      say('U4 mailinator subject', subject);
      const link = await mailinator.openUnsubscribeLink(row['Email'], subject, Number(process.env.LINK_WAIT_MS ?? 0));
      const t0 = new Date().toISOString();
      say('U4 unsubscribe link opened', t0, 'URL', link.url());
      say('U4 PAGE TEXT', (await link.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
      await link.screenshot({ path: SP + '/u4-page.png' });
      await s.expectProspectStatusAfterRefresh(SEQ, row['Email'], 'Unsubscribed', 120_000);
      say('U4 Prospects tab shows Unsubscribed');
      const rec = await observe(crm, 'U4', 'Contacts', row['Email']);
      say('U4 contacts with this email', (await crm.find('Contacts', row['Email'])).length, 'leads', (await crm.find('Leads', row['Email'])).length);
      // Row 5: the same link a second time
      const again = await mailinator.openUnsubscribeLink(row['Email'], subject);
      say('U5 second open at', new Date().toISOString());
      say('U5 PAGE TEXT', (await again.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
      await again.screenshot({ path: SP + '/u5-page.png' });
      await page.waitForTimeout(60_000);
      if (rec) {
        const t5 = await crm.recordText('Contacts', rec.id);
        say('U5 after second open, notes', ZohoCrmPage.noteCount(t5));
        fs.appendFileSync(OBS, '--- U5 contact text ---\n' + t5.slice(0, 6000) + '\n---\n');
      }
      say('U5 contacts with this email', (await crm.find('Contacts', row['Email'])).length);
      // Row 6: Subscribe here
      await again.getByText(/Subscribe here/).first().click();
      say('U6 Subscribe here clicked at', new Date().toISOString());
      await again.waitForTimeout(3000);
      say('U6 PAGE TEXT', (await again.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
      await again.screenshot({ path: SP + '/u6-page.png' });
      say('U6 Prospects row', await s.prospectRowText(SEQ, row['Email']));
      await page.waitForTimeout(60_000);
      if (rec) {
        const t6 = await crm.recordText('Contacts', rec.id);
        say('U6 after Subscribe here, notes', ZohoCrmPage.noteCount(t6));
        fs.appendFileSync(OBS, '--- U6 contact text ---\n' + t6.slice(0, 6000) + '\n---\n');
      }
      say('U6 contacts with this email', (await crm.find('Contacts', row['Email'])).length);
      say('U6 Prospects row again', await s.prospectRowText(SEQ, row['Email']));
    } finally {
      await context.close();
    }
  });
  test('PU-LEAD Lead 1: Lead action only, prospect not in Zoho, UI unsubscribe', async ({ zohoIntegration: z, saleshandyPage: page, saleshandySequence: s }) => {
    test.setTimeout(15 * 60_000);
    await configure(z, page, PU, [{ action: ZOHO_ACTION.lead }]);
    await z.openTriggers();
    say('PU-LEAD states PU', await z.isTriggerOn(PU), JSON.stringify(await z.selectedActivities(PU)));
    const row = mk('Tobias', 'Lindqvist', 'zpul1', { 'Phone Number': '+1 555-0142-3300', 'Job Title': 'Procurement Lead', Company: 'Lindqvist Marine Supply', City: 'Gothenburg', Country: 'Sweden' });
    const { context, crm } = await openZohoProfile(PROFILE);
    try {
      await sendStep(s, SEQ, row);
      say('L1 step 1 sent', row['Email']);
      await s.markAsUnsubscribed(SEQ, row['Email']);
      say('L1 Mark as Unsubscribe done at', new Date().toISOString());
      const lead = await observe(crm, 'L1', 'Leads', row['Email']);
      say('L1 leads with this email', (await crm.find('Leads', row['Email'])).length, 'contacts', (await crm.find('Contacts', row['Email'])).length);
      if (!lead) say('L1 no lead after 90 s; checking contacts');
      const c = await crm.find('Contacts', row['Email']);
      if (c[0]) { const t = await crm.recordText('Contacts', c[0].id); fs.appendFileSync(OBS, '--- L1 contact text ---\n' + t.slice(0, 5000) + '\n---\n'); }
    } finally {
      await context.close();
    }
  });

  test('CFG-CC Conversation Category ON, Contact action, category empty, PU off', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await z.turnOff(PU);
    for (const chip of await z.selectedActivities(PU)) await z.removeActivity(PU, chip);
    await z.enableOnly(CC);
    for (const chip of await z.selectedActivities(CC)) await z.removeActivity(CC, chip);
    await z.selectActivity(CC, ZOHO_ACTION.contact);
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: SP + '/cfgcc-after-dialog-save.png' });
    say('CFG-CC dialog still open after Save with empty box:', await dialog.isVisible().catch(() => false));
    if (await dialog.isVisible().catch(() => false)) say('CFG-CC dialog text', (await dialog.innerText()).replace(/\s+/g, ' '));
    say('CFG-CC chips before page Save', JSON.stringify(await z.selectedActivities(CC)));
    await z.save();
    await z.savedToast().waitFor({ timeout: 20_000 });
    await z.openTriggers();
    say('CFG-CC states CC', await z.isTriggerOn(CC), JSON.stringify(await z.selectedActivities(CC)), 'PU', await z.isTriggerOn(PU), JSON.stringify(await z.selectedActivities(PU)), 'Reply', await z.isTriggerOn('Reply is Received in Saleshandy'), JSON.stringify(await z.selectedActivities('Reply is Received in Saleshandy')));
    await z.reopenExtraConfiguration(CC, ZOHO_ACTION.contact);
    await dialog.waitFor({ timeout: 15_000 });
    say('CFG-CC saved dialog input value:', JSON.stringify(await dialog.locator('input').first().inputValue()));
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('CC-GATE3 outcome Not Now, category empty, prospect not in Zoho', async ({ saleshandyPage: page, saleshandySequence: s }) => {
    test.setTimeout(15 * 60_000);
    const row = mk('Marcus', 'Oyelaran', 'zcc3', { 'Phone Number': '+1 555-0143-4400', 'Job Title': 'Head of Logistics', Company: 'Oyelaran Freight Group', City: 'Lagos', Country: 'Nigeria' });
    const { context, crm } = await openZohoProfile(PROFILE);
    try {
      await sendStep(s, SEQ, row);
      say('C3 step 1 sent', row['Email']);
      say('C3 Prospects row before', await s.prospectRowText(SEQ, row['Email']));
      await s.setProspectOutcome(SEQ, row['Email'], 'Not Now');
      say('C3 outcome set to Not Now at', new Date().toISOString());
      const rec = await observe(crm, 'C3', 'Contacts', row['Email']);
      say('C3 contacts with this email', (await crm.find('Contacts', row['Email'])).length, 'leads', (await crm.find('Leads', row['Email'])).length);
      say('C3 Prospects row after', await s.prospectRowText(SEQ, row['Email']));
      if (!rec) say('C3 nothing in Zoho after 90 s');
    } finally {
      await context.close();
    }
  });

  test('RESTORE-TRIGGERS PU and CC off with no actions, Reply untouched', async ({ zohoIntegration: z }) => {
    await z.openTriggers();
    for (const t of [PU, CC]) {
      await z.turnOff(t);
      for (const chip of await z.selectedActivities(t)) await z.removeActivity(t, chip);
    }
    await z.save();
    await z.savedToast().waitFor({ timeout: 20_000 });
    await z.openTriggers();
    for (const t of ['Email Sent from Saleshandy', 'Reply is Received in Saleshandy', 'Link is Clicked in Saleshandy', 'Email is Opened in Saleshandy', CC, 'Email is Bounced in Saleshandy', PU]) {
      say('RESTORE state', t, await z.isTriggerOn(t), JSON.stringify(await z.selectedActivities(t)));
    }
  });
});
