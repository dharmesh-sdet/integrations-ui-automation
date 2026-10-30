# Zoho Email Bounced: progress

Date: 2026-10-30. Mode: regression (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-30)

- Account: `notemailsentzoho` (all Zoho workflows except Email Sent), run in parallel with the other workflows, each with its own sequence and prospects (QA 2026-10-30). Zoho profile `auth/mcp-zoho-not-email-sent-profile`.
- Bounce method: Emails tab > Actions > Mark as bounced for every row, plus one real-bounce row (`name@<company>.mailinator.com`).
- Scope: all 5 actions plus combined and trigger rows.
- Tag: Expected says Bounced-Saleshandy, marked (proposed, unconfirmed). The first run reads the real tag in Zoho and updates the cases file.
- Z-6: one row states the known result (VIP tag replaced). Duplicate Task or Deal on a new contact: Expected says one record. A repeat shows Fail. No Jira draft until QA decides.
- Defaults accepted: Lead-only rows say nothing about the tag until the first run reads it. Cuts applied 2026-10-30 (QA OK): removed paused-sequence and Reply-only trigger rows, Contact no-Phone and Combined 2.
- Zoho: no Logs tab, check the Zoho record only. Wait 15 s after the bounce.

## State

- Stage 1 (context) done: `00-overview.md`, `email-bounced.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-30: 23 rows approved and saved (27 before the cuts of 2026-10-30) to `test-cases/zoho/email-bounced.md`.
- Stage 3 (spec): next. Not started. No sequence, CSV, data script or spec for Email Bounced yet.

## Unconfirmed

- Tag name (Bounced-Saleshandy or Unsubscribed-Saleshandy).
- Whether a Lead-only bounce adds a tag or creates a contact.
- Trigger 4 (real bounce).

## Next

1. Create sequence "Zoho Email Bounced QA" on `notemailsentzoho`: 2 steps, one own mailbox no other Zoho sequence uses.
2. Look for a "Mark as bounced" helper in `src/pages/saleshandy/` and the Pipedrive Email Bounced spec. Reuse them.
3. Hand-write `tests/zoho/email-bounced.spec.ts`, `test-data/zoho/email-bounced.csv`, data script and `npm run` scripts. Reuse `src/pages/zoho/zoho-crm.page.ts` and `src/flows/saleshandy-to-zoho.ts`. The Reply Received session owns those shared files. Send changes to it, do not edit them.
4. Run once to learn errors, then rerun only failed or unrun rows with `KEEP_TEST_DATA=1`. QA runs the full script.
