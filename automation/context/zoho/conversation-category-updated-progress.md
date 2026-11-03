# Zoho Conversation Category Updated: progress

Date: 2026-10-30. Mode: regression (staging). QA asked for test cases only, no script (2026-10-30).

## QA answers (2026-10-30)

- Staging look allowed, read only, with profile `auth/mcp-zoho-not-email-sent-profile`.
- Outcome change: dropdown in Sequence > Prospects, plus one Unified Inbox row.
- Z-7: one row, known result, not filed again.
- Size: realistic, executable, precise, concise. 20 rows.
- Approval: "looks great" after the draft, read as "looks good".

## State

- Stage 1 (context) done: `00-overview.md`, `conversation-category-updated.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-30: 20 rows saved to `test-cases/zoho/conversation-category-updated.md`.
- Stage 3 (spec): not started. QA wants test cases only for now.

## Seen on staging (2026-10-30, read only, nothing saved)

- Each action opens Extra Configuration with "Select Saleshandy Conversation Category".
- The box is empty and shows no value list on click. Free text is not tested.
- Email Sent was ON with Create/Update a Contact in the profile account. Not confirmed which account.

## Unconfirmed

- Whether the category box takes free text or a list.
- Whether each action keeps its own category or all five share one (Combined row 1 uses one category).
- Trigger row 5 (Unified Inbox) and row 3 (empty category in the UI).
- Note title and exact note text.

## Possible additions (QA has not asked)

- A Deal row with Closing date above 0.
- A mixed-category Combined row.

## Findings (exploration 2026-10-31)

- Extra Configuration of the Conversation Category trigger, Contact action: the category is one plain text box ("Select Saleshandy Conversation Category"), not a list. An empty box saves. The helper in `src/flows/zoho-conversation-category-updated.ts` now types into the box when the dialog has no list. Deal and Task dialogs were not looked at.
- Trigger and category gate 3 (outcome Not Now, empty box, prospect Marcus Oyelaran): 1 contact, 0 leads, 1 note. The Prospects row showed "Not Now".
- Trigger and category gate 5: blocked. The Unified Inbox route is `/conversations`, not `/unified-inbox`. The inbox of this account showed 0 threads. A prospect marked as replied by hand creates no thread, so the category cannot be set. The row needs a real reply from a mailbox that QA controls (as in the Reply Received "Real reply" row, `ZOHO_REPLY_GMAIL`). Open for QA.

## Regression run 2026-11-03

- QA 2026-11-03: keep the 20 approved cases. Gate row 5 skipped (needs a real reply in Unified Inbox).
- Setup spec `tests/setup/zoho-conversation-category-sequence.spec.ts` (new, not committed, one step). Sequence "Zoho Conversation Category QA" = id 197599, sender 5kartiktest+1@gmail.com, active. Profile copy `auth/zoho-conversation-category-profile` already existed.
- Run: `ZOHO_CC_SEQUENCE_ID=197599 KEEP_TEST_DATA=1 npm run test:zoho-conversation-category-updated`. Data: `npm run data:zoho-conversation-category-updated` (19 rows, remade 14:51).
- Mistake: the first two setup runs lacked KEEP_TEST_DATA=1 and refreshed every CSV in test-data/zoho at 14:50 (same as the 2026-11-02 incident). Other workflows' prospects changed. Lesson proposal pending QA OK.

## Moved to gzoho (2026-11-03)

- QA: use the Email Sent account (gzoho = dharmesh+zohointegration@saleshandy.com) and sequence 197611 (many sender mailboxes).
- Spec: account gzoho, default sequence 197611, profile `auth/zoho-cc-gzoho-profile` (copy of `auth/mcp-zoho-profile`), KEEP_OTHER_TRIGGERS=0 so Email Sent is turned off.

## Runs on gzoho (2026-11-03)

- Data: Real Madrid players 2000-2026 (`src/data/real-madrid-players.ts`), numbered mailinator emails (gzoho already had iker.casillas@mailinator.com).
- 18 of 20 passed at least once over five runs. Skipped: gate 3 (QA: saved category stays, empty box checked earlier), gate 5 (needs a real reply).
- Gate 4 Expected changed (QA): Meeting Booked makes one contact and one note. Task 2 Expected changed (QA): Save disabled while Subject is empty.
- Account Fields mapping changed (QA OK): Company to Account Name, First Name unmapped (`tests/setup/zoho-account-name-mapping.spec.ts`).
- Account 2 (QA 2026-11-03): the linked account taking the company name is expected. Expected changed, rerun passed.
- Seen once: contact Javier Portillo got City and State but not Country "Egypt". Next Contact 1 run (Philippines) had the Country.
- Not committed.
