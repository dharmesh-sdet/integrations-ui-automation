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

  // "Create Sequence" makes a draft named "New Sequence - <date>" at once and
  // opens its Steps tab. A new account shows the button twice (onboarding card
  // and list toolbar); the toolbar one is last. Returns the sequence id.
  async create(name: string): Promise<string> {
    await this.closeSidebar();
    await this.page.getByRole('button', { name: 'Create Sequence', exact: true }).last().click();
    await this.page.waitForURL(/\/sequence\/\d+\/steps/);
    const id = this.page.url().match(/\/sequence\/(\d+)\//)![1];
    // A "LinkedIn Automation" intro pops up the first time.
    const skip = this.page.getByRole('button', { name: 'Skip', exact: true });
    await skip.click({ timeout: 3_000 }).catch(() => {});
    await this.rename(name);
    return id;
  }

  // The name is an input in the header. It loads after the page; typing before
  // its value is there fails with "Oops!" (seen 2026-10-09).
  private async rename(name: string): Promise<void> {
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
}
