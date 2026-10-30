import type { Row } from '../data/csv.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { ZohoCrmPage, type ZohoModule } from '../pages/zoho/zoho-crm.page.ts';
import { fullName } from './saleshandy-to-zoho.ts';

// Steps only the Zoho Email Bounced spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Email is Bounced in Saleshandy';
// The note title is known from the developer log (runs B1 and B3).
export const NOTE_TITLE = 'Saleshandy Email is Bounced';
// TODO(needs-input): the tag is not confirmed. The dev log says Bounced-Saleshandy, the public docs say
// Unsubscribed-Saleshandy. The spec records which one it sees and does not assert it (QA 2026-10-30).
export const TAG_CANDIDATES = ['Bounced-Saleshandy', 'Unsubscribed-Saleshandy'] as const;

// Adds the prospect to the sequence, then Emails tab > row > Actions > Mark as bounced. The email is not
// sent: Mark as bounced works on a scheduled row (Pipedrive Email Bounced, 2026-10-28). A prospect can be marked once.
export async function bounce(seq: SaleshandySequencePage, sequenceId: string, row: Row): Promise<void> {
  await seq.createAndAddProspect(sequenceId, row);
  await seq.markAsBounced(sequenceId, fullName(row), 1, row['Email']);
}

// The one real-bounce address: name@<company>.mailinator.com (QA 2026-10-12). A plain @mailinator.com never bounces.
export function realBounceEmail(row: Row): string {
  const company = row['Company'].normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
  if (!company) throw new Error('A real-bounce prospect needs a company (an empty one gives "@.mailinator.com")');
  return row['Email'].replace(/@mailinator\.com$/i, `@${company}.mailinator.com`);
}

// Which candidate tag names a record page shows (see TAG_CANDIDATES). Recorded, not asserted.
export const tagsSeen = (text: string): string => TAG_CANDIDATES.filter((t) => text.includes(t)).join(', ') || 'none';

// Notes with the bounce title on a record page. A task page has no Notes count, so notes are counted by title.
export const bounceNotes = (text: string): number => text.split(NOTE_TITLE).length - 1;

// Puts a tag on a record by hand (Contact 4 needs the tag VIP first).
// TODO(needs-input): the tag button and its box on the record page are not seen yet. Heal on the first run.
export async function addTag(crm: ZohoCrmPage, module: ZohoModule, id: string, tag: string): Promise<void> {
  await crm.recordText(module, id);
  const page = crm.page;
  await page.locator('[data-zcqa="tagButton"], [title="Tags"], [aria-label="Tags"]').first().click({ timeout: 20_000 });
  const input = page.getByPlaceholder(/tag/i).first();
  await input.fill(tag);
  await input.press('Enter');
  await page.getByRole('button', { name: /^(Save|Apply|Done)$/ }).first().click({ timeout: 15_000 });
}
