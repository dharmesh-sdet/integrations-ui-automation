# Pipedrive: Prospect Outcome Updated, progress (saved 2026-10-26, end of day)

Spec `tests/pipedrive/prospect-outcome-updated.spec.ts` (34 tests: Setup + 33 rows). Cases: `test-cases/pipedrive/prospect-outcome-updated.md`. Sequence 197337 "Pipedrive Outcome Updated QA", account gpipedrive, logs in `reports/pd-outcome/run1..run8.log`.

## Latest result per row: 31 of 33 pass (32 of 34 tests with Setup)

- Passed (31): Trigger behavior 1, 2, 4, 5; Create a Person 1 to 3; Create a Lead 1 to 3; Create a Deal 1 to 3; Update a Person 1 to 3; Update a Deal 1 to 4; Delete Deal 1, 2; Delete Person 1, 2; Create Organization 1, 2; Update Organization 1 to 3; Delete Organization 1, 2. Setup also passed.
- Results come from several runs, not one full run.
- Weak passes: Trigger behavior 2 and 5 only record the result (observe), Trigger behavior 4 passes if nothing runs.
- Failing (2): Trigger behavior 3 (Create a Person, Extra Configuration skipped, outcome Not Now) and Trigger behavior 6 (Create Lead + Deal + Person, category Interested, prospect not in Pipedrive). Logs read 2026-10-27 (read-only, Saleshandy > Integrations > Pipedrive > Logs, `?tab=logs&page=N`; entries matched by time and outcome value, the Start step has no prospect data):
  - Row 3: the entry has only the first rule step, `rule_result: false`, no action. Run 2, 13:10 (6adf03f884fba224c21d6a12): the trigger still compared category Interested (saved by row 1) with the outcome Not Now. Run 4, 14:23 (6adf1524a5c6b2da66ee7c74): category Closed (left by the previous run) against Not Now. Row 2 at 13:08 (6adf0382757bd52d657fb621) did the same, Interested against Meeting Booked. An Extra Configuration saved once is not cleared, so "skipped" never happens after row 1. Cause is the row order or the product keeping the category (see the "Chip kept after Cancel" annotation); not decided.
  - Row 6, run 4, 14:28 (6adf164ab40fe7dbefe87342, Success, 4.9s; contains ugyen.gyeltshen@mailinator.com): the workflow did run. Steps: Create a lead (person_id 111, title is the email), Person - Create person (id 111, email correct, added 14:28:54 IST), Person - Update person skipped. No Create a Deal step in the entry. So the person exists and the lead was created; the "no person after 90 s" failure is not what the Logs show. Next: check person 111 in Pipedrive (lookup by email may be the script's problem, or search lag) and why no deal step ran.
  - Row 5 (run 2, 13:15, 6adf050e757bd52d658086ff): the rule compared ":Meeting Booked" (left from row 4) with Interested, so the category change for row 5 may not have been saved either.
- No row is confirmed as a product bug.

## Fixed

- Phone assertions read the Details block, but Pipedrive shows the phone in the Summary block as a `callto:` link. Added `people.phones()` (`src/pages/pipedrive/people.page.ts`); used in Create a Person 2, Update a Person 1 and 3.
- Emails tab lookup removed (32 prospects no longer fit the first page).
- afterEach cleanup removed (QA 2026-10-26: specs never delete records after a row).
- Create Organization 1 (found by QA): Pipedrive's organization Industry is a picklist (`organization-industry-list.md`, 20 values). The CSV held Saleshandy-style names (Work Management and others), so the organization was rejected (400, "industry with provided value does not exist"; same finding in `email-sent-progress.md`). Mapped Industry and Company Industry in `test-data/pipedrive/prospect-outcome-updated.csv`: Ecommerce to Retail, the other 18 values to "Technology, information and media". Company of Create Organization 1 is "TaskForce 141" (QA's choice, "Asana" already existed in Pipedrive). The row now has Thoko Mwale (thoko.mwale@mailinator.com) and passed in run 8.
- Contacts already in Saleshandy keep their old Industry; the mapping applies to new adds and the next full refresh.

## Seen, cause not proven

- Two persons with one email right after the script created one: Trigger behavior 5 and Update a Deal 4 (runs 2 and 3, and run 5 with the leftover Hassan Latheef from the run I stopped). Not repeated with new prospects. Likely a person made earlier by the Email Sent trigger; not proven. The Email Sent session reports the same symptom (Logs 6adedb4a1b36e7e6b5c22f92 and 6adedb4a5c82ec8cc5b405b6); not confirmed as a product bug, not filed.
- Create a Lead 2 failed once, passed on rerun with new data.

## Data state

- Gitignored CSVs: `test-data/pipedrive/prospect-outcome-updated.csv` (32 rows, mapped), `.used.txt` (9 emails), `.setup.json`. Backups in scratchpad: `outcome.csv.bak`, `outcome.csv.bak2`, `outcome.used.bak`, `outcome.used.bak2`, `outcome.setup.bak2` and `prospect-outcome-updated.regenerated.csv`.
- Pipedrive keeps what runs created (no cleanup), including organization "TaskForce 141" and persons from the rows.

## Mistakes (mine, today)

- Two throwaway specs run without `TEST_DATA_ONLY` or `KEEP_TEST_DATA=1` regenerated every CSV and emptied every `.used.txt` under `test-data/` (14:06, 14:07). Only the outcome CSV was rebuilt (from Saleshandy contacts of sequence 197337). The other workflows' data was disclosed to QA and the Email Sent session. A guard is proposed, not applied (learn-from-mistake, needs QA's OK).
- Runs 1 to 3 did not set `KEEP_OTHER_TRIGGERS=1`, so they may have switched other workflows' triggers off.
- I stopped run 4 mid-row, which left Hassan Latheef in Pipedrive.

## Next (tomorrow)

1. Trigger behavior 3 and 6: read the Logs entry for each (and the `Chip kept after Cancel` annotation of Trigger behavior 2) to see whether the workflow ran and what it reported. Read-only.
2. Decide with QA whether to apply the industry mapping check to the other workflows' CSVs that create organizations.
3. Learn-from-mistake entry for the `TEST_DATA_ONLY` guard: propose, apply after QA's OK.
4. If QA wants the double-person cause proven: check the Email Sent trigger state during Setup.
5. Commands: rerun one row with `KEEP_TEST_DATA=1 KEEP_OTHER_TRIGGERS=1 REPORTS_DIR=reports/pd-outcome npx playwright test tests/pipedrive/prospect-outcome-updated.spec.ts --project=chromium --workers=1 -g "<Row title>:"`. To swap one row's person: put its email alone in `.used.txt`, call `refreshUsed('pipedrive/prospect-outcome-updated.csv')` from `src/data/generate.ts`, restore `.used.txt`. Never run a spec without `KEEP_TEST_DATA=1` or `TEST_DATA_ONLY`.
6. No Jira writes without QA's approval.

## Run 9 (2026-10-27, rows 3 and 6 with new data)

- Swapped the persons: row 3 is Zarina Rahmonov, row 6 is Navalona Andrianaivo. Backups in scratchpad: `outcome.csv.bak3`, `outcome.used.bak3`, `outcome.setup.bak3`. Log: `reports/pd-outcome/run9.log`.
- Both failed (2 of 2). Row 3: persons 189 and 190 for zarina.rahmonov@mailinator.com. Row 6: persons 191 and 192 for navalona.andrianaivo@mailinator.com. The test expects 1.
- The People list scroll works (both persons were found). The failure is two persons per email, the same symptom as Trigger behavior 5 and Update a Deal 4. Cause not proven. Not filed.
- Row 3 created a person, so the "old saved category" cause from the earlier Logs does not explain this run.

## QA manual test (2026-10-27)

- QA tested Trigger behavior 3 and 6 by hand. Both worked. QA's view: the settings page showed old or cached data, and a hard refresh is needed before the trigger setting is current. Not proven; the Logs only show that the trigger held an old category at run time (runs 2 and 4).
- Final count: 33 rows. Automated: 31 pass, 2 fail (run 9 failed again: two persons per email). Manual: the 2 failed rows pass. Result with the manual tests: 33 of 33.
- Open: the two persons per email in run 9 (cause not proven, not filed). Weak passes: Trigger behavior 2 and 5 only record the result, Trigger behavior 4 passes if nothing runs. No row is confirmed as a product bug.
- Proposed, not applied: hard reload after saving the trigger and read the saved categories back (shared file `pipedrive-integration.page.ts`).

## Weak cases removed (2026-10-27, QA)

- QA asked to remove the three weak cases (Create a Person with the Extra Configuration skipped and outcome Meeting Booked; category Meeting Booked with outcome Meeting Booked; Update a Deal only with category Interested). Removed from `tests/pipedrive/prospect-outcome-updated.spec.ts` (and the unused `observe` helper) and from `test-cases/pipedrive/prospect-outcome-updated.md`. Row numbers 1, 3 and 6 of the first section are kept, because the CSV finds prospects by that number.
- Now 30 test cases. Script: 28 pass, 2 fail. With QA's manual test of the 2: 30 of 30. Spec lists 31 tests per browser project (Setup plus 30). Backups in scratchpad: `spec.bak4`, `cases.bak4`.
- The CSV still holds the three unused prospects; left as is.

## Production smoke (2026-10-27)

- Cases: `notes/production-testing/10-pipedrive-prospect-outcome-updated.md` (9 checks, QA "looks good", row 10 in the README table).
- Built, typecheck passes, 9 tests listed, NOT run (QA runs it on production): `tests/pipedrive/prospect-outcome-updated-smoke.spec.ts`, `scripts/run-pipedrive-outcome-updated-smoke.sh`, `scripts/make-pipedrive-outcome-updated-smoke-data.ts`, `npm run smoke:pipedrive-outcome-updated`.
- Reused: staging test bodies of the same activity, `sendEmail` and the other helpers of `src/flows/saleshandy-to-pipedrive.ts`, the Email Sent gate (`tests/setup/pipedrive-email-sent-prod-gate.spec.ts`) and the Email Sent sequence setup (now takes `SMOKE_SEQUENCE_NAME`).
- Gaps: Update Organization cannot read the mapped value (no reader in `organizations.page.ts`, same on staging), so row 7 checks no second organization plus the Logs row. The reload after a trigger save reads back the activities, not the categories.
- Before the first run QA: `npm run login:saleshandy -- emailopenedprod`, `npm run login:pipedrive -- emailopenedprod`, "Email Sent from Saleshandy" off on emailopenedprod.

## STATUS (QA, 2026-10-27): test cases and scripts are complete, deploy is blocked

- Done: staging cases (30 rows, `test-cases/pipedrive/prospect-outcome-updated.md`), staging spec (30 of 30 with QA's hand test of the 2 double-person rows), production smoke cases (`notes/production-testing/10-pipedrive-prospect-outcome-updated.md`, 9 checks, approved) and the production smoke script (see the section above).
- Blocked: an issue on the Refold side stops the workflow deploy to production (QA, 2026-10-27). The production smoke cannot run until the deploy happens. Nothing is pending on Claude.
- When the deploy is done: QA logs in headed (`npm run login:saleshandy -- emailopenedprod`, `npm run login:pipedrive -- emailopenedprod`), makes sure Email Sent is off, then runs `npm run smoke:pipedrive-outcome-updated`. Claude reads the report afterwards, then drafts the summary from `jira/templates/comments/04-production-smoke-summary.md` into `jira/drafts` (QA sends it).
- Open, unchanged: two persons per email on automated runs (cause not proven, not filed); Update Organization mapped value cannot be read; the smoke reload reads back activities, not categories.
