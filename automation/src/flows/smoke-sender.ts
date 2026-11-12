import { test } from '../fixtures/index.ts';
import type { Page } from '@playwright/test';

// Adds one sender to a production smoke sequence if it has none (QA, 2026-11-03): a preferred
// sender is used when the Add email accounts dialog lists it, otherwise the listed account with
// the fewest active sequences. Same logic as tests/setup/salesforce-link-clicked-smoke-sequence.spec.ts.
// Returns the sender email, or a note when one is already on the sequence.
export async function addListedSender(page: Page, sequenceId: string, preferredEmails: string[]): Promise<string> {
  await page.goto(`/sequence/${sequenceId}/settings`);
  const add = page.getByRole('button', { name: /Add (more )?email accounts?/i }).first();
  await add.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  const onPage = (await page.locator('body').innerText()).match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
  const known = onPage.filter((e) => !/@saleshandy\.com$/i.test(e) || preferredEmails.some((p) => p.toLowerCase() === e.toLowerCase()));
  if (known.length > 0) return `already on the sequence (${known[0]})`;
  await add.click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Select email accounts to add to the sequence' });
  await dialog.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(3_000);
  // Every account is already on this sequence (or none exists): the dialog lists nothing. The sequence settings
  // page then shows the senders, so stop here instead of clicking the empty select-all box until the timeout.
  if (await dialog.getByText('No email account available').isVisible()) {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    const assigned = (await page.locator('body').innerText()).match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
    if (!assigned.length) throw new Error('The Add email accounts dialog lists no account and the sequence has no sender. Connect one on the Email Accounts page, then run again.');
    return `already on the sequence (${assigned[0]}); the dialog lists no other account`;
  }
  const boxes = dialog.locator('input[type="checkbox"]');
  await boxes.first().waitFor({ timeout: 20_000 });
  // For each checkbox, the email and the active-sequence count come from its nearest ancestor that shows an email.
  const listed = await boxes.evaluateAll((els) =>
    els.map((el, index) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && !/[\w.+-]+@[\w.-]+\.\w+/.test(node.innerText ?? '')) node = node.parentElement;
      const text = node?.innerText ?? '';
      const email = text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? '';
      const active = Number(text.split(/\s+/).find((w) => /^\d+$/.test(w)) ?? 0);
      return { index, email, active };
    }),
  );
  const usable = listed.filter((l) => l.email);
  if (!usable.length) throw new Error('The Add email accounts dialog lists no account. Connect one on the Email Accounts page, then run again.');
  const preferred = usable.find((l) => preferredEmails.some((p) => p.toLowerCase() === l.email.toLowerCase()));
  const pick = preferred ?? [...usable].sort((a, b) => a.active - b.active)[0];
  test.info().annotations.push({ type: 'sender', description: `${pick.email} (${preferred ? 'preferred' : 'first free in the list'}; listed: ${usable.map((l) => l.email).join(', ')})` });
  await boxes.nth(pick.index).check();
  await dialog.getByRole('button', { name: 'Add to Sequence', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
  return pick.email;
}
