# Pipedrive Email Is Opened: progress

Ticket AL-4174 (QA, 2026-10-27). Staging regression, account `gpipedrive`.

## 2026-10-27

- Cases saved: `test-cases/pipedrive/email-opened.md` (27 rows), built from `drafts/revised/email-opened.md`, Ticket column AL-4174. Waiting for QA's "looks good".
- Next: QA OK, then walkthrough (sequence "Pipedrive Email Opened QA", Track email opens on, Track link clicks off, one Kartik mailbox not used by 197336, 197337 or the Reply Received sequence), CSV, hand-written spec reusing `src/flows/saleshandy-to-pipedrive.ts` and the Pipedrive page objects.
- Open: which mailbox is free. Whether an open registers in Mailinator without a tracking domain. Rows marked (proposed, unconfirmed) stay unconfirmed until run.

## 2026-10-27 (later): QA "looks good", scripts written, NOT run

- Written, nothing run, no typecheck, no sequence made, no data generated (QA: do not run or set up yet):
  `tests/pipedrive/email-opened.spec.ts` (26 tests: 25 rows plus the skipped Trigger behavior 2), `tests/setup/pipedrive-email-opened-sequence.spec.ts`, `scripts/make-pipedrive-email-opened-data.ts`.
- Trigger behavior 2 (Track email opens off) is skipped in the spec: it needs a second sequence.
- Trigger behavior 4 uses `pipedriveIntegration.disable(TRIGGER)`: not checked that the Pipedrive page object has it.
- Sender in the setup spec is Kartik 8 (`2kartiktest+8@gmail.com`), unconfirmed. Override with PD_OPEN_SENDER.
- The "Enable Anyway" dialog for Track email opens is assumed to match link tracking.
- Next, when QA agrees: `node scripts/make-pipedrive-email-opened-data.ts`, then the setup spec, then PD_OPEN_SEQUENCE_ID and a first run of failed or unrun rows only.

## 2026-10-28: first run attempt, blocked before any test

- Typecheck clean. `node scripts/make-pipedrive-email-opened-data.ts` wrote `test-data/pipedrive/email-opened.csv` (26 rows).
- Setup spec: global setup refreshed every CSV and hit "Could not find a fresh name after 600 tries" (name pool used up). Fix: run with `KEEP_TEST_DATA=1`. Use `REPORTS_DIR=reports/emailopened-<x>` and `--output=test-results-emailopened-<x>` so peer sessions are not hit.
- Sequence "Pipedrive Email Opened QA" now exists on gpipedrive with steps 1 and 2 saved (a peer's subject-clearing fix in `sequence-builder.page.ts`, 2026-10-28 10:27, made step saving work). Sender and activation not done.
- BLOCKER: Settings > Safety Settings > Track email opens opens "Custom Domain Required" (Skip Tracking for Now / Set Up Custom Domain), not "Enable Anyway". gpipedrive has no Custom Tracking Domain (Settings > Custom Tracking Domain is empty). The spec's assumption (line 18 above) was wrong. Matches `knowledge-base/product/saleshandy.md` line 47.
- No test case run yet. Waiting for QA: which tracking domain to add.

## 2026-10-28: run started (background)

- QA answers: tracking domain cd1.shengage02.com added on gpipedrive (Settings > Custom Tracking Domain, Default, 10 Email Accounts). Sender is dharmesh+pipedrive@saleshandy.com (PD_OPEN_SENDER).
- Setup spec passed: sequence "Pipedrive Email Opened QA" id 197378, Track email opens on, Track link clicks off, sender added, active.
- Run: PD_OPEN_SEQUENCE_ID=197378 KEEP_TEST_DATA=1, 1 worker, output test-results-emailopened, reports/emailopened. One line per test below, written as each test ends (reporter in the session scratchpad).

### Results (one line per test)
- 05:16:36 PASS | Trigger behavior > 1: trigger off, enable it with Create a Person and Save | 13s
- 05:16:36 SKIP | Trigger behavior > 2: Track email opens off in the sequence, Create a Person selected | 0s | skip: Needs a second sequence with Track email opens off (a sender and a setup spec of its own). Not built yet.
- 05:19:16 FAIL | Trigger behavior > 3: second open of the same email (proposed, unconfirmed) | 157s | Logs (latest entry): Email is Opened in Saleshandy 6ae185607dccc2ef45d9438b Oct 28, 2026, 10:47 AM 3.7s Success | Error: Person voahangy.razafindrakoto@mailinator.com not found once in Pipedrive (gave up after 90 seconds) | persons with voahangy.razafindrakoto@mailinator.com
- 05:20:49 FAIL | Trigger behavior > 4: only "Reply is Received in Saleshandy" on, with Create a Person | 90s | Error: persons with ben.kamit@mailinator.com | expect(received).toHaveLength(expected)
- 05:22:02 PASS | Create a Person > 1: prospect not in Pipedrive | 73s | activities on the person: 1; activity note: Sequence Name: Pipedrive Email Opened QA
Sequence: https://my.saleshandy.com/sequence/197378/steps
Step: 1
Sender Email: dharmesh+pipedrive@saleshandy.com
Prospect Email: azamat.orozov@mailinator.com
Prospect Name: Azamat Orozov
User: dharmesh+gpipedrive@saleshandy.com
- 05:23:17 PASS | Create a Person > 2: person exists with an old value in a mapped field | 74s | activities on the person: 1; person details after the update: {}
- 05:24:28 PASS | Create a Lead > 1: prospect not in Pipedrive | 72s | leads on the person: 1
- 05:25:42 PASS | Create a Lead > 2: person exists | 74s
- 05:31:45 FAIL (timeout) | Create a Deal > 1: prospect not in Pipedrive | 360s | Test timeout of 360000ms exceeded.
- 05:31:59 FAIL | Create a Deal > 2: person has 1 deal | 13s | Error: Expected 1 person with fatmata.bangura@mailinator.com after saving, found 0
- 05:34:42 PASS | Create a Deal > 3: person exists, email already opened once (second open) | 163s
- 05:36:17 PASS | Update a Person > 1: person exists with an old value in a mapped field | 94s | activities on the person: 1; activity note: Sequence Name: Pipedrive Email Opened QA
Sequence: https://my.saleshandy.com/sequence/197378/steps
Step: 1
Sender Email: dharmesh+pipedrive@saleshandy.com
Prospect Email: celeste.neto@mailinator.com
Prospect Name: Celeste Neto
User: dharmesh+gpipedrive@saleshandy.com; person details after the update: {"First name":"Celeste","Last name":"Neto","Job Title":"Talent Acquisition Partner"}
- 05:38:14 PASS | Update a Person > 2: prospect not in Pipedrive (known B1, Error) | 117s | Logs row: Email is Opened in Saleshandy 6ae18a057fa9f49a15f0ed4f Oct 28, 2026, 11:07 AM 2.1s Success
- 05:40:05 PASS | Update a Deal > 1: person has 2 deals | 111s
- 05:40:21 FAIL | Update a Deal > 2: person exists with no deal | 12s | Error: Expected 1 person with nelson.macamo@mailinator.com after saving, found 0
- 05:42:13 PASS | Update a Deal > 3: prospect not in Pipedrive (known B2, Error) | 110s | Logs row: Email is Opened in Saleshandy 6ae18af8a2b8d7564ec6ea5a Oct 28, 2026, 11:11 AM Error
- 05:44:12 PASS | Delete Deal > 1: person has 2 deals | 119s
- 05:46:16 PASS | Delete Deal > 2: person exists with no deal | 124s | Logs row: Email is Opened in Saleshandy 6ae18beb5b7ed814bc6d1a07 Oct 28, 2026, 11:15 AM 3.7s Success
- 05:47:38 PASS | Delete Person > 1: person exists | 82s
- 05:49:11 PASS | Delete Person > 2: prospect not in Pipedrive | 93s
- 05:50:20 PASS | Create Organization > 1: prospect has a company, no organization with that name | 70s
- 05:51:47 PASS | Create Organization > 2: an organization with the same name exists | 86s
- 05:54:08 PASS | Update Organization > 1: an organization with the exact company name exists | 142s | Logs row: Email is Opened in Saleshandy 6ae18dc2eb839032d7f57174 Oct 28, 2026, 11:23 AM 3.4s Success
- 05:56:02 PASS | Update Organization > 2: no organization with that exact name | 114s
- 05:57:31 PASS | Delete Organization > 1: an organization with the exact company name exists | 89s
- 05:58:58 PASS | Combined actions > 1: Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive | 87s
- 06:02:06 FAIL | Combined actions > 2: Create a Person and Update a Person both selected, person exists | 181s | Logs (latest entry): Email is Opened in Saleshandy 6ae18f6feb839032d7f6eeac Oct 28, 2026, 11:30 AM RUNNING | Error: Fewer than 2 activities on the person (gave up after 90 seconds) | expect(received).toBeGreaterThanOrEqual(expected)

### Run 1 final (2026-10-28, ended 06:02 UTC, 45.7 min)

- 27 tests ran: 20 passed, 6 failed, 1 skipped (Trigger behavior 2, needs a second sequence). Sequence 197378, sender dharmesh+pipedrive@saleshandy.com.
- Failed, cause NOT found yet:
  - Trigger behavior 3 (second open): Logs Success, person not in Pipedrive after 90 s.
  - Trigger behavior 4 (only Reply Received on): a person was created, none expected.
  - Create a Deal 1: test timeout 360 s. Create a Deal 2 and Update a Deal 2: "Expected 1 person ... after saving, found 0", fail in 12-13 s while making the person by hand, before any email.
  - Combined actions 2: Logs entry still RUNNING, fewer than 2 activities after 90 s.
- Next: look at the traces of the 6 failed rows, fix script causes, rerun only those rows with KEEP_TEST_DATA=1.

### Rerun 1 (2026-10-28): Create a Deal 2 and Update a Deal 2 only

- Cause found for these two: `people.page.ts` read at most 100 rows of the People list; Pipedrive showed 171 (198 later) and a new person fell outside the first 100. Scrolling reads all 198 of 198. Fix: `target = total` in `rows()`. The list was sorted by Name in the failure screenshot. New data for the two rows (used list trimmed to them, backup in the session scratchpad).
- 06:13:32 FAIL | Create a Deal > 2: person has 1 deal | 22s | Error: The People list shows 199 people but only 187 were read; the reader would miss records
- 06:13:55 FAIL | Update a Deal > 2: person exists with no deal | 22s | Error: The People list shows 201 people but only 189 were read; the reader would miss records
- Rerun 1 failed again: reader got 187 of 199 and 189 of 201 people (stopped after 6 empty scrolls). Raised to 10 empty scrolls and 100 steps in `rows()`. Rerun 2 with new data for the two rows.
- 06:14:51 FAIL | Create a Deal > 2: person has 1 deal | 26s | Error: The People list shows 202 people but only 190 were read; the reader would miss records
- 06:15:18 FAIL | Update a Deal > 2: person exists with no deal | 26s | Error: The People list shows 203 people but only 191 were read; the reader would miss records
- Rerun 2 failed too: 190 of 202 and 191 of 203 read. `rows()` alone reads 204 of 204 (3 tries, 8-10 s), so the short read happens only right after the person is created. Fix: `create()` in `people.page.ts` now reads the list again (6 tries, 5 s apart) before it fails. Rerun 3 with new data.
- 06:20:03 FAIL | Create a Deal > 2: person has 1 deal | 149s | Error: The People list shows 205 people but only 193 were read; the reader would miss records (read 6 times after saving afi.dossou@mailinator.com)
- 06:22:33 FAIL | Update a Deal > 2: person exists with no deal | 147s | Error: The People list shows 208 people but only 196 were read; the reader would miss records (read 6 times after saving maksim.kavalenka@mailinator.com)
- Rerun 3 failed too (193 of 205, 196 of 208 after 6 reads). Cause found by a diagnostic: the page that just saved a person missed a block of 12 people (names D to M) while a fresh page read all 210. The list window is about 49 rows (about 1500 px) and the reader scrolled 1500 px a step, so windows did not overlap. Fix: scroll 600 px a step, up to 150 steps (`rows()` in `people.page.ts`); the retry loop in `create()` was removed. Rerun 4 with new data.
- 06:26:57 FAIL | Create a Deal > 2: person has 1 deal | 15s | Error: Expected 1 person with boubacar.keita@mailinator.com after saving, found 0
- 06:29:11 PASS | Update a Deal > 2: person exists with no deal | 134s | Logs row: Email is Opened in Saleshandy 6ae195fcc01fd209cc37c6ce Oct 28, 2026, 11:58 AM 3.1s Success
- Rerun 4 (600 px scroll step): Update a Deal 2 PASSED. Create a Deal 2 failed with "Expected 1 person with boubacar.keita@mailinator.com after saving, found 0": a complete read (211 people, no incomplete-list error) that did not contain the new person. Cause not known. Rerun 5 of Create a Deal 2 alone with a new person.
- 06:31:29 PASS | Create a Deal > 2: person has 1 deal | 114s
- Rerun 5: Create a Deal 2 PASSED (114 s). The one failure in rerun 4 ("found 0 after saving") did not come back; cause not known, treat as a one-off and watch for it.
- Status after reruns: 22 passed, 1 skipped, 4 failed with cause not found: Trigger behavior 3, Trigger behavior 4, Create a Deal 1, Combined actions 2.

### Debug of the 4 failed rows (2026-10-28)

- Trigger behavior 4 (only Reply Received on): SCRIPT. The row turned Email Opened off with `disable()` but never clicked Save, so the earlier setting stayed on. Fix in the spec: save after `disable()`.
- Create a Deal 1: SCRIPT. The Extra Configuration helper pressed Escape when the stage list opened empty, which closed the dialog; the next click had no timeout and waited 6 min. Fix in `pipedrive-integration.page.ts`: click with timeout, close the list by clicking the dialog heading. Underlying "stage list opens empty" seen on 2026-10-26 and 2026-10-28 is NOT understood.
- Trigger behavior 3 and Combined actions 2: not yet classified. Rerun with the fixed People reader and new data.
- 06:48:46 PASS | Trigger behavior > 3: second open of the same email (proposed, unconfirmed) | 131s | activities on the person: 1; activities on the person: 2
- 06:50:29 PASS | Trigger behavior > 4: only "Reply is Received in Saleshandy" on, with Create a Person | 102s
- 06:52:05 PASS | Create a Deal > 1: prospect not in Pipedrive | 97s
- 06:53:43 PASS | Combined actions > 2: Create a Person and Update a Person both selected, person exists | 98s | activities on the person: 2
- Rerun 6 (2026-10-28, new data, fixed reader, spec and helper): Trigger behavior 3, Trigger behavior 4, Create a Deal 1 and Combined actions 2 all PASSED (131, 102, 97 and 98 s).
- Final state: 26 passed, 1 skipped (Trigger behavior 2, needs a second sequence), 0 failed. All 6 first-run failures were script issues: People reader (100-row cap, then 1500 px scroll skipping a block of rows): Create a Deal 2, Update a Deal 2 and, most likely, Trigger behavior 3; `disable()` without Save: Trigger behavior 4; Escape closing the dialog plus a click with no timeout: Create a Deal 1. Combined actions 2 passed on rerun with no change aimed at it: cause not proven (a run that showed RUNNING in Logs after 90 s, or the reader).
- No product issue confirmed. Not reproduced, so no ticket: the Create a Deal stage list opened empty right after the pipeline was picked (2026-10-26, 2026-10-28); a Combined actions run still RUNNING in Logs after 90 s once.

## 2026-10-28: production smoke written (note 13), not run

- Cases approved by QA: `notes/production-testing/13-pipedrive-email-opened.md` (9 checks, 9 sends, baseline, no fixed bug ticket, AL-4174 is the workflow ticket). README row 13 added. Create a Lead, Create a Deal and Create a Person are one row.
- Written, typecheck clean, NOT run (QA: write only; the Refold deploy issue blocks the workflow deploy to production): `tests/pipedrive/email-opened-smoke.spec.ts`, `tests/setup/pipedrive-email-opened-smoke-sequence.spec.ts`, `scripts/make-pipedrive-email-opened-smoke-data.ts`, `scripts/run-pipedrive-email-opened-smoke.sh`, script `npm run smoke:pipedrive-email-opened`. CSV `test-data/pipedrive/email-opened-smoke.csv` (gitignored).
- Open points for the QA run: the production account must have a custom tracking domain (link.saleshandy.com is noted in the README, not re-read), otherwise the setup spec fails on "Custom Domain Required". "Email Sent from Saleshandy" and "Link is Clicked in Saleshandy" must be off on `emailopenedprod`. Open timing (60 s, then 120 s) is copied from HubSpot notes, not seen on Pipedrive.
