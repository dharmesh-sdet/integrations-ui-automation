import type { Row } from '../data/csv.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { fullName } from './saleshandy-to-zoho.ts';

// Steps only the Zoho Email Sent spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Email Sent from Saleshandy';
export const NOTE_TITLE = 'Saleshandy Email Sent from Sequence';

// Adds the prospect to step 1 and sends it, or moves a prospect that is already in the sequence to a
// later step and sends that step. Returns when the Emails tab row shows "Sent" (counts against the send cap).
export async function sendStep(seq: SaleshandySequencePage, sequenceId: string, row: Row, step = 1): Promise<void> {
  if (step === 1) await seq.createAndAddProspect(sequenceId, row);
  else await seq.moveToStep(sequenceId, row['Email'], step);
  await seq.sendNow(sequenceId, fullName(row), step, row['Email']);
}

// Zoho shows dates as dd/mm/yyyy for the test user (seen 29/10/2026 on 2026-10-29).
export function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [d.getDate(), d.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('/') + `/${d.getFullYear()}`;
}

// A task page has no Notes count, only the note text, so notes are counted by their title.
export const noteTitles = (text: string): number => text.split(NOTE_TITLE).length - 1;
