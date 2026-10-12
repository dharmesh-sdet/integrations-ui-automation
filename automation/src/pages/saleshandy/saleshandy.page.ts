import { BasePage } from '../base.page.ts';

export abstract class SaleshandyPage extends BasePage {
  readonly platform = 'saleshandy' as const;

  // The left menu can stay expanded over the page and cover what is behind it
  // (seen 2026-10-08: it covered the trigger toggles until the test timed out).
  // Clicking a blank spot of the top bar closes it.
  async closeSidebar(): Promise<void> {
    const expanded = this.page.locator('.app-sidebar__expanded');
    if (!(await expanded.isVisible())) return;
    const width = this.page.viewportSize()?.width ?? 1280;
    await this.page.mouse.click(width / 2, 25);
    await expanded.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}
