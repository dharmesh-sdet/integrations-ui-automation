# Salesforce Prospect is Unsubscribed: progress

## 2026-11-05
- QA approved 38 cases (looks good). Saved: `test-cases/salesforce/prospect-unsubscribed.md`. Mode: regression, staging.
- QA rules: never open the Logs tab (check Salesforce and the Prospects tab only). Unsubscribe both ways: link for most rows, Mark as Unsubscribe in trigger row 3. An unsubscribed prospect cannot be added to a sequence or moved to step 2, so unsubscribe last.
- Account (QA 2026-11-05): reuse `sflinkclicked` (dharmesh+zohointegration), already in `src/config/accounts.ts`, Salesforce connected, field mapping set, sessions `auth/saleshandy-sflinkclicked-chromium.json` and `auth/salesforce-sflinkclicked-chromium.json`. No new account. Turn the other triggers off before each run. Sequence (QA 2026-11-05): reuse 197704 "Salesforce Link Clicked Regression" (2 steps, step 1 has two links). Unsubscribe setting changed from Text to "Unsubscribe as Link" and saved 2026-11-05, read back after reload. Step 1 subject: "Quick question about your outreach". No setup spec needed.
- Next: explore the trigger dropdown and Extra Configuration on staging, add the account to config, hand-write `tests/salesforce/prospect-unsubscribed.spec.ts` and the CSV, run once, rerun failed rows with KEEP_TEST_DATA=1.
- Open: Email Opt Out field (QA asks the developer). Staging wait for the link (93 s used, unverified).

## Run result 2026-11-05 (staging, sflinkclicked, sequence 197704)
- Cases cut to 32 rows (QA). Script runs 30. Trigger rows 5 and 9 are manual (no script). Spec `tests/salesforce/prospect-unsubscribed.spec.ts`, data `test-data/salesforce/prospect-unsubscribed.csv` (29 prospects), `npm run test:sf-prospect-unsubscribed`. Never open Logs (QA).
- Three runs, not one full run: run1 (rows 1 to 26, stopped by Claude without QA's OK), run2 (9 rows), run3 (3 rows). Final: 30 of 30 passed at least once.
- Script failures fixed: Send now matched by name only (now also email); 0 Days rows did not open the dialog when the activity was already selected (reset to Create a Lead first); one "no triggers after 3 loads" page flake.
- Trigger row 2 first run: prospect showed Unsubscribed, no Lead in 3 min (and none 2 h later). Passed on rerun with a new email. Cause unknown, one missed event; Logs not read. Logged, not filed.
- NOT VALID: Create a Opportunity 3 (empty Extra Configuration). Create a Opportunity 1 had already saved Prospecting and 7 Days on this account; the Opportunity got Close Date today + 7, not today + 1. Needs an account never saved for Create a Opportunity, or QA by hand.
- Open for QA: Attach Note 2 (Create a Lead + Note) created the Lead but the Lead page shows no Notes list; QA to check the Lead arjun.deshmukh30@mailinator.com. Attach Note 1 (Contact) has a Note titled "prospect-unsubscribed", body not read.
- Proposed rows (3, 4, 7, 8, 10 of Trigger behavior, Attach Note 2) record annotations only.

## STAGING APPROVED (QA, 2026-11-05)
QA approved staging. 30 of 30 automated rows passed at least once (29 valid, Create a Opportunity 3 not valid on this account). Not committed. Production smoke not started (QA says when). Jira comment and sheet row not written.

## Production smoke built (QA looks good, 2026-11-05)
- Note `notes/production-testing/26-salesforce-prospect-unsubscribed.md` saved, README row 26 added. 9 checks, 8 sends, every check uses the real link (QA default). Only fixed ticket AL-4168 (check 9). No Logs. Record(log) left out.
- Written, typechecked (only old errors in jira/web), NOT run: `tests/salesforce/prospect-unsubscribed-smoke.spec.ts`, `tests/setup/salesforce-prospect-unsubscribed-smoke-sequence.spec.ts` (2 steps, saves "Unsubscribe as Link"), `scripts/make-salesforce-prospect-unsubscribed-smoke-data.ts`, `scripts/run-salesforce-prospect-unsubscribed-smoke.sh`, `package.json` scripts `smoke:salesforce-prospect-unsubscribed` and `smoke:salesforce-bounced-unsubscribed-pair`.
- Next (QA 2026-11-05): run it in parallel with Email is Bounced (note 25) through `npm run smoke:salesforce-bounced-unsubscribed-pair`. KEEP_OTHER_TRIGGERS=1 goes to both runs. Risk: both runs unmap and map Closing Date on the Opportunity mapping, so an Opportunity failure may be a clash.
- Not committed. Jira comment (AL-4137) and sheet row not written.

## Production smoke 2026-11-05 (pair run with Email is Bounced, emailopenedprod, sequence 992152)
- Pair run 17:21: 10 passed, 1 failed (31.9 min). Failed: Check 1 (Create a Lead). The prospect showed Unsubscribed on the Prospects tab, but no Lead in Salesforce within 180 s. Cause not known. Logs not read (QA rule).
- First rerun failed before any send: script reused the same prospect (CSV not refreshed, KEEP_TEST_DATA=1), Saleshandy answered 400 on create. Data cause. Second rerun with a new prospect (run 3, Niamh O'Connor): Check 1 passed (3.6 min).
- Result: 9 of 9 checks passed at least once, no single full run. One missed Lead on the first attempt, not repeated. Logged for QA, not filed. Same shape as staging trigger row 2 (one missed event).
- Possible clash with the Email is Bounced run (trigger saves on the same page) not proven. Checks 2 to 9 passed beside it.
- Not committed. Jira comment (AL-4137) and sheet row not written (QA approval pending).

- QA 2026-11-05: RELEASED and LIVE. Sheet row 13 written (E Released, F "5 Nov: Production smoke passed. Live."). Jira comment draft AL-4137 in jira/drafts, QA sends. Committed 9f280fc.
