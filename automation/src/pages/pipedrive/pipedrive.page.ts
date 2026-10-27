import type { Locator } from '@playwright/test';
import { BasePage } from '../base.page.ts';

// Base of the Pipedrive pages (company `saleshandy.pipedrive.com`, seen 2026-10-24). Pipedrive's
// own markup carries stable data-test attributes (`add-modals-save`, `person.name`, ...), so
// those are used where the page has them; everything else is found by role and text.
export class PipedrivePage extends BasePage {
  readonly platform = 'pipedrive' as const;

  // Pipedrive marks its elements with data-test on some pages and data-testid on others (seen
  // 2026-10-24: the toast and the Add dialog use data-test, the person page uses data-testid), and
  // Playwright's getByTestId reads data-testid only, so both are matched here.
  protected byId(id: string): Locator {
    return this.page.locator(`[data-test="${id}"], [data-testid="${id}"]`);
  }

  // The "Add person / deal / organization" dialog. Its Save button is the same in all three. A
  // second, empty role=dialog sits on the page (seen 2026-10-24), so the dialog is found by
  // Pipedrive's own data-test, not by role.
  protected addDialog(): Locator {
    return this.byId('compound-modal');
  }

  protected async saveAddDialog(): Promise<void> {
    await this.byId('add-modals-save').click();
    await this.addDialog().waitFor({ state: 'hidden' });
  }

  // The first number in a link like /person/5 or /deal/12.
  protected static idOf(href: string | null): string {
    const id = href?.match(/\/(\d+)(?:[/?]|$)/)?.[1];
    if (!id) throw new Error(`No record id in "${href}"`);
    return id;
  }

  // Pipedrive's trial opens popups (tips, "Find the right contacts faster") over the page.
  // They never block the test's own clicks, so they are left alone.

  // The "..." menu at the top right of a person or deal page has no accessible name. It is the
  // last unnamed button of the page header (seen 2026-10-24: the person page marks it
  // data-test="header-blocks-actions", the deal page does not).
  protected async openHeaderMenu(): Promise<void> {
    const marked = this.byId('header-blocks-actions');
    const lost = this.page.getByRole('button', { name: 'Lost', exact: true });
    // count() does not wait: on a page still loading it read 0 and the person page was sent to the deal
    // branch, which waited for a "Lost" button that a person page does not have (Trigger behavior 4,
    // 2026-10-26). Wait for either header first.
    await marked.or(lost).first().waitFor({ timeout: 30_000 });
    if (await marked.count()) {
      await marked.click();
      return;
    }
    await this.page.getByRole('button', { name: 'Lost', exact: true }).locator('xpath=following::button[2]').click();
  }

  // Header "..." menu > Delete > the confirm dialog's red button ("Delete", or "Delete deal" on a
  // deal). The page holds several other "Delete" labels (hidden dialogs, seen 2026-10-24), so the menu
  // item is found by its data-testid and the button inside the dialog that is open.
  protected async deleteFromHeaderMenu(): Promise<void> {
    await this.openHeaderMenu();
    await this.page.locator('[data-testid="header-action-name"]', { hasText: /^Delete$/ }).click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: /Are you sure you want to delete/ });
    await dialog.getByRole('button', { name: /^Delete/ }).last().click();
    await dialog.waitFor({ state: 'hidden' });
  }
}
