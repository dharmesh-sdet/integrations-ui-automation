# Zoho Reply Received: progress

Date: 2026-10-29. Account `notemailsentzoho` (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-29)

- Reply method: Mark as Replied for all rows. One real reply from QA's Gmail is the last row.
- Scope: all 5 actions plus combined rows (34 rows).
- Separate Saleshandy accounts for Email Sent and the other Zoho workflows, so no clash. Own files for this workflow.

## State

- Stage 1 (context) done: `reply-received.md`, `00-overview.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-29: 34 rows approved ("looks good") and saved to `test-cases/zoho/reply-received.md`. Still unconfirmed rows: Contact 2, 4, 6, 7. The Gmail address for the Real reply row is not given yet.
- Stage 3 (spec): next. Hand-written, `tests/zoho/reply-received.spec.ts`.

## Rows QA verifies by hand (results go here)

| Item | What to record | Result |
|---|---|---|
| Mark as replied exists on this account | Present or not, exact wording | |
| Trigger 1 | Exact save message | |
| Contact 5 (no last name) | Contact created or rejected, and the Last Name value | |
| Lead 4 (no company) | Lead created or rejected, and the Company value | |
| Account 1 (company, no contact) | Account name equals the company | |
| Account 4 (same-name account exists) | Updated or second account | |
| Task 5 (Due In empty) | Task created or run fails, and the Due Date value | |
| Note title in Zoho | Exact title and lines | |
| Gmail address for the real reply row | Address | |

## Next

QA reports the results. Claude updates the draft, shows it, waits for "looks good", saves, then writes the spec.

## Manual verification results (2026-10-29, Claude, headless, no window)

Method: throwaway spec `tests/setup/zoho-reply-explore.spec.ts` (account `notemailsentzoho`, sequence "Zoho Reply Received QA" id 197387, sender Rachel 10, Reply trigger set per check). Zoho read on a virtual display with the profile `auth/mcp-zoho-not-email-sent-profile`. Logs were not read. Run with `KEEP_TEST_DATA=1`, otherwise global setup refreshes the CSVs of workflows that nobody runs.

| Item | Result |
|---|---|
| Mark as replied exists | Yes. The Emails tab three-dot menu has it and it worked on this account |
| Trigger 1 save message | "Configuration Updated Successfully" |
| Contact 5 (no last name), 08:39 UTC | No contact for `dharmesh+zoho-v1@saleshandy.com` in all Zoho contacts after 15 minutes. Cause not read (Logs not used) |
| Lead 4 (no company), 08:41 UTC | Lead "Devan Anand" created, Company empty, 1 note |
| Account 1 (company, no contact), 08:41 UTC | Account "Tanaka Robotics Works" created, named after the company, 1 note. Industry, Employees, Phone empty because the prospect has none |
| Account 4 (same-name account), 08:52 UTC | Still 1 account "Vega Marine Works" (created by hand first). It was updated and got 1 note. No duplicate |
| Task 5 (Due In empty), 08:42 UTC | Task "Follow up after reply" created, Not Started, Normal, linked to contact Liam Ortega, Due Date empty. Contact created with 1 note |
| Note title | "Saleshandy Reply Received On Sequence Email". Lines: Sequence Name, Sequence (link), Step, Sender Email, Prospect Email, Prospect Name, User |
| Gmail address | Not asked yet |

Test data left behind: Zoho lead Devan Anand, account Tanaka Robotics Works, account Vega Marine Works, contact Liam Ortega with its task. Saleshandy prospects `dharmesh+zoho-v1` to `-v5`. The Reply trigger on `notemailsentzoho` is still ON with the Task action.

## Stage 3: spec (2026-10-29)

Files, all new: `tests/zoho/reply-received.spec.ts`, `src/flows/saleshandy-to-zoho.ts`, `src/pages/zoho/zoho-crm.page.ts`, `test-data/zoho/reply-received.csv` (33 prospects, new names, the name pool was enough). The Email Sent session reuses the page object and flow and sends changes instead of editing them.
Written: Contact 1 and 5, Lead 1, 4 and 5, Account 1. Not written yet: rows that need a Zoho record first (Contact 2, 3, 4, 6, Lead 2, 3, Account 2, 3, 4, Deal 2 to 5, Task 2, Combined 4), Contact 7 (clears a mapping, restore it in a finally), Trigger 2, Deal 1 and 6 (deal name not seen), Task 1, 3, 4, 5, Combined 1 to 3, Real reply (needs `ZOHO_REPLY_GMAIL`).
Run: `npm run test:zoho-reply-received -- -g "Lead: 1"`. Zoho is read in a headed browser on a virtual display (`xvfb-run`) with the profile `auth/mcp-zoho-not-email-sent-profile`. Close any MCP Zoho window first. Use `KEEP_TEST_DATA=1` to rerun single rows without replacing their prospects.
Every run must set `TEST_DATA_ONLY=zoho/reply-received`, because the spec name matches the `reply-received` CSVs of HubSpot, Pipedrive and Salesforce.

First spec run (Lead 1, 2026-10-29 ~15:40): the Saleshandy steps passed (trigger, prospect, Send now, Mark as replied). The Zoho read failed because the profile `auth/mcp-zoho-not-email-sent-profile` showed "Verify your identity" (password or OTP). The same profile read Zoho fine about 1 hour earlier. QA must sign in once in that profile (open it through the `playwright-zoho-not-email-sent` MCP window). Not known yet how long a Zoho login lasts.

## Zoho login fix (2026-10-29, Claude)

Cause: Zoho shows "Verify your identity" (password, not OTP) on the saved profile, at the start and later in a run. The Zoho test script does not load `.env`, so `ZOHO_PASSWORD` was empty. Fix: `ZohoCrmPage.open()` in `src/pages/zoho/zoho-crm.page.ts`. Every Zoho page load goes through it. It loads `.env`, types the password and reloads the page, or stops with a clear message. QA does not need to sign in.

Rerun gotcha: a row creates its prospect in Saleshandy. A rerun with `KEEP_TEST_DATA=1` reuses the same row and Saleshandy answers 400 "Prospect with this email already exists in your Saleshandy account". Rerun without `KEEP_TEST_DATA` (the run is limited to this CSV by `TEST_DATA_ONLY`) so the row gets a new prospect.

Checked: `Lead: 1` passes end to end (1.9 min). The two `tsc` errors (page object line 32, spec line 48) are older and still open.

## Stage 3 spec complete, not run (2026-10-29, Claude)

`tests/zoho/reply-received.spec.ts` now has all 34 rows (one test per row, every CSV scenario used once). Nothing in this batch was run: a seven-row run was stopped by the low-memory guard (Trigger 2 and Task 1 hit the 8 min sort hang that the sort fix in `zoho-crm.page.ts` now covers; Task 3, 4, 5 found no contact in 90 s, cause not found).

Changes: Deal and Task rows find the run's record as the first new id (`crm.ids` before, `crm.waitForNewRecord` after), because a deal or task has no email to search. `crm.waitForNotes` waits for the note count. Hand-made records: `createContact`, `createLead`, `createDeal`, `setDealStage` (new, forms never seen, expect to heal). Second reply: `replyAgain` in `src/flows/saleshandy-to-zoho.ts`. Real reply: `waitForReplied` added to `sequence.page.ts`; the row skips unless `ZOHO_REPLY_GMAIL` is set, then waits up to 20 min for QA to reply from Gmail. Contact 7 is last and restores the Contact Fields mapping in `finally`.

Next: run a few rows at a time when memory is free (`npm run test:zoho-reply-received -- -g "<row>"`, no `KEEP_TEST_DATA`), starting with Contact 3 and Deal 1, and heal what fails. Open: why Task 3, 4, 5 found no contact.
