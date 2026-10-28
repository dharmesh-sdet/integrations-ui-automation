# Pipedrive Email is Bounced: progress

Staging, account gpipedrive, workflow v2, ticket AL-4183 (sub-task of AL-4170). Owner session: local-project-1b. Saved 2026-10-27.

## State

- Cases: `test-cases/pipedrive/email-bounced.md`, 37 rows, QA "looks good" 2026-10-27. Built from `00-overview.md` and `email-bounced.md` only (QA: do not use the Unsubscribed or other workflow files for the cases). Lint is clean.
- Spec: `tests/pipedrive/email-bounced.spec.ts`, 37 tests, one per row, written by hand. `SEQUENCE_ID` is `'197375'`. Run 2026-10-28: all 37 passed (21 in the first run, the other 16 after script fixes and reruns). Typecheck passes.
- Data: `scripts/make-pipedrive-email-bounced-data.ts` built `test-data/pipedrive/email-bounced.csv` (32 prospects, gitignored).
- Sequence setup: DONE 2026-10-28 (`tests/setup/pipedrive-email-bounced-sequence.spec.ts`, passed in 54s, run with `KEEP_TEST_DATA=1`). One step, sender `dharmesh+pipedrive@saleshandy.com` (QA's choice; the Email Opened session uses the same sender, so the daily send cap is shared).
- Sequence "Pipedrive Email Bounced QA" on gpipedrive: id 197375, step 1 added, sender added, activated.
- Page objects changed: `PipedriveLeadsPage.createForPerson` (new, never run, Add lead dialog seen only in a snapshot), `SaleshandySequencePage.markAsBounced` takes an optional email.

## QA answers, 2026-10-27

- Real bounces capped at 1 (Trigger behavior 5). Every Ticket cell is None. Workflow ticket AL-4183.
- Email Sent OFF while these rows run. Claude then changed the spec to `KEEP_OTHER_TRIGGERS=1` (other triggers left alone) because the Link Clicked session (local-project-f9, AL-4175) shares the trigger configuration. QA has not yet said whether this is OK. With it, only Trigger behavior 5 (the only row that sends) can start an Email Sent run.
- QA stopped Claude from running anything: "Do not run the script or start setting up the things."

## Setup run history (all on 2026-10-27, all failed)

1. The template picker stayed open after the template filled, so step 1 was not saved.
2. The sequences page did not load in 5 minutes (page.goto timeout).
3. The wait for an "Add Step" button on the empty tab failed. The empty tab shows an "Email" button, so the wait now matches `Email` or `Add Step`. Not run again.

## Mistake to review

Runs 1 and 2 had no `KEEP_TEST_DATA`, so the global setup replaced the rows of `test-data/hubspot/email-bounced.csv` and `test-data/pipedrive/email-bounced.csv`. The HubSpot file belongs to released work and its old rows are gone. Same mistake as `knowledge-base/lessons.md` (the entries on global-setup). QA has not yet answered whether to log it with `learn-from-mistake` and add a guard.

## Next (when QA says go)

1. Always run with `KEEP_TEST_DATA=1`.
2. Send two messages to the Link Clicked session (f9): one at the start of a run and one at its end.
3. Typecheck, run once to learn script errors, then rerun only failed or unrun rows with `-g "<describe> <n>:"`. QA runs the full script.
4. Look at the two letter-case rows (Create a Person 3, Update Organization 2) and the lead helper first, because they assert results not yet seen.

## Open (rows marked proposed, unconfirmed are recorded as annotations, not asserted)

- Trigger behavior 3 (paused sequence) and 5 (real bounce): result recorded.
- Trigger screen 3 (reopen shows saved values) and 4 (Save disabled with empty Pipeline and Stage): result recorded.
- Mark as bounced on a row that was never sent: assumed to work (HubSpot method), not confirmed on this account.

## Status: Staging approved by QA, 2026-10-28

QA marked Pipedrive Email Bounced as staging approved. No single clean full run was done: 21 rows passed in the first run, the other 16 passed in reruns after script fixes. Trigger behavior 2, Combined actions 2 and Create a Deal 1 failed once with no cause found and passed on rerun. Production smoke rows are not chosen yet.

## Run 2026-10-28 (all 37 passed)

First full run: 21 passed, 16 failed. All 16 were script or data causes, fixed in the spec and page objects:
- Create a Person 4: a data refresh gave the prospect a name; the spec now blanks both names.
- Organization rows (Create/Update/Delete Organization, Combined actions 3): pool company names already had organizations in Pipedrive; `useFreeCompany` takes a free name (compared without case). The pool in `src/data/generate.ts` had no free name left, so 24 companies were added.
- Update Organization 2: `idsByName` is case-sensitive; the assertion now checks the upper-case organization is the only one and none exists under the prospect's case.
- `markAsBounced`: the Emails tab lists 25 rows a page; it now reopens the tab and searches (Trigger behavior 3, Delete Organization 1, Combined actions 1).
- Trigger behavior 4: `KEEP_OTHER_TRIGGERS` left "Email is Bounced" on; the row now turns it off and saves.
- Trigger behavior 5: the data row has no company, so the real-bounce address was invalid; the spec gives it a pool company.
- Reruns reuse prospects already added to Saleshandy and fail in Create & Add Prospect; rerun with `REFRESH_USED_ONLY=1 TEST_DATA_ONLY=pipedrive/email-bounced` (not `KEEP_TEST_DATA`).

## Product failures

None found. Every failure had a script or data cause.

## Production smoke, written 2026-10-28 (not run)

STATUS (QA, 2026-10-28): the production smoke script is ready. It has not run because QA cannot upload or publish the workflow to production while the Refold side issue is open. When Refold is fixed and the workflow is deployed, QA runs `npm run smoke:pipedrive-email-bounced`. Nothing else is left to write.

QA approved the cases (note `notes/production-testing/12-pipedrive-email-bounced.md`, 11 checks, 1 send, README row 12). Hand-written, nothing run on production.
- Spec: `tests/pipedrive/email-bounced-smoke.spec.ts`. Setup spec: `tests/setup/pipedrive-email-bounced-smoke-sequence.spec.ts` (one step, only with `SETUP_SMOKE_SEQUENCE=1`). Data: `scripts/make-pipedrive-email-bounced-smoke-data.ts` builds `test-data/pipedrive/email-bounced-smoke.csv` (11 rows, gitignored). Run: `npm run smoke:pipedrive-email-bounced` (`scripts/run-pipedrive-email-bounced-smoke.sh`, gate first).
- Typecheck clean. Data script and shell syntax checked. Selectors and page-object calls come from the staging run and were not exercised on production.
- Changes from the approved note: one email step instead of two (only step 1 is bounced). Check 10 turns "Email is Bounced" off and waits 3 min before it looks. Check 11 asserts 1 person and 1 activity, as the cases say. On staging that row only recorded the result.
- Old person name is "A. Keita" style, so a changed name proves the update. Deals are "Annual renewal" and "Onboarding package".
- Blocked like the other Pipedrive smokes by the Refold deploy issue. QA runs it after the deploy.
