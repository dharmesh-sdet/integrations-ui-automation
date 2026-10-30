# Zoho Prospect Unsubscribed: progress

Date: 2026-10-30. Mode: regression (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-30)

- Account: `notemailsentzoho`, own sequence "Zoho Prospect Unsubscribed QA", own mailbox and prospects. Zoho profile `auth/mcp-zoho-not-email-sent-profile`.
- Unsubscribe method: Mark as Unsubscribe on the Prospects tab for most rows. The real link from Mailinator for 3 rows (Trigger 4, 5, 6).
- Z-6: one Contact row states the known result (tag replaces VIP). No Jira draft.
- Size: about 20 rows. Field-level cases stay in Email Sent.
- QA 2026-10-30: write test cases only, no script for now. "looks great" received, cases saved.

## State

- Stage 1 (context) done: `00-overview.md`, `prospect-unsubscribed.md`, `field-mapping.md`.
- Stage 2 (test cases): 20 rows saved in `test-cases/zoho/prospect-unsubscribed.md`.
- Stage 3 (spec): not started, on hold by QA. No sequence, CSV, data script or spec.

## Unconfirmed

- Note title and text for this trigger (first run reads Zoho).
- Trigger 4 to 6 (link, second open, resubscribe).
- Whether the Lead action alone also creates a contact with the tag.

## Next (when QA asks for the script)

1. Create sequence "Zoho Prospect Unsubscribed QA" on `notemailsentzoho`, 1 step, own mailbox, Unsubscribe as Link saved.
2. Check `src/pages/mailinator.page.ts` for an unsubscribe-link helper.
3. Hand-write `tests/zoho/prospect-unsubscribed.spec.ts` and CSV. Reuse `src/pages/zoho/zoho-crm.page.ts` and `src/flows/saleshandy-to-zoho.ts`.
4. Run once, then only failed or unrun rows with `KEEP_TEST_DATA=1`.
