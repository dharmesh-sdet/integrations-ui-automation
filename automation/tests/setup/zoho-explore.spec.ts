import { expect, test } from '../../src/fixtures/index.ts';

// Throwaway exploration of the unconfirmed Zoho Email Sent rows (QA, 2026-10-29). Not a regression
// spec. Sends real emails from gzoho. The Zoho side is read by hand afterwards.
//   ZOHO_EXPLORE=1 npx playwright test tests/setup/zoho-explore.spec.ts -g "E1" --project=chromium --workers=1
test.describe('Zoho explore', () => {
  test.skip(process.env.ZOHO_EXPLORE !== '1', 'Set ZOHO_EXPLORE=1');
  test.use({ account: 'gzoho' });
  const TRIGGER = 'Email Sent from Saleshandy';
  const SEQ = '197383';

  const prospect = (first: string, last: string, email: string, extra: Record<string, string> = {}) => ({
    'First Name': first, 'Last Name': last, Email: email, ...extra,
  });

  test('E1 Account action, prospect has no company', async ({ zohoIntegration: z, saleshandySequence: s }) => {
    const row = prospect('Priya', 'Nair', 'priya.nair.zx1@mailinator.com');
    await z.setActivities(TRIGGER, ['Create/Update Account in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await s.createAndAddProspect(SEQ, row);
    await s.sendNow(SEQ, 'Priya Nair', 1, row.Email);
    console.log('E1 SENT', new Date().toISOString());
  });

  test('E2 Task action, step 1 then step 2', async ({ zohoIntegration: z, saleshandySequence: s, saleshandyPage: page }) => {
    const [F, L, E, C] = [process.env.P_FIRST ?? 'Marcus', process.env.P_LAST ?? 'Webb', process.env.P_EMAIL ?? 'marcus.webb.zt1@mailinator.com', process.env.P_COMPANY ?? 'Brightline Logistics'];
    const row = prospect(F, L, E, { Company: C });
    await z.openTriggers();
    await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, 'Create a Task in Zoho');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('spinbutton').fill('3');
    await dialog.getByRole('textbox').first().fill('Follow up after step 1');
    for (const [i, option] of [[0, 'Not Started'], [1, 'Normal']] as const) {
      await dialog.locator('.bs-select-box').nth(i).click();
      await page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await z.save();
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await s.createAndAddProspect(SEQ, row);
    await s.sendNow(SEQ, `${F} ${L}`, 1, row.Email);
    console.log('E2 STEP1 SENT', new Date().toISOString());
    if (process.env.STEP2 === '1') {
      await s.moveToStep(SEQ, row.Email, 2);
      await s.sendNow(SEQ, 'Marcus Webb', 2, row.Email);
      console.log('E2 STEP2 SENT', new Date().toISOString());
    }
  });

  test('E3 Contact action, Zoho contact has the email in different case', async ({ zohoIntegration: z, saleshandySequence: s }) => {
    const row = prospect('Elena', 'Rossi', 'elena.rossi.zc@mailinator.com', { Company: 'Rossi Design Studio' });
    await z.setActivities(TRIGGER, ['Create/Update a Contact in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await s.createAndAddProspect(SEQ, row);
    await s.sendNow(SEQ, 'Elena Rossi', 1, row.Email);
    console.log('E3 SENT', new Date().toISOString());
  });

  test('E4 Deal action, closing date 7', async ({ zohoIntegration: z, saleshandySequence: s, saleshandyPage: page }) => {
    const [F, L, E, C] = [process.env.P_FIRST ?? 'Tomas', process.env.P_LAST ?? 'Berg', process.env.P_EMAIL ?? 'tomas.berg.zd1@mailinator.com', process.env.P_COMPANY ?? 'Northwind Traders'];
    const row = prospect(F, L, E, { Company: C, 'Deal Value': '12000' });
    await z.openTriggers();
    await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, 'Create/Update a Deal in Zoho');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('spinbutton').fill('7');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await z.save();
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await s.createAndAddProspect(SEQ, row);
    await s.sendNow(SEQ, `${F} ${L}`, 1, row.Email);
    console.log('E4 SENT', new Date().toISOString());
  });

  test('E2B Task action, step 2 only (step 1 already sent)', async ({ saleshandySequence: s }) => {
    await s.moveToStep(SEQ, 'marcus.webb.zt1@mailinator.com', 2);
    await s.sendNow(SEQ, 'Marcus Webb', 2, 'marcus.webb.zt1@mailinator.com');
    console.log('E2 STEP2 SENT', new Date().toISOString());
  });

  test('E2C Task action on, Marcus Webb moved to step 3', async ({ zohoIntegration: z, saleshandySequence: s, saleshandyPage: page }) => {
    await z.openTriggers();
    await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, 'Create a Task in Zoho');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('spinbutton').fill('3');
    await dialog.getByRole('textbox').first().fill('Follow up after step 3');
    for (const [i, option] of [[0, 'Not Started'], [1, 'Normal']] as const) {
      await dialog.locator('.bs-select-box').nth(i).click();
      await page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await z.save();
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await s.moveToStep(SEQ, 'marcus.webb.zt1@mailinator.com', 3);
    await s.sendNow(SEQ, 'Marcus Webb', 3, 'marcus.webb.zt1@mailinator.com');
    console.log('E2C STEP3 SENT', new Date().toISOString());
  });

  test('RESTORE Contact action only', async ({ zohoIntegration: z }) => {
    await z.setActivities(TRIGGER, ['Create/Update a Contact in Zoho']);
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    expect(await z.selectedActivities(TRIGGER)).toEqual(['Create/Update a Contact in Zoho']);
  });

  test('E2D Task action, Marcus Webb to step 3 (careful move)', async ({ zohoIntegration: z, saleshandySequence: s, saleshandyPage: page }) => {
    await z.openTriggers();
    await z.enableOnly(TRIGGER);
    for (const chip of await z.selectedActivities(TRIGGER)) await z.removeActivity(TRIGGER, chip);
    await z.selectActivity(TRIGGER, 'Create a Task in Zoho');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('spinbutton').fill('3');
    await dialog.getByRole('textbox').first().fill('Follow up after step 3');
    for (const [i, option] of [[0, 'Not Started'], [1, 'Normal']] as const) {
      await dialog.locator('.bs-select-box').nth(i).click();
      await page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await z.save();
    await expect(z.savedToast()).toBeVisible({ timeout: 15_000 });
    await s.goto(`/sequence/${SEQ}/prospects`);
    await page.getByRole('row').filter({ hasText: 'marcus.webb.zt' }).first().waitFor({ timeout: 30_000 });
    await page.getByRole('row').filter({ hasText: 'marcus.webb.zt' }).first().getByRole('checkbox').check();
    await page.locator('button[icon="send"]').click();
    const move = page.getByRole('dialog').filter({ hasText: 'Add To Sequence' });
    await move.waitFor();
    await page.waitForTimeout(2000);
    await move.locator('.bs-select-box, [class*="select"]').first().click();
    await page.waitForTimeout(1500);
    await page.getByText('(Current Sequence)').click();
    await page.waitForTimeout(2500);
    await move.getByText('Select Step of Sequence', { exact: true }).click();
    await page.getByText(/^Step 3 - Day/).first().click();
    await move.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Successfully Moved')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await s.sendNow(SEQ, 'Marcus Webb', 3, 'marcus.webb.zt1@mailinator.com');
    console.log('E2D STEP3 SENT', new Date().toISOString());
  });
});
