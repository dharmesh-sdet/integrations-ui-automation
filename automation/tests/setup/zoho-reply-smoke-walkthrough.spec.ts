import { test } from '../../src/fixtures/index.ts';

// Read-only, headless walk-through of the production screens the Zoho Reply Received smoke uses (QA OK 2026-11-03).
// Opens pages, reads text, opens the Emails tab three-dot menu and closes it with Escape. No send, no save,
// no Mark as replied, no trigger change, no prospect added.
//   WALKTHROUGH=1 npx playwright test tests/setup/zoho-reply-smoke-walkthrough.spec.ts --project=chromium --workers=1
const ID = process.env.SMOKE_SEQUENCE_ID ?? '989765';
const TRIGGERS = ['Reply is Received in Saleshandy', 'Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];

test.describe('Production walk-through: Zoho Reply Received smoke', () => {
  test.skip(process.env.WALKTHROUGH !== '1', 'Set WALKTHROUGH=1');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test('Sequence, Emails tab, three-dot menu, Prospects toolbar', async ({ saleshandySequence: seq }) => {
    const page = seq.page;
    await seq.openEmails(ID);
    console.log('URL', page.url());
    const headers = await page.locator('[role="columnheader"], .tanstack-table--th, th').allInnerTexts();
    console.log('HEADERS', JSON.stringify(headers.map((h) => h.trim())));
    const rows = page.locator('[role="row"], .tanstack-table--tr, tr').filter({ hasText: 'Step 1' });
    console.log('ROWS with Step 1:', await rows.count());
    console.log('ROLE=row count', await page.getByRole('row').count(), '| tanstack--tr count', await page.locator('.tanstack-table--tr').count());
    console.log('#dropdown-basic count', await page.locator('#dropdown-basic').count());
    const first = rows.first();
    console.log('FIRST ROW TEXT', JSON.stringify((await first.innerText()).replace(/\s+/g, ' ').slice(0, 240)));
    await first.locator('#dropdown-basic').click();
    await page.waitForTimeout(800);
    const items = await page.locator('.dropdown-menu.show, [role="menu"]').first().allInnerTexts().catch(() => []);
    console.log('MENU (Emails tab three dots)', JSON.stringify(items));
    console.log('Mark as replied button count (name ends with "Mark as replied")', await first.getByRole('button', { name: /Mark as replied$/ }).count());
    console.log('ROW BUTTONS', JSON.stringify(await first.getByRole('button').allInnerTexts()));
    console.log('Send now text count', await page.getByText('Send now', { exact: true }).count());
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'test-results-zoho-reply-walkthrough/emails-tab.png', fullPage: false });

    // Prospects tab: toolbar icons only, no row ticked.
    await seq.goto(`/sequence/${ID}/prospects`);
    await page.waitForTimeout(4_000);
    const icons = await page.locator('button[icon]').evaluateAll((els) => els.map((e) => e.getAttribute('icon')));
    console.log('PROSPECTS TOOLBAR icons', JSON.stringify(icons));
    console.log('Mark as Replied icon button count', await page.locator('button[icon="round-corner-arrow-back"]').count());

    // Sequence settings: status and senders.
    await seq.goto(`/sequence/${ID}/settings`);
    await page.waitForTimeout(4_000);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log('SETTINGS TEXT', JSON.stringify(body.slice(700, 1900)));
    await page.screenshot({ path: 'test-results-zoho-reply-walkthrough/settings.png' });
  });

  test('Zoho integration: triggers and mapping cards', async ({ zohoIntegration: zoho, saleshandyPage }) => {
    await zoho.openTriggers();
    for (const t of TRIGGERS) {
      const on = await zoho.isTriggerOn(t).catch((e) => `error: ${String(e).slice(0, 100)}`);
      const acts = await zoho.selectedActivities(t).catch((e) => `error: ${String(e).slice(0, 100)}`);
      console.log(`TRIGGER ${t} on=${on} actions=${JSON.stringify(acts)}`);
    }
    console.log('ZOHO PAGE TEXT', JSON.stringify((await saleshandyPage.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 900)));
    console.log('PAGE URL', saleshandyPage.url());
    const text = (await saleshandyPage.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log('RE-CONNECT shown:', /re-?connect/i.test(text), '| Connected shown:', /connected/i.test(text));
    await saleshandyPage.screenshot({ path: 'test-results-zoho-reply-walkthrough/zoho-triggers.png', fullPage: true });
  });
});
