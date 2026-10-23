import { expect, type Locator } from '@playwright/test';
import { SaleshandyPage } from './saleshandy.page.ts';

// Sequences list and a sequence's Steps tab: create, rename, add Email steps
// from a template (seen 2026-10-09).
export class SequenceBuilderPage extends SaleshandyPage {
  // Waits for the list request: rows can render before it returns, and checking
  // exists() then made a duplicate sequence (seen 2026-10-09).
  async openList(): Promise<void> {
    const listLoaded = this.page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
    await this.goto('/sequence');
    await listLoaded;
    await this.page.getByRole('row').nth(1).waitFor();
  }

  async exists(name: string): Promise<boolean> {
    return (await this.page.getByRole('row').filter({ has: this.page.getByText(name, { exact: true }) }).count()) > 0;
  }

  // Id of an existing sequence, from the link in its row.
  // TODO(needs-input): assumes the row links to /sequence/<id>/...; the first run confirms it.
  async idOf(name: string): Promise<string> {
    const row = this.page.getByRole('row').filter({ has: this.page.getByText(name, { exact: true }) }).first();
    const href = (await row.locator('a[href*="/sequence/"]').first().getAttribute('href')) ?? '';
    const id = href.match(/\/sequence\/(\d+)/)?.[1];
    if (!id) throw new Error(`No sequence id found in the row of "${name}" (link: "${href}")`);
    return id;
  }

  // "Create Sequence" makes a draft named "New Sequence - <date>" at once and
  // opens its Steps tab. A new account shows the button twice (onboarding card
  // and list toolbar); the toolbar one is last. Returns the sequence id.
  async create(name: string): Promise<string> {
    await this.closeSidebar();
    await this.page.getByRole('button', { name: 'Create Sequence', exact: true }).last().click();
    await this.page.waitForURL(/\/sequence\/\d+\/steps/);
    const id = this.page.url().match(/\/sequence\/(\d+)\//)![1];
    await this.skipIntro();
    await this.rename(name);
    return id;
  }

  // A "LinkedIn Automation" intro pops up the first time. On production it came
  // up later than 3 s and its backdrop blocked the rename for the whole test
  // (seen 2026-10-14), so wait longer for it.
  async skipIntro(): Promise<void> {
    const skip = this.page.getByRole('button', { name: 'Skip', exact: true });
    await skip.click({ timeout: 10_000 }).catch(() => {});
    await this.page.locator('.li-tour-backdrop').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  // The name is an input in the header. It loads after the page; typing before
  // its value is there fails with "Oops!" (seen 2026-10-09).
  async rename(name: string): Promise<void> {
    const input = this.page.locator('.sequence-name--input');
    await expect(input).not.toHaveValue('');
    await input.click();
    await input.fill(name);
    await input.press('Enter');
    await this.page.getByRole('alert').filter({ hasText: 'Sequence renamed successfully' }).waitFor();
  }

  private editor(): Locator {
    return this.page.getByRole('dialog');
  }

  // Subject and body are TinyMCE inline editors with no accessible names.
  private body(): Locator {
    return this.editor().locator('.editor-editable-content:not(.single-line-content)');
  }

  // Adds an Email step on an empty sequence: the template from the Saleshandy
  // Library, then the heading line in the largest font size, a blank line, the
  // template body (QA, 2026-10-09). The editor strips font sizes on save
  // ("Styling Removes Automatically"), so only the heading text stays.
  async addEmailStep(template: string, heading: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Email', exact: true }).click();
    // The editor loads after the dialog; typing earlier is lost (seen 2026-10-09).
    await this.editor().getByRole('button', { name: 'Font sizes' }).waitFor();
    await this.editor().getByText('Template', { exact: true }).click();
    const picker = this.page.getByRole('dialog').filter({ hasText: 'Email Templates' });
    await picker.getByText('Saleshandy Library', { exact: true }).click();
    await picker.getByText(template, { exact: true }).click();
    await picker.getByRole('button', { name: 'Use Template', exact: true }).click();
    await expect(picker).toBeHidden();
    // The template fills the body in more than one pass; text typed in between
    // was lost (seen 2026-10-09). Wait until two reads a second apart match.
    let previous = '';
    await expect
      .poll(async () => {
        const now = await this.body().innerText();
        const settled = now.trim() !== '' && now === previous;
        previous = now;
        return settled;
      }, { message: 'Template body did not finish loading', intervals: [1_000] })
      .toBe(true);

    // Clicked at its top-left corner: the middle can be a merge-tag chip, which
    // is not editable, and the typing is then lost (seen 2026-10-09).
    await this.body().click({ position: { x: 2, y: 2 } });
    await this.page.keyboard.press('Control+Home');
    await this.page.keyboard.type(heading);
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.press('Enter');
    await expect(this.body()).toContainText(heading);
    await this.page.keyboard.press('Control+Home');
    await this.page.keyboard.press('Shift+End');
    await this.editor().getByRole('button', { name: 'Font sizes' }).click();
    await this.page.getByRole('menuitemcheckbox').last().click();

    await this.editor().getByRole('button', { name: 'Save', exact: true }).click();
    await this.page.getByRole('alert').filter({ hasText: 'Sequence step created successfully.' }).waitFor();
  }

  // Link tracking setup (seen on staging 2026-10-15, specs/link-clicked-smoke-sequence.md).
  private subjectEditor(): Locator {
    return this.editor().locator('.editor-editable-content.single-line-content');
  }

  // Reads the body editor's HTML through window.tinymce (the body is the editor
  // whose element lacks class single-line-content).
  private async bodyHtml(): Promise<string> {
    return this.page.evaluate(() => {
      const eds = (window as any).tinymce?.editors ?? [];
      for (const ed of eds) {
        const el: HTMLElement | undefined = ed.getElement?.() ?? ed.bodyElement;
        if (el && !el.classList.contains('single-line-content')) return ed.getContent() as string;
      }
      return '';
    });
  }

  private async setBodyHtml(html: string): Promise<void> {
    await this.page.evaluate((h) => {
      const eds = (window as any).tinymce?.editors ?? [];
      for (const ed of eds) {
        const el: HTMLElement | undefined = ed.getElement?.() ?? ed.bodyElement;
        if (el && !el.classList.contains('single-line-content')) ed.setContent(h);
      }
    }, html);
  }

  // Adds an Email step on an empty sequence with a typed subject and a body that
  // holds the given links. setContent can leave the body empty on the first try,
  // so it is set again until every href reads back (seen 2026-10-15). Save needed
  // two clicks once: click again if no toast in 3 s and the dialog is still open.
  async addEmailStepWithLinks(subject: string, bodyHtml: string, hrefs: string[]): Promise<void> {
    await this.page.getByRole('button', { name: 'Email', exact: true }).click();
    await this.editor().waitFor();
    await expect
      .poll(() => this.page.evaluate(() => (window as any).tinymce?.editors?.length ?? 0), {
        message: 'Editors did not load',
        intervals: [500],
      })
      .toBe(2);
    await this.subjectEditor().click();
    await this.page.keyboard.type(subject);
    await expect(this.subjectEditor()).toContainText(subject);

    // TinyMCE can add a trailing slash to a bare host, so match the URL without it.
    const withoutSlash = (u: string) => u.replace(/\/$/, '');
    await expect
      .poll(
        async () => {
          const current = await this.bodyHtml();
          if (hrefs.every((h) => current.includes(`href="${withoutSlash(h)}`))) return true;
          await this.setBodyHtml(bodyHtml);
          return false;
        },
        { message: 'Body links did not read back', intervals: [1_500], timeout: 30_000 },
      )
      .toBe(true);

    const toast = this.page.getByRole('alert').filter({ hasText: 'Sequence step created successfully' });
    const save = this.editor().getByRole('button', { name: 'Save', exact: true });
    await save.click();
    const created = await toast.waitFor({ timeout: 3_000 }).then(() => true, () => false);
    if (!created && (await this.editor().count()) > 0) {
      await save.click();
      await toast.waitFor();
    }
    await expect(this.editor()).toHaveCount(0);
  }

  // Settings tab > Safety Settings > Track link clicks > Enable Anyway.
  // Nothing in the Email Accounts row is touched (a click there removes the sender).
  async enableLinkTracking(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Settings' }).click();
    await this.page.waitForURL(/\/settings/);
    await this.page.getByRole('button', { name: 'Safety Settings' }).click();
    await this.page.getByRole('button', { name: 'Track link clicks' }).click();
    await this.page.getByRole('dialog').filter({ hasText: 'Enable Link Tracking in Emails?' }).waitFor();
    await this.page.getByRole('button', { name: 'Enable Anyway' }).click();
    await this.page.getByRole('alert').filter({ hasText: 'Sequence settings updated successfully' }).waitFor();
  }

  // Opens an existing sequence from the list by its name (list already open).
  async openExisting(name: string): Promise<void> {
    await this.page.getByRole('row').filter({ has: this.page.getByText(name, { exact: true }) }).getByText(name, { exact: true }).click();
    await this.page.waitForURL(/\/sequence\/\d+\//);
    await this.skipIntro();
  }

  // Settings tab > Email Account (seen on staging 2026-10-22): the sequence's own sender
  // table has an "Active Sequence" column; "+ Add more email accounts" opens "Select email
  // accounts to add to the sequence" (rows with a checkbox, column "Active Seq."), then
  // "Add to Sequence". Accounts already in the table are left alone. Throws if an account
  // is not listed in the dialog or is not in the table afterwards.
  async addEmailAccounts(sequenceId: string, emails: string[]): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/settings`);
    const table = this.page.getByRole('table').filter({ has: this.page.getByRole('columnheader', { name: 'Active Sequence' }) });
    const add = this.page.getByRole('button', { name: /Add (more )?email accounts?/i }).first();
    await add.waitFor({ timeout: 30_000 });
    const rowOf = (scope: Locator, email: string): Locator => scope.getByRole('row').filter({ hasText: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    // The table fills after the buttons; give it a moment before judging an account missing.
    await this.page.waitForTimeout(3_000);
    const missing: string[] = [];
    for (const email of emails) if ((await rowOf(table, email).count()) === 0) missing.push(email);
    if (missing.length) {
      await add.click();
      const dialog = this.page.getByRole('dialog').filter({ hasText: 'Select email accounts to add to the sequence' });
      await dialog.waitFor({ state: 'visible', timeout: 20_000 });
      for (const email of missing) {
        const row = rowOf(dialog, email);
        // The list shows grey loading bars while it loads and again after a tick (seen
        // 2026-10-22, production: the second account was judged missing mid-load).
        await row.first().waitFor({ timeout: 20_000 }).catch(() => {});
        if ((await row.count()) === 0) throw new Error(`The email account ${email} is not in the list of accounts that can be added to this sequence.`);
        await row.getByRole('checkbox').check();
      }
      await dialog.getByRole('button', { name: 'Add to Sequence', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
    }
    for (const email of emails) await expect(rowOf(table, email), `${email} on the sequence's Email Account table`).toBeVisible({ timeout: 20_000 });
  }

  currentSequenceId(): string {
    return this.page.url().match(/\/sequence\/(\d+)\//)![1];
  }

  // Same as enableLinkTracking, but leaves the switch alone when it is already on.
  async enableLinkTrackingIfOff(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Settings' }).click();
    await this.page.waitForURL(/\/settings/);
    await this.page.getByRole('button', { name: 'Safety Settings' }).click();
    if (await this.safetySettingChecked('Track link clicks')) return;
    await this.enableLinkTracking();
  }

  // State of one Safety Settings switch, by its label text.
  async safetySettingChecked(label: string): Promise<boolean> {
    return this.page.locator('label', { hasText: label }).first().locator('xpath=..').locator('input').first().isChecked();
  }
}
