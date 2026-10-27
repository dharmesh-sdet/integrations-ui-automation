import { PipedrivePage } from './pipedrive.page.ts';

export type PipedriveDeal = { id: string; title: string; pipeline: string; stage: string; value: string };

// Pipedrive Deals (seen 2026-10-24). A deal page shows the title as its heading, the pipeline and
// stage as two lines of text under it ("Pipeline", "Qualified"), and the value (₹0) at the top of Summary.
export class PipedriveDealsPage extends PipedrivePage {
  async open(id: string): Promise<void> {
    await this.goto(`/deal/${id}`);
    await this.byId('won-button').waitFor();
  }

  // Add deal dialog opened from a person page (+ Deal). Contact person is pre-filled with that
  // person; Title defaults to the person's name, so it is always set. Returns the new deal's id.
  async createOnPerson(personId: string, deal: { title: string; value?: number }): Promise<string> {
    await this.goto(`/person/${personId}`);
    await this.byId('add-new-btn').getByRole('button', { name: 'Deal' }).click();
    const dialog = this.addDialog();
    await dialog.getByText('Title', { exact: true }).waitFor();
    // Pipedrive puts the person's name into Title after the dialog opens, and on a second deal it did so
    // after the fill (seen 2026-10-26: "Legacy Person" saved instead of "Legacy deal 2"). The title is
    // typed again until it still stands a moment later.
    const titleInput = dialog.getByText('Title', { exact: true }).locator('xpath=following::input[1]');
    for (let attempt = 1; ; attempt++) {
      await titleInput.fill(deal.title);
      await this.page.waitForTimeout(1_500);
      if ((await titleInput.inputValue()) === deal.title) break;
      if (attempt === 4) throw new Error(`The Add deal dialog keeps replacing the title "${deal.title}"`);
    }
    if (deal.value !== undefined) await dialog.getByText('Value', { exact: true }).locator('xpath=following::input[1]').fill(String(deal.value));
    await this.saveAddDialog();
    // The toast's View link does not navigate (seen 2026-10-24), so the id comes from the new deal's
    // tile in the person's Deals block.
    // The tile can take longer than the toast to show (seen 2026-10-26: "Legacy deal 2" missing for 15 s
    // in Delete Deal 1), so the person page is reloaded once before giving up.
    const tile = this.byId('pipeline-deal-tile').filter({ hasText: deal.title }).locator('a[href*="/deal/"]').first();
    try {
      await tile.waitFor({ timeout: 15_000 });
    } catch {
      await this.page.reload();
      await tile.waitFor({ timeout: 30_000 });
    }
    return PipedrivePage.idOf(await tile.getAttribute('href'));
  }

  async read(id: string): Promise<PipedriveDeal> {
    await this.open(id);
    const title = (await this.page.title()).replace(/ - Deals$/, '').trim();
    // "pipeline-info" holds the pipeline and its stage on two lines; "deal-value" reads "₹100 Products".
    const [pipeline, stage] = (await this.byId('pipeline-info').first().innerText()).split('\n').map((t) => t.trim()).filter(Boolean);
    const value = (await this.byId('deal-value').first().innerText()).split('\n')[0].replace(/\s*Products$/, '').trim();
    return { id, title, pipeline, stage, value };
  }

  // Deletes the open deal (Options "..." > Delete > "Delete deal").
  async deleteOpen(): Promise<void> {
    await this.deleteFromHeaderMenu();
  }
}
