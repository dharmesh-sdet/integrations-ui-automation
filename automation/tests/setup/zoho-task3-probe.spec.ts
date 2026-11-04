import { expect, test } from '../../src/fixtures/index.ts';
import path from 'node:path';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { sendStep } from '../../src/flows/zoho-email-sent.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';

// Throwaway probe for Zoho Email Sent "Task: 3" (2026-11-02). Sends no email.
//   ZOHO_EXPLORE=1 npx playwright test tests/setup/zoho-task3-probe.spec.ts --project=chromium --workers=1
test.describe('Zoho Task 3 probe', () => {
  test.skip(process.env.ZOHO_EXPLORE !== '1', 'Set ZOHO_EXPLORE=1');
  test.use({ account: 'gzoho' });
  const TRIGGER = 'Email Sent from Saleshandy';
  const TASK = { subject: 'Follow up after step 1', status: 'Not Started', priority: 'Normal', dueIn: '3' };

  const readBack = async (z: any, page: any, label: string) => {
    await page.reload();
    await z.openTriggers();
    console.log(label, 'chips', JSON.stringify(await z.selectedActivities(TRIGGER)));
    const chip = page.locator('div:has(> .action-container)').filter({ hasText: ZOHO_ACTION.task }).first();
    await chip.locator('.action-container > svg').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    console.log(label, 'subject=[' + (await dialog.getByRole('textbox').first().inputValue()) + ']', 'dueIn=' + (await dialog.getByRole('spinbutton').inputValue()));
    console.log(label, 'dialog text:', (await dialog.innerText()).replace(/\s+/g, ' '));
  };

  test('P1 save with subject, then with empty subject through configure', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await readBack(z, page, 'A(with subject)');
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    await readBack(z, page, 'B(empty subject)');
    await page.screenshot({ path: 'test-results-zoho-task3-probe/B.png' });
  });

  test('P2 empty subject typed by hand, watch the dialog on Save', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, ZOHO_ACTION.task);
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    console.log('P2 fresh dialog subject=[' + (await dialog.getByRole('textbox').first().inputValue()) + ']');
    await dialog.getByRole('textbox').first().fill('');
    await dialog.getByRole('spinbutton').fill('3');
    await page.screenshot({ path: 'test-results-zoho-task3-probe/P2-before-save.png' });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(1500);
    console.log('P2 dialog still visible after Save:', await dialog.isVisible());
    if (await dialog.isVisible()) console.log('P2 dialog text:', (await dialog.innerText()).replace(/\s+/g, ' '));
    await page.screenshot({ path: 'test-results-zoho-task3-probe/P2-after-save.png' });
    expect(true).toBe(true);
  });

  test('P3 save request body with empty subject', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    const seen: string[] = [];
    page.on('request', (r) => {
      if (['POST', 'PUT', 'PATCH'].includes(r.method()) && /zoho|integration|trigger/i.test(r.url())) seen.push(r.method() + ' ' + r.url() + ' ' + (r.postData() ?? '').slice(0, 1500));
    });
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    for (const x of seen) console.log('P3 REQ', x);
    const res: string[] = [];
    page.on('response', async (r) => { if (/zoho|integration|trigger/i.test(r.url()) && r.request().method() === 'GET') res.push(r.url()); });
    await page.reload();
    await page.waitForTimeout(3000);
    for (const x of res.slice(0, 8)) console.log('P3 GET', x);
  });

  test('P4 compare save bodies, subject vs empty', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    let tag = '';
    page.on('request', (r) => {
      if (r.method() !== 'GET' && /pyxis\.lifeisgoodforlearner\.com\/api/.test(r.url())) console.log('P4', tag, r.method(), r.url().split('/api/')[1], (r.postData() ?? '').slice(0, 2000));
    });
    tag = '[subject Probe A]';
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: 'Probe A' } }]);
    tag = '[empty subject]';
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    tag = '[subject Follow up after step 1, restore]';
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
  });

  test('P5 does an empty Subject keep the previous saved value', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: 'Probe A' } }]);
    await readBack(z, page, 'P5 after Probe A');
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    await readBack(z, page, 'P5 after empty');
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: 'Probe B', dueIn: '5' } }]);
    await readBack(z, page, 'P5 after Probe B dueIn 5');
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '', dueIn: '3' } }]);
    await readBack(z, page, 'P5 after empty, dueIn 3');
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
  });

  test('P6 Combined 1 by hand, one email', async ({ zohoIntegration: z, saleshandyPage: page, saleshandySequence: seq }) => {
    test.setTimeout(20 * 60_000);
    const row = { 'First Name': 'Sigrid', 'Last Name': 'Lindqvist', Email: 'sigrid.lindqvist.cb4@mailinator.com', Company: 'Polar Cargo ' + String(Date.now()).slice(-6), 'Deal Value': '18000', 'Phone Number': '', 'Job Title': 'Logistics Manager' } as Record<string, string>;
    await configure(z, page, TRIGGER, [
      { action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.lead }, { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' }, { action: ZOHO_ACTION.task, task: TASK },
    ]);
    console.log('P6 chips right after Save (no reload)', JSON.stringify(await z.selectedActivities(TRIGGER)));
    await sendStep(seq, '197383', row as any);
    console.log('P6 SENT', new Date().toISOString(), fullName(row as any), row.Email);
    await page.goto(page.url().includes('api-and-integrations') ? page.url() : 'https://pyxis.lifeisgoodforlearner.com/api-and-integrations/integrations/zoho?tab=triggers-activity');
    await z.openTriggers();
    console.log('P6 chips saved at the backend after the send', JSON.stringify(await z.selectedActivities(TRIGGER)));
    await page.screenshot({ path: 'test-results-zoho-task3-probe/P6-3-after-send.png' });
    const { context, crm } = await openZohoProfile(path.resolve(import.meta.dirname, '../../auth/mcp-zoho-profile'));
    try {
      await new Promise((r) => setTimeout(r, 20_000));
      const look = async (tag: string) => {
        for (const [m, key] of [['Contacts', row.Email], ['Leads', row.Email], ['Accounts', row.Company], ['Deals', fullName(row as any)], ['Tasks', fullName(row as any)]] as const) {
          const hits = await crm.find(m as any, key);
          console.log('P6 ZOHO', tag, m, JSON.stringify(key), 'count', hits.length, JSON.stringify(hits.slice(0, 3)));
        }
      };
      await look('+20s');
      await new Promise((r) => setTimeout(r, 150_000));
      await look('+3min');
    } finally { await context.close(); }
    console.log('P6 DONE, trigger left as saved, not reset');
  });

  test('P7 five actions, which chip is dropped', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    const chips = async (label: string) => console.log('P7', label, JSON.stringify(await z.selectedActivities(TRIGGER)));
    const C = ZOHO_ACTION;
    const run = async (name: string, actions: any[]) => {
      await z.openTriggers();
      await z.enableOnly(TRIGGER);
      for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
      for (const a of actions) {
        await z.selectActivity(TRIGGER, a.action);
        if (a.action === C.deal || a.action === C.task) {
          const d = page.getByRole('dialog'); await d.waitFor();
          await d.getByRole('button', { name: 'Save', exact: true }).click(); await d.waitFor({ state: 'hidden' });
        }
        await chips(name + ' after ' + a.action);
      }
      await z.save(); await z.savedToast().waitFor({ timeout: 20_000 });
      await page.reload(); await z.openTriggers();
      await chips(name + ' AFTER RELOAD');
    };
    await run('order1 contact,lead,account,deal,task', [{ action: C.contact }, { action: C.lead }, { action: C.account }, { action: C.deal }, { action: C.task }]);
    await run('order2 task,contact,lead,account,deal', [{ action: C.task }, { action: C.contact }, { action: C.lead }, { action: C.account }, { action: C.deal }]);
    await run('four: contact,lead,account,task', [{ action: C.contact }, { action: C.lead }, { action: C.account }, { action: C.task }]);
    await configure(z, page, TRIGGER, [{ action: C.contact }]);
    await page.reload(); await z.openTriggers(); await chips('RESTORED');
  });

  test('P8 Due In 0 and empty, red highlight', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    const open = async () => {
      await z.openTriggers(); await z.enableOnly(TRIGGER);
      for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
      await z.selectActivity(TRIGGER, ZOHO_ACTION.task);
      const d = page.getByRole('dialog'); await d.waitFor(); return d;
    };
    // A: Due In 0, Subject set
    let d = await open();
    await d.getByRole('spinbutton').fill('0'); await d.getByRole('textbox').first().fill('Probe Zero');
    await d.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(1200);
    console.log('P8 A dueIn=0 dialog still open:', await d.isVisible());
    if (await d.isVisible()) { console.log('P8 A text:', (await d.innerText()).replace(/\s+/g, ' ')); await page.screenshot({ path: 'test-results-zoho-task3-probe/P8-A.png' }); await d.getByRole('button', { name: 'Cancel' }).click(); }
    else { await z.save(); await z.savedToast().waitFor({ timeout: 20_000 }); await readBack(z, page, 'P8 A readback'); }
    // B: Due In empty, Subject empty
    d = await open();
    await d.getByRole('spinbutton').fill(''); await d.getByRole('textbox').first().fill('');
    await page.screenshot({ path: 'test-results-zoho-task3-probe/P8-B-before.png' });
    await d.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(1200);
    console.log('P8 B both empty dialog still open:', await d.isVisible());
    if (await d.isVisible()) { console.log('P8 B text:', (await d.innerText()).replace(/\s+/g, ' ')); await page.screenshot({ path: 'test-results-zoho-task3-probe/P8-B.png' }); await d.getByRole('button', { name: 'Cancel' }).click(); }
    else { await z.save(); await z.savedToast().waitFor({ timeout: 20_000 }); await readBack(z, page, 'P8 B readback'); }
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await page.reload(); await z.openTriggers();
    console.log('P8 RESTORED', JSON.stringify(await z.selectedActivities(TRIGGER)));
  });

  test('P9 Deal dialog Pipeline and Stage', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers(); await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, ZOHO_ACTION.deal);
    const d = page.getByRole('dialog'); await d.waitFor();
    console.log('P9 dialog text:', (await d.innerText()).replace(/\s+/g, ' '));
    const boxes = d.locator('.bs-select-box');
    for (let i = 0; i < await boxes.count(); i++) console.log('P9 box', i, 'class=', await boxes.nth(i).getAttribute('class'));
    await page.screenshot({ path: 'test-results-zoho-task3-probe/P9-deal-dialog.png' });
    await d.getByRole('button', { name: 'Cancel' }).click();
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await page.reload(); await z.openTriggers();
    console.log('P9 RESTORED', JSON.stringify(await z.selectedActivities(TRIGGER)));
  });

  test('P10 five actions saved the way QA does it, waiting for each success message', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    const C = ZOHO_ACTION;
    const chips = async (label: string) => console.log('P10', label, JSON.stringify(await z.selectedActivities(TRIGGER)));
    const toastSeen = async (label: string) => {
      const t0 = Date.now();
      const ok = await z.savedToast().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
      console.log('P10 toast after', label, ok ? 'SEEN after ' + (Date.now() - t0) + ' ms' : 'NOT SEEN in 10 s');
      await page.waitForTimeout(2500);
    };
    await z.openTriggers(); await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    for (const name of [C.contact, C.lead, C.account]) await z.selectActivity(TRIGGER, name);
    await z.selectActivity(TRIGGER, C.deal);
    let d = page.getByRole('dialog'); await d.waitFor();
    await d.getByRole('button', { name: 'Save', exact: true }).click(); await d.waitFor({ state: 'hidden' });
    await toastSeen('Deal dialog Save');
    await z.selectActivity(TRIGGER, C.task);
    d = page.getByRole('dialog'); await d.waitFor();
    await d.getByRole('spinbutton').fill('3'); await d.getByRole('textbox').first().fill('Follow up after step 1');
    await d.getByRole('button', { name: 'Save', exact: true }).click(); await d.waitFor({ state: 'hidden' });
    await toastSeen('Task dialog Save');
    await chips('before page Save');
    await z.save(); await toastSeen('page Save');
    await page.reload(); await z.openTriggers();
    await chips('AFTER RELOAD (QA method)');
  });

  test('P11 read the two tasks of the prospect', async () => {
    const { context, crm } = await openZohoProfile(path.resolve(import.meta.dirname, '../../auth/mcp-zoho-profile'));
    try {
      for (const [m, key] of [['Tasks', 'Ingvild Haugen'], ['Deals', 'Ingvild Haugen'], ['Contacts', 'ingvild.haugen@mailinator.com'], ['Leads', 'ingvild.haugen@mailinator.com']] as const) {
        const hits = await crm.find(m as any, key);
        console.log('P11', m, 'count', hits.length);
        for (const h of hits) {
          const text = await crm.recordText(m as any, h.id);
          console.log('P11  ', m, h.id, JSON.stringify(h.row), '| text:', text.replace(/\s+/g, ' ').slice(0, 700));
        }
      }
    } finally { await context.close(); }
  });

  test('P12 the two accounts of the company', async () => {
    const { context, crm } = await openZohoProfile(path.resolve(import.meta.dirname, '../../auth/mcp-zoho-profile'));
    try {
      for (const key of ['Okta 746135', 'Okta 032972']) {
        const hits = await crm.find('Accounts' as any, key);
        console.log('P12 Accounts', JSON.stringify(key), 'count', hits.length);
        for (const h of hits) {
          const text = await crm.recordText('Accounts' as any, h.id);
          console.log('P12  ', h.id, JSON.stringify(h.row), '| text:', text.replace(/\s+/g, ' ').slice(0, 900));
        }
      }
    } finally { await context.close(); }
  });

  test('P13 Logs tab', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await page.getByText('Logs', { exact: true }).first().click();
    await page.waitForTimeout(6000);
    console.log('P13 url', page.url());
    const body = (await page.locator('main, body').first().innerText()).replace(/\n+/g, ' | ');
    console.log('P13 text:', body.slice(0, 3500));
    await page.screenshot({ path: 'test-results-zoho-task3-probe/P13-logs.png' });
  });

  test('P14 open execution details', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await page.getByText('Logs', { exact: true }).first().click();
    await page.waitForTimeout(5000);
    for (const id of ['6ae859413e9e05c58a9deeaf', '6ae8593f00b3b94795f3c87a', '6ae85ff30990ec6c40c0e7fb', '6ae8509c0990ec6c40b1fee9']) {
      await page.getByText(id, { exact: true }).first().click();
      await page.waitForTimeout(4000);
      const dlg = page.getByRole('dialog');
      const hasDlg = await dlg.count();
      const txt = (hasDlg ? await dlg.first().innerText() : await page.locator('body').innerText()).replace(/\n+/g, ' | ');
      console.log('P14', id, 'url', page.url(), 'dialog', hasDlg, 'text:', txt.slice(hasDlg ? 0 : 900, hasDlg ? 3000 : 4200));
      await page.screenshot({ path: 'test-results-zoho-task3-probe/P14-' + id + '.png' });
      if (hasDlg) await page.keyboard.press('Escape'); else await page.goBack();
      await page.waitForTimeout(3000);
      if (!(await page.getByText(id, { exact: true }).count())) { await page.getByText('Logs', { exact: true }).first().click(); await page.waitForTimeout(4000); }
    }
  });

  test('P15 Start step payload of the 3:04 PM executions', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await page.getByText('Logs', { exact: true }).first().click();
    await page.waitForTimeout(5000);
    for (const id of ['6ae8593f00b3b94795f3c87a', '6ae859413e9e05c58a9deeaf', '6ae85ff30990ec6c40c0e7fb']) {
      await page.getByText(id, { exact: true }).first().click();
      const dlg = page.getByRole('dialog').first(); await dlg.waitFor(); await page.waitForTimeout(2000);
      const start = dlg.locator('div, tr, li').filter({ hasText: /^.*Start.*start.*View Details.*$/ }).last();
      await start.getByText('View Details').last().click().catch((e) => console.log('P15 click fail', String(e).slice(0, 120)));
      await page.waitForTimeout(3000);
      const all = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
      const m = all.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? [];
      console.log('P15', id, 'emails seen:', JSON.stringify([...new Set(m)].slice(0, 8)));
      const idx = all.search(/Request|Input|Payload|Output|email/i);
      console.log('P15', id, 'detail text:', all.slice(Math.max(0, idx - 100), Math.max(0, idx) + 1800));
      await page.screenshot({ path: 'test-results-zoho-task3-probe/P15-' + id + '.png' });
      await page.keyboard.press('Escape'); await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
      if (!(await page.getByText(id, { exact: true }).count())) { await page.getByText('Logs', { exact: true }).first().click(); await page.waitForTimeout(4000); }
    }
  });

  test('P16 Start request of the executions', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await page.getByText('Logs', { exact: true }).first().click();
    await page.waitForTimeout(5000);
    for (const id of ['6ae8593f00b3b94795f3c87a', '6ae859413e9e05c58a9deeaf', '6ae85ff30990ec6c40c0e7fb']) {
      await page.getByText(id, { exact: true }).first().click();
      const dlg = page.getByRole('dialog').first(); await dlg.waitFor(); await page.waitForTimeout(2000);
      const startRow = dlg.locator('div').filter({ hasText: /^\s*fec4dec4.*Start/s }).last();
      await dlg.getByRole('button', { name: /View Details/ }).last().click();
      await page.waitForTimeout(2500);
      const txt = (await dlg.innerText()).replace(/\n+/g, ' | ');
      const i = txt.lastIndexOf('Start');
      console.log('P16', id, 'Start part:', txt.slice(i, i + 2600));
      await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
      if (!(await page.getByText(id, { exact: true }).count())) { await page.getByText('Logs', { exact: true }).first().click(); await page.waitForTimeout(4000); }
    }
  });

  test('P17 contact step request of the executions', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    await page.getByText('Logs', { exact: true }).first().click();
    await page.waitForTimeout(5000);
    for (const id of ['6ae8593f00b3b94795f3c87a', '6ae859413e9e05c58a9deeaf', '6ae85ff30990ec6c40c0e7fb']) {
      await page.getByText(id, { exact: true }).first().click();
      const dlg = page.getByRole('dialog').first(); await dlg.waitFor(); await page.waitForTimeout(2000);
      const row = dlg.getByText('create/update contact', { exact: true }).first();
      await row.scrollIntoViewIfNeeded();
      await row.locator('xpath=ancestor::div[.//button[contains(., "View Details")]][1]').getByRole('button', { name: /View Details/ }).first().click();
      await page.waitForTimeout(2500);
      const txt = (await dlg.innerText()).replace(/\n+/g, ' | ');
      const i = txt.indexOf('create/update contact');
      console.log('P17', id, 'contact step:', txt.slice(i, i + 1500));
      await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
      if (!(await page.getByText(id, { exact: true }).count())) { await page.getByText('Logs', { exact: true }).first().click(); await page.waitForTimeout(4000); }
    }
  });
});
