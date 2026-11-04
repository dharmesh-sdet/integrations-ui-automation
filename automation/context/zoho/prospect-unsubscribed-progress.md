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

## Findings (exploration 2026-10-31)

- Lead 1 (UI unsubscribe, Lead action only, prospect Tobias Lindqvist): 1 lead with one note. 0 contacts with the email.
- Rows 4, 5, 6 (one prospect, Linnea Bergstrom, "Unsubscribe as Link" saved on the sequence): the unsubscribe page says "You will no longer receive emails from us". The Prospects tab showed Unsubscribed 11 seconds after the link, but only when the email stayed open 20 seconds before the link was used. In two earlier runs without that pause the row stayed Active for 120 seconds. The spec must wait before it uses the link.
- Row 4: 1 contact, 0 leads, 1 note. Row 5: the same link a second time gave 2 notes and still 1 contact. Row 6: "Subscribe here" shows "You have successfully subscribed and added to our list for future communication", the Prospects row shows Active, and the notes stay at 2.
- The tag was not seen in the record text of any record. This is open for QA.
- The unsubscribe link host on this account is now `cd1.shengage02.com` (the custom tracking domain), not `unsub.shengage02.com`.

## Setup done (2026-11-03)

- The spec of 2026-10-30 is written and committed (ac16c24): 20 tests, `npm run test:zoho-prospect-unsubscribed`. Stage 3 above is out of date.
- New setup spec `tests/setup/zoho-prospect-unsubscribed-sequence.spec.ts` (not committed). It saves "Unsubscribe as Link" itself and checks it after a reload. Run it with `KEEP_TEST_DATA=1`. Without that flag the global setup tries to refresh every CSV and stops with "Could not find a fresh name after 600 tries" (no file changed).
- Sequence "Zoho Prospect Unsubscribed QA" is id 197600 on `notemailsentzoho`: one step, Unsubscribe as Link saved, sender 6kartiktest+8@gmail.com added, active. No other Zoho sequence uses that sender.
- Profile copy `auth/zoho-prospect-unsubscribed-profile` made from the Conversation Category copy. Data file `test-data/zoho/prospect-unsubscribed.csv` made (19 rows).
- Open: the sender showed 40 of 50 sent today. 19 rows with the step 1 send need more than the 10 left. `ZOHO_PU_SKIP_SEND=1` skips the send on the UI rows.
- Run: `ZOHO_PU_SEQUENCE_ID=197600 npm run test:zoho-prospect-unsubscribed`.

## Review and speed-up run (2026-11-04)

- Changes: `configureOnce` (skips an unchanged save, uses `configureWaiting`), faster `ZohoCrmPage.find()` (wait for first row, sort once per module), `blockHeavyAssets` (`ASSET_BLOCK=0` turns it off), Trigger 2 selector moved to `ZohoIntegrationPage.openActivityConfiguration`, Lead 1 / Trigger 5 / Trigger 6 / Deal 3 assertions tightened. Committed 2026-11-04.
- Full run (`ZOHO_PU_SKIP_SEND=1`): 11 of 19 passed. Contact 1 (no step 1 send) fired the workflow, so the send can be skipped.
- Failed rows 3, Contact 1, Deal 3, Combined 1: a 1.5 s wait in `recordText()` cut the note body. 6 s restored, the four rows passed on rerun. Keep the 6 s.
- Failed rows 4, 5, 6 (link): the unsubscribe page opens but the Prospects tab stays "Completed" for 3 minutes. Same with `ASSET_BLOCK=0` (row 4 rerun). Log shows `net::ERR_TIMED_OUT` for `cd1.shengage02.com`. Cause not proved. QA to try one link by hand.
- Failed Account 2: the linked account name became the prospect company ("Linked Account 315808" to "ChurnZero 315808"). Cases say the name is kept. QA to say bug or not.
- Not rerun yet: the full suite after the 6 s restore (only the 4 rows were).

## Link rows fixed, Account 2 settled (2026-11-04, later)

- Link rows 4, 5, 6: the unsubscribe registers only when the click comes long enough after the send. 20 s after the email opened stayed Active for 3 minutes in 6 runs (also with 2 steps and `ASSET_BLOCK=0`). With 93 s (the HubSpot and Pipedrive production wait) row 4 showed Unsubscribed 15 s after the link (polled every 10 s). Rows 5 and 6 passed with the 93 s default (`ZOHO_PU_LINK_WAIT_MS`, 0 for the second open in row 5). Cause is a theory (a click too soon after the send is ignored), not confirmed by the product team.
- Sequence 197600 now has 2 steps (a one-step sequence turns a prospect Completed, QA 2026-11-04). Setup test: `SETUP_STEP2=1`.
- Account 2: QA 2026-11-04, Account Name is mapped to Company, so the hand-made name is replaced. Spec and cases updated. One run failed on State not on the account after 120 s, the rerun passed (late Zoho update).
- Account used: Saleshandy `dharmesh+noemailsent@saleshandy.com` (key `notemailsentzoho`, fixed in `accounts.ts`), Zoho `rudra@saleshandy.com`.
- Status: all 19 rows passed at least once, over several runs. No single full run after the last fixes. Committed 2026-11-04 (git log, "Zoho Prospect Unsubscribed").
