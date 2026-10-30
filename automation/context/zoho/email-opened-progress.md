# Zoho Email Opened: progress

Date: 2026-10-30. Mode: regression (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-30)

- Account: `notemailsentzoho` (all Zoho workflows except Email Sent). Zoho profile `auth/mcp-zoho-not-email-sent-profile`.
- Open method: Mailinator inbox, images loaded. Wait 10 s and refresh the Opened count, then 15 s, then look in Zoho. No Logs for Zoho.
- Scope: all 5 actions plus combined and trigger rows.
- Duplicate Task or Deal on a new contact: Expected says one record. A repeat shows Fail. No Jira draft until QA decides.

## State

- Stage 1 (context) done: `00-overview.md`, `email-opened.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-30: 25 rows approved ("looks good") and saved to `test-cases/zoho/email-opened.md`.
- Stage 3 (spec): next. Not started. No page objects, flow, CSV or spec for Email Opened yet.

## Unconfirmed

- Trigger 4 and Combined 2 (second open, Open Count 2, deal link on the second event).
- Note title and note text for this trigger. The first run reads them from Zoho and updates the cases file.

## Next

1. Create sequence "Zoho Email Opened QA" on `notemailsentzoho`: 2 steps, one own mailbox, Track email opens on, Track link clicks off.
2. Check `src/pages/mailinator.page.ts` for an open helper. Another session changed that file and did not commit it. Read it before you add anything.
3. Hand-write `tests/zoho/email-opened.spec.ts`, `test-data/zoho/email-opened.csv`, data script and `npm run` scripts. Reuse `src/pages/zoho/zoho-crm.page.ts` and `src/flows/saleshandy-to-zoho.ts`. The Reply Received session owns those shared files. Send changes to it, do not edit them.
4. Run once to learn errors, then rerun only failed or unrun rows with `KEEP_TEST_DATA=1`. QA runs the full script.
