# Salesforce Link is Clicked in Saleshandy: progress

## Resume here (2026-11-04)

- Mode: regression, staging. Ticket AL-4136 (parent AL-4131).
- Account: `sflinkclicked` in `src/config/accounts.ts` = dharmesh+zohointegration@saleshandy.com (former Zoho account, QA connected Salesforce). Sessions: `auth/saleshandy-sflinkclicked-chromium.json` (QA login 2026-11-04), `auth/salesforce-sflinkclicked-chromium.json` (copy of sfreplyreceived). No MCP entries for it. Reads use a raw Playwright script with the saved session.
- Field mapping set and read back, 5 of 5 passed (`tests/setup/salesforce-field-mapping.spec.ts`, `SETUP_ACCOUNT=sflinkclicked`).
- Seen on staging 2026-11-04: all triggers off at the start. The Select box is disabled until the trigger toggle is on. Link is Clicked offers the 10 activities. Extra Configuration only for Create a Opportunity (Closing date while creating, Opportunity Stage), Update a Opportunity (while updating) and Record(log) an Email Activity (Select Object). The other 7 have none. Nothing was saved.
- Cases: 34 rows, approved by QA 2026-11-04, saved in `test-cases/salesforce/link-clicked.md`. The no-slop pass is done.
- 2026-11-04 later: written, typechecked, nothing run yet: `tests/setup/salesforce-link-clicked-sequence.spec.ts` (npm-less, `SETUP_SEQUENCE=1`, `SF_LC_SENDER`), `src/flows/salesforce-link-clicked.ts`, `tests/salesforce/link-clicked.spec.ts` (34 tests, needs `SF_LC_SEQUENCE_ID`), `test-data/salesforce/link-clicked.csv` (31 prospects, unique emails, gitignored), new `enableAlso()` in `src/pages/saleshandy/salesforce-email-sent.page.ts`.
- Sequence "Salesforce Link Clicked Regression" = id 197704 on sflinkclicked. Setup spec passed 2026-11-04: steps 1 and 2 (step 1 has two links), Track link clicks on, Track email opens off, ACTIVE. The earlier "Custom Domain Required" block is gone: cd1.shengage02.com is already on the account (Default, 18 email accounts).
- 2026-11-04 17:50 (superseded, kept for history): sender looked unavailable. Wrong reading: the Add dialog was empty ("No email account available") because the sequence already holds 12 Gmail senders (Rita 2, 3, 6 and more, 600 a day, each 1/50). Settings > Email Accounts on the sequence shows them. No mailbox needs to be connected. Setup spec with SF_LC_SENDER=Ritaellis1988+2@gmail.com sees it listed and only activates.
- Incident 2026-11-04 17:38: a throwaway spec ran without KEEP_TEST_DATA=1 and global setup replaced every row in every CSV under test-data/. Both peer sessions were told. Same lesson as setup-spec-refreshes-all-csvs.

## Run 1 (2026-11-04, stopped by QA at test 26 of 34)

- Command (from automation/): `SF_LC_SEQUENCE_ID=197704 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/salesforce/link-clicked.spec.ts --project=chromium --workers=1 --reporter=list`. About 2.3 min a test. ALWAYS KEEP_TEST_DATA=1, also for setup specs and throwaway specs.
- Result: 19 passed, 7 failed, 8 not run (rows 27 to 34). No product failure seen yet. Sender interval and limits not checked, sends were not slowed by them.
- Passed: Trigger behavior 1, 2, 7. Create a Lead 1, 2, 3. Update a Lead 1, 2. Create a Contact 1, 2. Update a Contact 1, 2. Create a Account 1, 3. Update a Account 1, 2. Create a Opportunity 1, 2. Update a Opportunity 1.
- Failed, script or machine causes, not product:
  - Trigger behavior 3, 4, 5, 6: `net::ERR_NAME_NOT_RESOLVED` / `ERR_NETWORK_CHANGED` on pyxis.lifeisgoodforlearner.com and "Salesforce login not finished: fetch failed". Network on the machine. Rerun.
  - Create a Account 2 (Account named like the prospect exists): 240 s timeout. The Salesforce Save button of the hand-made Account stayed disabled (`button[name=SaveEdit] aria-disabled`). Cause not known. Screenshot in `reports/test-results/salesforce-link-clicked-Li-28f0c-ed-like-the-prospect-exists-chromium/`.
  - Create a Opportunity 3 and Update a Opportunity 2 (Closing date 0 Days in the modal): fail after about 30 s, "Extra Configuration" dialog not visible within 20 s. Opportunity row 1 passes, so the dialog path works. Cause not known. Folders `salesforce-link-clicked-Li-2c2df-...` and `...-e9139-...` in `reports/test-results/`.
- Incident 2026-11-04 17:38: all CSVs in test-data/ were refreshed by a throwaway spec run without KEEP_TEST_DATA=1. Both peer sessions (Reply Received, Email Opened) were messaged. link-clicked.csv has new people; prospects from before the refresh are gone from it.
- Next: look at the screenshots for the 3 script failures and fix the script; rerun only the 7 failed rows and rows 27 to 34 with KEEP_TEST_DATA=1; note any product failure here, no waiting; QA reviews report.html after the task.

## Run 2 (2026-11-04, 15 rows: the 7 failed and the 8 unrun)

- Result: 14 passed, 1 failed, 34 min. Overall with run 1: 33 of 34 passed, 1 failed.
- Now pass: Trigger behavior 3, 4, 5, 6 (run 1 failures were network), Create a Opportunity 3, Update a Opportunity 2 (Extra Configuration dialog opened this time), Attach Note 1 to 5, Record(log) an Email Activity 1 to 3.
- Failed: Create a Account in Salesforce > 2 (an Account named like the prospect exists). `Logs status` expected Success, got Error. The Logs entry (Nov 4, 7:10 PM) shows Error with no duration. Salesforce > Accounts search for the prospect name "Alp Ozkan" shows TWO Accounts with that name and the same phone, owner ChintanS. Run 1 of this row timed out with the Save button disabled, so that run may have left one of them. Not proven. The Logs error text was not read (only the list row was captured).
- Rerun 1 of this row (same prospect Alp Ozkan) failed in the script: "Done" button never showed because the email was already in Saleshandy, and the step made a third Account named Alp Ozkan. Test data problem, not a product failure.
- Used rows of test-data/salesforce/link-clicked.csv replaced (31 rows, only that CSV; backup in the 2026-11-04 session scratchpad). Row now Hassan Gamal.
- Rerun 2 with the fresh prospect: PASSED (3.8 min, one network retry on page load). Overall: 34 of 34 passed at least once, no single full run.
- Open, not proven: run 2 got Logs status Error while Salesforce had 2 Accounts named Alp Ozkan. With one Account (fresh prospect) the row passes. Whether the product errors when two Accounts match the name is not tested. 3 stale Accounts named Alp Ozkan remain in Salesforce, not deleted.
- Product failures found: none. Sender interval and limits never checked. Not committed.

## QA decision 2026-11-04

- Staging APPROVED by QA (34 of 34 passed at least once over run 1, run 2 and two rereruns). Not production approved: no production smoke exists yet.
- Next: production smoke cases (fixed tickets only), then QA "looks good", then the smoke script. Nothing committed yet.

## Production smoke (2026-11-04)

- QA "looks good" 2026-11-04: 11 checks, 10 sends, one click on link 1 each, 90 s after the send. Cases: `notes/production-testing/24-salesforce-link-clicked.md`, README row 24.
- QA decisions: runs ALONE on `emailopenedprod`, after the Reply Received and Email Opened pair (a click counts as an open). Sequence "Salesforce Link Clicked Smoke <date>", one step, two links, Track link clicks on, opens off. Staging sequence 197704 and `sflinkclicked` stay staging only.
- Written, typechecked, listed, NOT run: `tests/salesforce/link-clicked-smoke.spec.ts`, `tests/setup/salesforce-link-clicked-smoke-sequence.spec.ts`, `scripts/make-salesforce-link-clicked-smoke-data.ts`, `scripts/run-salesforce-link-clicked-smoke.sh`, `npm run smoke:salesforce-link-clicked`. `src/flows/salesforce-link-clicked.ts` now reads `CLICK_AFTER_MS` and `CLICK_COUNT_TIMEOUT_MS` (staging defaults unchanged).
- Not run on production by Claude (smoke rule). The workflow may not be published on production yet: QA confirms before the run. The setup spec sender and sequence-list code follows the staging setup of 2026-11-04 and was never run on production.
- Not committed.
