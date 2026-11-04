import { expect, test } from '../../src/fixtures/index.ts';
import { ZOHO_ACTION, configure } from '../../src/flows/saleshandy-to-zoho.ts';

// Throwaway exploration for Zoho Reply Received, restart of 2026-11-03 (QA). Not a regression spec.
// It reads the trigger state, saves Reply + Contact, reads it back after a reload, sends one email,
// marks it as replied and polls the Logs tab (QA OK to read Logs for this, 2026-11-03).
//   ZOHO_REPLY_FRESH=1 KEEP_TEST_DATA=1 npx playwright test tests/setup/zoho-reply-fresh-explore.spec.ts --project=chromium --workers=1
// ZOHO_REPLY_DELAY_S=180 waits that long between Sent and Mark as Replied.
test.describe('Zoho Reply Received fresh explore', () => {
  test.skip(process.env.ZOHO_REPLY_FRESH !== '1', 'Set ZOHO_REPLY_FRESH=1');
  test.use({ account: 'notemailsentzoho' });
  test.setTimeout(20 * 60_000);

  const SEQ = process.env.ZOHO_REPLY_SEQUENCE_ID ?? '197387';
  const TRIGGER = 'Reply is Received in Saleshandy';
  const TRIGGERS = [
    'Email Sent from Saleshandy',
    TRIGGER,
    'Link is Clicked in Saleshandy',
    'Email is Opened in Saleshandy',
    'Email is Bounced in Saleshandy',
    'Prospect is Unsubscribed in Saleshandy',
  ];

  test('E1 trigger state before, after save and after reload', async ({ zohoIntegration: z, saleshandyPage: page }) => {
    await z.openTriggers();
    for (const t of TRIGGERS) console.log('E1 BEFORE', t, await z.isTriggerOn(t).catch(() => 'not found'));
    console.log('E1 BEFORE reply chips', JSON.stringify(await z.selectedActivities(TRIGGER)));
    await configure(z, page, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await page.reload();
    await z.openTriggers();
    for (const t of TRIGGERS) console.log('E1 AFTER RELOAD', t, await z.isTriggerOn(t).catch(() => 'not found'));
    console.log('E1 AFTER RELOAD reply chips', JSON.stringify(await z.selectedActivities(TRIGGER)));
    expect(await z.isTriggerOn(TRIGGER)).toBe(true);
  });

  test('E2 one reply, then poll the Logs', async ({ zohoIntegration: z, saleshandySequence: s, saleshandyPage: page }) => {
    const stamp = Date.now().toString(36);
    const row = { 'First Name': 'Rowan', 'Last Name': 'Whitfield', Email: `rowan.whitfield.${stamp}@mailinator.com` };
    const name = 'Rowan Whitfield';
    await s.createAndAddProspect(SEQ, row);
    await s.sendNow(SEQ, name, 1, row.Email);
    console.log('E2 SENT', new Date().toISOString(), row.Email);
    const delay = Number(process.env.ZOHO_REPLY_DELAY_S ?? '0');
    if (delay) await page.waitForTimeout(delay * 1000);
    await s.markAsReplied(SEQ, name, 1, row.Email);
    console.log('E2 REPLIED', new Date().toISOString());

    const seen: string[] = [];
    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(30_000);
      await z.openLogs();
      const entries = await z.logEntries(TRIGGER);
      console.log('E2 POLL', i, new Date().toISOString(), 'reply entries on page 1:', entries.length, JSON.stringify(entries.slice(0, 3)));
      if (entries.length) { seen.push(...entries.map((e) => JSON.stringify(e))); break; }
    }
    console.log('E2 RESULT reply entries seen:', seen.length);
    expect(true).toBe(true);
  });
});
