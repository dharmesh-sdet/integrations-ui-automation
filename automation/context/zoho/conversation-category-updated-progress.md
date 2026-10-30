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
