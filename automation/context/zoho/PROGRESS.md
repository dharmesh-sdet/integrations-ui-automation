# Zoho: progress

Updated: 2026-11-12. When QA asks for progress, show this table. After every change to a case file, a spec or a run, update it.

All 7 Zoho workflows have test cases and hand-written specs. All 7 passed their production smoke and are released (QA, 2026-11-03 and 2026-11-04). Nothing is left to run. Before the next Zoho run, log in again (see `RESUME.md`, "Logins").

| Workflow | Test cases | Staging result | Production smoke | Detail |
|---|---|---|---|---|
| Email Sent | 24 rows | 22 pass. Task 3 fails (AL-4198). Combined 1 passed in 1 of 2 runs | 8 of 8, released (sheet row 22) | `email-sent-progress.md` |
| Email Opened | 24 rows | 24 pass (2026-11-02) | 7 of 7, released (sheet row 24, note 16) | `email-opened-progress.md` |
| Link Clicked | 23 rows | 23 of 23 passed over 5 runs, approved (QA, 2026-11-03) | 8 of 8, sequence 988717, released (note 17, AL-4194 sent, sheet row 25) | `link-clicked-progress.md` |
| Email Bounced | 22 rows | 22 of 22 passed at least once, approved (QA, 2026-11-03) | 8 of 8, sequence 989765, released (note 18, AL-4195 sent, sheet row 27) | `email-bounced-progress.md` |
| Reply Received | 24 rows | 22 of 24 pass, 2 skipped, approved (QA, 2026-11-03) | 8 of 8 plus the Prospects tab check, released (note 19). AL-4192 and AL-4219 drafts approved, QA sends | `reply-received-progress.md` |
| Conversation Category Updated | 20 rows | 18 of 20 passed (2026-11-03) | 8 of 8 over three runs, sequence 990987, released (note 20, AL-4197 draft, sheet row 28) | `conversation-category-updated-progress.md` |
| Prospect Unsubscribed | 20 rows | 19 of 19 passed at least once (QA approved 2026-11-04) | 8 of 8 over several runs, sequence 990987, released (note 21, AL-4196 draft, sheet row 26) | `prospect-unsubscribed-progress.md` |

## Notes

- Email Sent runs on `gzoho`. The other six run on `notemailsentzoho`, in parallel, each with its own sequence, mailbox and prospects (QA, 2026-10-30).
- Test case files are `test-cases/zoho/<workflow>.md`. Production smokes run with `npm run smoke:zoho-<workflow>`. Staging runs use `npm run test:zoho-<workflow>`.
- QA rule (2026-11-02): the production smokes after Email Opened include a check that updates the newest deal of a contact with 2 deals.
- Open: `OPENED_TRIGGER` in `src/flows/zoho-link-clicked.ts` does not match the screen text. Details are in `RESUME.md`.
- Left unconfirmed on purpose: Conversation Category gate 5 (needs a real reply in Unified Inbox) and the tag names Bounced-Saleshandy and Unsubscribed (QA to say where they show).
- Zoho browser profiles were deleted on 2026-11-12 because they expired. The workflow files name them as history.
