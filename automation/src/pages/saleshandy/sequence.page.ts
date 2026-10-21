import { expect, type Locator } from '@playwright/test';
import type { Row } from '../../data/csv.ts';
import { claimSend } from '../../data/send-cap.ts';
import { SaleshandyPage } from './saleshandy.page.ts';

// Create & Add Prospect form: CSV column to input (no accessible names; ids
// seen 2026-10-09). Email and phone are textboxes with names, handled below.
const FORM_IDS: Record<string, string> = {
  'First Name': '#firstname',
  'Last Name': '#lastname',
  'Job Title': '#jobtitle',
  Department: '#department',
  Industry: '#industry',
  Experience: '#experience',
  LinkedIn: '#linkedin',
  Twitter: '#twitter',
  Facebook: '#facebook',
  Website: '#website',
  City: '#city',
  State: '#state',
  Country: '#country',
  Company: '#company',
  'Company Website': '#companywebsite',
  'Company Industry': '#companyindustry',
  'Company Founded Year': '[id="companyfounded year"]',
  'Company LinkedIn': '#companylinkedin',
  'Deal Value': '#dealvalue',
};

// A sequence's Prospects and Emails tabs.
export class SaleshandySequencePage extends SaleshandyPage {
  // Creates the prospect from a CSV row and adds it to step 1, one at a time
  // (Search & Add > Create New Prospect; never an import).
  async createAndAddProspect(sequenceId: string, row: Row): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/prospects`);
    await this.closeSidebar();
    // Empty sequence: "Search & Add" is on the page. Otherwise it is an item of
    // the "Add Prospects" menu (both seen 2026-10-09).
    const searchAndAdd = this.page.getByRole('button', { name: 'Search & Add' });
    const addProspects = this.page.getByRole('button', { name: 'Add Prospects', exact: true });
    // The tab renders blank, then a skeleton, before its buttons (can take > 5 s).
    // On production it once stayed blank (2026-10-14), so reload once if no
    // button shows in 15 s (QA OK 2026-10-14).
    const addButtons = searchAndAdd.filter({ visible: true }).or(addProspects).first();
    const shown = await addButtons.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
    if (!shown) {
      await this.page.reload();
      await this.closeSidebar();
    }
    await expect(addButtons).toBeVisible({ timeout: 30_000 });
    if (!(await searchAndAdd.filter({ visible: true }).count())) await addProspects.click();
    // On a new sequence both the page button and a menu item match (strict mode
    // violation on production, 2026-10-15): prefer the Prospects tab's button.
    const panelButton = this.page.getByRole('tabpanel', { name: 'Prospects' }).getByRole('button', { name: 'Search & Add' }).filter({ visible: true });
    if (await panelButton.count()) await panelButton.first().click();
    else await searchAndAdd.filter({ visible: true }).first().click();
    await this.page.getByRole('button', { name: 'Create New Prospect', exact: true }).click();

    const form = this.page.getByRole('dialog').filter({ hasText: 'Create & Add Prospect' });
    await form.getByRole('textbox', { name: 'Enter Email', exact: true }).fill(row['Email']);
    if (row['Phone Number']) {
      await form.getByRole('button', { name: '+ Add Phone Number', exact: true }).click();
      await form.getByRole('textbox', { name: 'Enter Phone Number', exact: true }).fill(row['Phone Number']);
    }
    for (const [column, selector] of Object.entries(FORM_IDS)) {
      if (row[column]) await form.locator(selector).fill(row[column]);
    }
    // "Import into" defaults to "Step 1", but it showed blank once (2026-10-20,
    // trace screenshot) and Saleshandy answered "Validation Error! stepId must be
    // an integer number". Pick Step 1 if the default is not there after 5 s.
    const stepBox = form.locator('.map-fields-step .bs-select-box');
    const stepFilled = await expect(stepBox.locator('.bs-select-box-text')).toHaveText(/\S/, { timeout: 5_000 }).then(() => true, () => false);
    if (!stepFilled) {
      await stepBox.click();
      await this.page.getByRole('button', { name: 'Step 1', exact: true }).click();
      await expect(stepBox.locator('.bs-select-box-text')).toHaveText('Step 1');
    }
    await form.getByRole('button', { name: 'Create & Add to sequence', exact: true }).click();
    // The form stays open behind a status dialog; "Done" closes both. The
    // "Successfully Moved" toast (checked until 2026-10-19) has the same race
    // as markAsReplied's and sendNow's toasts: it can be gone before the
    // assertion polls it. "Done" appearing is the real signal the create
    // finished, so wait for that instead. Creating the prospect can take
    // longer than the default 5 s.
    const doneButton = this.page.getByRole('button', { name: 'Done', exact: true });
    await expect(doneButton).toBeVisible({ timeout: 30_000 });
    await doneButton.click();
  }

  // The prospect's row for one step on the Emails tab (a real table).
  private emailRow(fullName: string, step: number): Locator {
    return this.page.getByRole('row').filter({ hasText: fullName }).filter({ hasText: `Step ${step}` });
  }

  async openEmails(sequenceId: string): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/emails`);
    await this.page.getByRole('columnheader', { name: 'Clicked' }).waitFor();
  }

  async ensureSent(sequenceId: string, fullName: string, step = 1): Promise<void> {
    await this.sendNow(sequenceId, fullName, step);
  }

  // Send now from the step's row. Skipped if the row already says "Sent".
  async sendNow(sequenceId: string, fullName: string, step = 1): Promise<void> {
    // A new prospect's row appears on the Emails tab some seconds after it is
    // added (seen 2026-10-20: the row was there minutes later, but a single 20 s
    // look failed). The list does not refresh itself, so reopen it on each try.
    await expect(async () => {
      await this.openEmails(sequenceId);
      await expect(this.emailRow(fullName, step)).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 120_000, intervals: [5_000] });
    const row = this.emailRow(fullName, step);
    if ((await (await this.cell(row, 'Scheduled/Sent')).innerText()).trim().startsWith('Sent')) return;
    claimSend();
    // The row's three-dot menu has no accessible name.
    await row.locator('#dropdown-basic').click();
    await this.page.getByText('Send now', { exact: true }).click();
    // Wait for the send request to finish before reloading: a reload right after
    // "Yes" cancels the request and the email stays Scheduled (trace, 2026-10-20:
    // POST .../emails/send aborted by the next page load).
    const sent = this.page.waitForResponse((r) => r.url().includes(`/sequences/${sequenceId}/emails/send`) && r.request().method() === 'POST', { timeout: 30_000 });
    await this.page.getByRole('dialog').filter({ hasText: 'Send the email now' }).getByRole('button', { name: 'Yes', exact: true }).click();
    await sent;
    // The "Email sent successfully" / "Email has already been sent" toast
    // (seen 2026-10-09) has the same race as markAsReplied's toast (found
    // 2026-10-19): it can be gone before the assertion polls it, even though
    // the send itself succeeded. Verify the real outcome, the row's own
    // Scheduled/Sent cell, instead. The Emails list does not update by itself
    // (production, 2026-10-19: the send returned 201 and the toast showed, the
    // row stayed "Scheduled" until the list was refreshed), so reopen it on
    // each try.
    await expect(async () => {
      await this.openEmails(sequenceId);
      const fresh = this.emailRow(fullName, step);
      await expect(fresh).toBeVisible({ timeout: 10_000 });
      expect((await (await this.cell(fresh, 'Scheduled/Sent')).innerText()).trim()).toMatch(/^Sent/);
    }).toPass({ timeout: 60_000, intervals: [3_000] });
  }

  // The prospect's Clicked number for a step ("-" or empty reads as 0).
  // Emails tab > row > three dots > "Mark as replied" (no confirm dialog; seen
  // 2026-10-09). Clicking it again on the same email fires the trigger again,
  // so this is a no-op if the row already shows Replied.
  //
  // The "Email has been marked as replied" toast (asserted here until
  // 2026-10-19) is unreliable: checked manually outside the test framework
  // (2026-10-19) and the action itself succeeds every time (confirmed by the
  // Replied cell flipping and the total Replied count going up), but the toast
  // can be gone before even a 15 s polling assertion catches it. The Replied
  // cell is the real signal, so assert on that instead.
  //
  // Up to 3 tries (2026-10-20): the status request itself can fail on staging
  // (trace: PATCH /api/edge/sequences/<id>/emails/status, net::ERR_CONNECTION_CLOSED
  // after 182 ms), so the cell never flips although the click was right. Each
  // retry reopens the list first, and the top of the loop returns if the row
  // already shows Replied, so a slow success is never clicked twice.
  async markAsReplied(sequenceId: string, fullName: string, step = 1): Promise<void> {
    await this.openEmails(sequenceId);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const row = this.emailRow(fullName, step);
      await expect(row).toBeVisible({ timeout: 20_000 });
      const repliedCell = await this.cell(row, 'Replied');
      if (!(await repliedCell.innerText()).includes('-')) return; // already replied
      await row.locator('#dropdown-basic').click();
      await row.getByRole('button', { name: /Mark as replied$/ }).click();
      try {
        await expect(async () => {
          expect((await repliedCell.innerText()).trim()).not.toBe('-');
        }).toPass({ timeout: 15_000 });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        await this.openEmails(sequenceId);
      }
    }
  }

  // Emails tab > row > three dots > "Mark as bounced" (no confirm dialog; seen
  // 2026-10-12). The row then reads "Hard Bounced" and Latest Status Bounced.
  // It works on a sent row and on an Active or paused sequence (QA).
  async markAsBounced(sequenceId: string, fullName: string, step = 1): Promise<void> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator('#dropdown-basic').click();
    await row.getByRole('button', { name: /Mark as bounced$/ }).click();
    await expect(this.page.getByRole('alert').filter({ hasText: 'Email has been marked as bounced' })).toBeVisible({ timeout: 15_000 });
  }

  // A real bounce: the row's Scheduled/Sent cell turns to a Bounced status by
  // itself after the send (seen as "Hard Bounced" for a manual one, 2026-10-12).
  async waitUntilBounced(sequenceId: string, fullName: string, step = 1, timeout = 5 * 60_000): Promise<void> {
    await expect(async () => {
      await this.openEmails(sequenceId);
      const row = this.emailRow(fullName, step);
      await expect(row).toBeVisible({ timeout: 20_000 });
      expect((await (await this.cell(row, 'Scheduled/Sent')).innerText()).trim()).toMatch(/Bounced/);
    }, `Email to ${fullName} did not show Bounced within ${timeout / 60_000} minutes`).toPass({ timeout, intervals: [15_000] });
  }

  // The sequence's status switch next to its name (seen 2026-10-12): a confirm
  // dialog "Pause Sequence" or "Activate Sequence" with Yes, then a toast.
  async pauseSequence(sequenceId: string): Promise<void> {
    await this.setSequenceActive(sequenceId, false);
  }

  async resumeSequence(sequenceId: string): Promise<void> {
    await this.setSequenceActive(sequenceId, true);
  }

  private async setSequenceActive(sequenceId: string, active: boolean): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/steps`);
    // The header renders before the sequence's status is known; wait for the
    // Steps tab content first, or the click is lost (seen 2026-10-12).
    await this.page.getByRole('button', { name: 'Add Step' }).first().waitFor();
    const toggle = this.page.locator('.switchToggle').first();
    await toggle.waitFor();
    if ((await toggle.locator('input[name="Switch"]').isChecked()) === active) return;
    await toggle.click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: active ? 'Activate Sequence' : 'Pause Sequence' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(this.page.getByRole('alert').filter({ hasText: active ? 'Sequence resumed successfully' : 'Sequence paused successfully' })).toBeVisible({ timeout: 15_000 });
  }

  async clickedCount(sequenceId: string, fullName: string, step = 1): Promise<number> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible({ timeout: 20_000 });
    return Number((await (await this.cell(row, 'Clicked')).innerText()).trim()) || 0;
  }

  // Moves a prospect that is still in step 1 to a later step (QA, 2026-10-13:
  // with the step 2 on Day 3 there is no step 2 row on the Emails tab until
  // then). Prospects tab > tick the row > "Add to Sequence" icon (the send
  // icon, no accessible name) > Sequence: the current one > Sequence Steps:
  // "Step N - Day D" > Add > report "Successfully Moved 1" > Done. The
  // prospect's step 1 row is replaced by a "Step N, Scheduled" row, which
  // Send now can then send.
  async moveToStep(sequenceId: string, email: string, step: number): Promise<void> {
    await this.openProspects(sequenceId);
    await this.searchProspect(email);
    // The row shows the email cut after about 20 characters; its first 14 are always there.
    const row = this.page.getByRole('row').filter({ hasText: email.slice(0, 14) });
    await expect(row.first(), `prospect ${email} on the Prospects tab`).toBeVisible({ timeout: 30_000 });
    await row.first().getByRole('checkbox').check();
    await this.page.locator('button[icon="send"]').click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add To Sequence' });
    await dialog.getByText('Select Sequence', { exact: true }).click();
    await this.page.getByText('(Current Sequence)').click();
    // The step list loads after the sequence is picked: a click before that
    // opens nothing (seen 2026-10-13), so click again until the option shows.
    const option = this.page.getByText(new RegExp(`^Step ${step} - Day`)).first();
    await expect(async () => {
      if (!(await option.isVisible())) await dialog.getByText('Select Step of Sequence', { exact: true }).click();
      await expect(option).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000] });
    await option.click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(this.page.getByText('Successfully Moved')).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText('Failed to move').locator('xpath=following-sibling::*[1]')).toHaveText(/0/);
    await this.page.getByRole('button', { name: 'Done', exact: true }).click();
  }

  // The prospect's Opened number for a step ("-" or empty reads as 0).
  async openedCount(sequenceId: string, fullName: string, step = 1): Promise<number> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible({ timeout: 20_000 });
    return Number((await (await this.cell(row, 'Opened')).innerText()).trim()) || 0;
  }

  // ---- Prospects tab: unsubscribe and resume (seen 2026-10-15) ----

  // The row shows the email cut to about 14 characters, so it is found by that start.
  private prospectRow(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email.slice(0, 14) });
  }

  async openProspects(sequenceId: string): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/prospects`);
    await this.closeSidebar();
  }

  // Searches for a prospect by email on the Prospects tab so that it is
  // visible even when the list is paged (71+ prospects, seen 2026-10-16).
  private async searchProspect(email: string): Promise<void> {
    await this.page.getByRole('columnheader', { name: 'Name' }).waitFor({ timeout: 30_000 });
    await this.page.locator('.sequence-prospect-search-bar-and-filter input').fill(email);
    await this.page.keyboard.press('Enter');
  }

  // True when the sequence already lists a prospect with this email (Prospects tab, searched).
  // The first list row is the match once the search has applied; an empty result shows no row
  // with the email, so a short wait for the match is the answer either way.
  async hasProspect(sequenceId: string, email: string): Promise<boolean> {
    await this.openProspects(sequenceId);
    await this.searchProspect(email);
    return this.prospectRow(email).first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
  }

  // Prospects tab > the prospect's Outcome select (".prospect-custom-outcome-select" in
  // the row, shows "Add Outcome" until one is set; its options are <li> items:
  // Uncategorized, Interested, Not Interested, Meeting Booked, ...; seen 2026-10-20).
  async setProspectOutcome(sequenceId: string, email: string, outcome: string): Promise<void> {
    await this.openProspects(sequenceId);
    await this.searchProspect(email);
    const row = this.prospectRow(email);
    await expect(row).toBeVisible({ timeout: 30_000 });
    // The row shows in the unfiltered list before the search applies, so wait for one row first.
    await expect(this.page.locator('.prospect-custom-outcome-select')).toHaveCount(1, { timeout: 30_000 });
    await row.locator('.prospect-custom-outcome-select').click();
    await this.page.locator('li').filter({ hasText: new RegExp(`^\\s*${outcome}\\s*$`) }).click();
    // After the pick the list reloads unfiltered and the row can keep showing "Add Outcome" although
    // the outcome saved (2026-10-21 run: the header counter read 1 Interested). Reopen and read the row.
    await expect(async () => {
      await this.openProspects(sequenceId);
      await this.searchProspect(email);
      await expect(this.page.locator('.prospect-custom-outcome-select')).toHaveCount(1, { timeout: 10_000 });
      await expect(this.prospectRow(email)).toContainText(outcome, { timeout: 5_000 });
    }).toPass({ timeout: 60_000, intervals: [3_000] });
  }

  // Ticks the prospect, then clicks a toolbar icon. The toolbar buttons are
  // icon-only (tooltips "Mark as Unsubscribe", "Mark as Resume") with no
  // accessible name; their `icon` attribute is the only stable hook.
  private async toolbarAction(sequenceId: string, email: string, icon: string): Promise<void> {
    await this.openProspects(sequenceId);
    await this.searchProspect(email);
    const row = this.prospectRow(email);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('checkbox').click();
    await this.page.locator(`button[icon="${icon}"]`).click();
  }

  // Prospects tab > tick the prospect > "Mark as Unsubscribe". No confirm
  // dialog; the row then reads "Unsubscribed".
  async markAsUnsubscribed(sequenceId: string, email: string): Promise<void> {
    await this.toolbarAction(sequenceId, email, 'unavailable');
    await expect(this.prospectRow(email)).toContainText('Unsubscribed', { timeout: 15_000 });
  }

  // "Mark as Resume" > dialog "Resume Prospects" > "Apply changes". An
  // Unsubscribed prospect stays Unsubscribed (QA, 2026-10-15: expected).
  async markAsResumed(sequenceId: string, email: string): Promise<void> {
    await this.toolbarAction(sequenceId, email, 'right-arrow');
    await this.page.getByRole('button', { name: 'Apply changes' }).click();
    await expect(this.page.getByText('Prospect(s) status updated successfully').first()).toBeVisible({ timeout: 15_000 });
  }

  // Reloads the Prospects tab until the prospect's row shows `status`.
  async expectProspectStatus(sequenceId: string, email: string, status: string, timeout = 3 * 60_000): Promise<void> {
    await expect(async () => {
      await this.openProspects(sequenceId);
      await this.searchProspect(email);
      await expect(this.prospectRow(email)).toContainText(status, { timeout: 10_000 });
    }, `${email} did not show ${status} on the Prospects tab`).toPass({ timeout, intervals: [10_000] });
  }

  // Opens the Prospects tab, hard refreshes it once, and expects the prospect's
  // row to show `status` (QA, 2026-10-19: after the unsubscribe link, come back
  // to the Prospects tab and refresh; the status is there).
  async expectProspectStatusAfterRefresh(sequenceId: string, email: string, status: string, timeout = 30_000): Promise<void> {
    await this.openProspects(sequenceId);
    await this.page.reload({ waitUntil: 'load' });
    await this.closeSidebar();
    await this.searchProspect(email);
    await expect(this.prospectRow(email), `${email} did not show ${status} on the Prospects tab`).toContainText(status, { timeout });
  }

  private async cell(row: Locator, header: string): Promise<Locator> {
    const headers = (await this.page.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
    return row.getByRole('cell').nth(headers.indexOf(header));
  }
}
