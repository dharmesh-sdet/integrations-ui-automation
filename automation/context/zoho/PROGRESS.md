# Zoho: progress

Updated: 2026-10-30. Mode: regression (staging). When QA asks for progress, show this table. After every change to a case file, a spec or a run, update it.

Zoho has 7 workflows in scope. All 7 have context, test cases and scripts, and none has run in full.

| Workflow | Context | Test cases | Script | Run status |
|---|---|---|---|---|
| Email Sent | Done | 24 rows | 24 tests, committed 94cbac9 | Lead 1 passes, 23 not run |
| Reply Received | Done | 34 rows | 34 tests, committed 28e87bb | Lead 1 passes, 33 not run |
| Email Opened | Done | 25 rows saved | 25 tests written, typechecks, not committed. Sequence not created | Not run |
| Email Bounced | Done | 23 rows saved | 23 tests written, typechecks, not committed. Sequence not created | Not run |
| Link Clicked | Done | 23 rows approved and saved | 23 tests written, typechecks, not committed. Sequence not created | Not run |
| Prospect Unsubscribed | Done | 20 rows approved and saved | 20 tests written, typechecks, not committed. Sequence not created | Not run |
| Conversation Category Updated | Done | 20 rows saved | 20 tests written, typechecks, not committed. Sequence not created | Not run |

## Notes

- Email Sent runs on `gzoho`. The other six run on `notemailsentzoho`, in parallel, each with its own sequence, mailbox and prospects (QA, 2026-10-30).
- Email Bounced went from 27 to 23 rows and Link Clicked from 29 to 23 after the QA-approved cuts of 2026-10-30.
- Test case files are `test-cases/zoho/<workflow>.md`. Per-workflow detail is in `<workflow>-progress.md` in this folder.
- 2026-10-30: Email Opened, Email Bounced and Conversation Category Updated specs written (hand-written, typecheck passes, `--list` only, nothing run). Each has a flow, a data script and `data:` and `test:` lines in `package.json`. Env vars: `ZOHO_EO_SEQUENCE_ID`, `ZOHO_EB_SEQUENCE_ID`, `ZOHO_CC_SEQUENCE_ID`. Zoho profile copies needed: `auth/zoho-email-opened-profile`, `auth/zoho-email-bounced-profile`, `auth/zoho-conversation-category-profile`.
- Open: `OPENED_TRIGGER` in `src/flows/zoho-link-clicked.ts` says "Sequence Email is Opened in Saleshandy", the screen says "Email is Opened in Saleshandy". Link Clicked Combined 2 depends on it. Email Opened trigger 5 runs only with `ZOHO_EO_WITH_REPLY=1`.
- 2026-10-30: Prospect Unsubscribed spec written (20 tests, typechecks, nothing run). Env var `ZOHO_PU_SEQUENCE_ID`, profile copy `auth/zoho-prospect-unsubscribed-profile`. The sequence needs "Unsubscribe as Link" saved. `ZOHO_PU_SKIP_SEND=1` skips the step 1 send on UI rows (QA decides the default). The spec imports `addTag` from `src/flows/zoho-email-bounced.ts`.
- Next: for each of the five workflows with a new spec, make the sequence and the Zoho profile copy, run the data script, then run once.
