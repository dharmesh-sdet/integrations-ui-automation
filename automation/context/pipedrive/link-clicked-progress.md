# Pipedrive: Link Clicked, progress (2026-10-27)

Regression, staging, account gpipedrive. Workflow ticket AL-4175 (sub-task of AL-4170). Row Ticket cells are AL-4175.

## Done
- Cases: `test-cases/pipedrive/link-clicked.md` (32 rows, QA "approved" 2026-10-27).
- Spec (hand-written, typecheck clean, 32 tests listed, NOT run): `tests/pipedrive/link-clicked.spec.ts`. Reuses `src/flows/saleshandy-to-pipedrive.ts`, the Pipedrive page objects, `mailinator.page.ts` `clickFirstLink` / `openEmail` and `sequence.page.ts` `clickedCount` (now takes an optional email). Needs `PD_LINK_SEQUENCE_ID`.
- Sequence setup spec: `tests/setup/pipedrive-link-clicked-sequence.spec.ts` ("Pipedrive Link Clicked QA", 2 steps, 2 links each, Track link clicks, sender Kartik 7 = 2kartiktest+7@gmail.com).
- Data (gitignored): `test-data/pipedrive/link-clicked.csv`, 31 rows, made by `scripts/make-pipedrive-link-clicked-data.ts`. Five rows click a second link or a step 2 link: Trigger behavior 3 and 4, Create a Lead 3, Create a Deal 3 and Create Organization 2. Each has its own prospect and makes the first click itself. Each row runs alone.

## Decisions in the spec
- Link scanner: rows that expect "one activity" or "one lead" check for at least one and record the count. Rows that expect "still 1 person" are strict.
- Lead and deal titles are the prospect email (the case file), not "First Last" as in Reply Received.
- Another session (local-project-ee, Email Bounced AL-4183) shares the gpipedrive trigger configuration. It sets KEEP_OTHER_TRIGGERS=1 and changes only its own trigger. Saving the page saves the whole configuration, so do not save in the same second.

## Open / to do
1. Sequence exists: id 197376 (QA gave it 2026-10-28, email accounts connected by QA). Use `PD_LINK_SEQUENCE_ID=197376`. Steps 1 and 2 added by the setup spec on 2026-10-28 (builder fixes: subject retype, untick same-thread box, wait for list). BLOCKED on Track link clicks: turning it on shows 'Custom Domain Required' (Skip Tracking for Now / Set Up Custom Domain) instead of 'Enable Link Tracking in Emails?'. Waiting for QA. Sender, activation and the full run are still to do.
2. Make sure Email Sent is OFF on gpipedrive before the run.
3. Trigger name `Link is Clicked in Saleshandy` and activity subject `Link is clicked in Saleshandy` are from the overview, not yet seen in the UI. Check on the first run.
4. Two rows cannot set an old value first. They are the first rows of Create a Person and Update a Person. The reason is that `people.create` takes only a name and an email. The spec records the changed fields and does not assert them.
5. Create Organization 1 and Update Organization 1 do not read the mapped values (no reader in `organizations.page.ts`).
6. Run once to learn script errors, then rerun only failed rows: `KEEP_TEST_DATA=1 KEEP_OTHER_TRIGGERS=1 TEST_DATA_ONLY=pipedrive/link-clicked PD_LINK_SEQUENCE_ID=<id> npx playwright test tests/pipedrive/link-clicked.spec.ts --project=chromium --workers=1 -g "<Section> <n>:"`. About 33 sends, cap 40 a day shared.

## Run 2026-10-28 (sequence 197376, full run 48.5 min)
Setup: custom tracking domain cd1.shengage02.com was set by the EmailOpened session; the setup spec then added steps 1 and 2, link tracking and activation. Sender: the accounts QA connected (preview shows 1kartiktest+4; Mailinator shows From 1kartiktest@gmail.com). Builder fixes in `sequence-builder.page.ts`: retype subject, untick same-thread box on step 2. The setup spec no longer adds a sender (Kartik 7 not offered).
Result: 28 passed, 4 failed. Reruns (same data, then fresh data) fail the same 4:
- Create a Lead 3 (second link) and Create a Deal 1 (prospect not in Pipedrive): the email arrived and the click was made, but no person in Pipedrive after 90 s. Cause not proven. Saleshandy Logs not read yet (the run threw before it).
- Update a Deal 2: "The People list shows 204 people but only 192 were read; the reader would miss records". Script reader limit in `people.page.ts`, not a product failure.
- Delete Organization 2: organization count with the company name went 4 to 3 (earlier 2 to 1) where the case expects no change. Cause not proven.
Reruns on the same data cannot work: the prospect is already in the sequence and "Done" never shows. Use fresh data (no KEEP_TEST_DATA) for a rerun.

## Result after reruns (2026-10-28)
All 32 rows pass (28 in the full run, 4 after the fixes). Reruns need fresh data (no KEEP_TEST_DATA).
- Create a Lead 3, Create a Deal 1, Update a Deal 2: script failures. The People reader skipped a block of rows in the virtual list, so the person Pipedrive had created was not seen. Fixed in `people.page.ts` (scroll 600 px, 6 stale scrolls; another session wrote it). All three passed after the fix. Logs were not read for the first two.
- Delete Organization 2: script failure. The CSV company (HashiCorp) already had organizations in Pipedrive from earlier runs, and the product correctly deleted one each run (4 to 3, 2 to 1, 1 to 0). The row now takes the first company with no organization and checks the count is 0 first (`link-clicked.spec.ts`).
- Not run as a single suite after the fixes. A full rerun in one go is QA's.

## Production smoke (2026-10-28)
Cases: `notes/production-testing/11-pipedrive-link-clicked.md` (QA "looks good" 2026-10-28, 11 checks, 10 sends, Ticket None, AL-4175 is the workflow ticket). README row 11 added.
Written, typecheck clean, 11 tests listed, NOT run: `tests/pipedrive/link-clicked-smoke.spec.ts`, `tests/setup/pipedrive-link-clicked-smoke-sequence.spec.ts`, `scripts/make-pipedrive-link-clicked-smoke-data.ts`, `scripts/run-pipedrive-link-clicked-smoke.sh`, `npm run smoke:pipedrive-link-clicked`. CSV `test-data/pipedrive/link-clicked-smoke.csv` (gitignored).
Reuses the note 09 gate. The spec waits 90 s (first click) and 180 s (second click) after the send, and stops before any send when Email Sent or Email is Opened is on. Deal names are "Annual renewal" and "Onboarding package" (no "Legacy", QA 2026-10-28).
Before QA runs: `npm run login:saleshandy -- emailopenedprod` and `npm run login:pipedrive -- emailopenedprod` (headed), Email Sent and Email is Opened off on emailopenedprod, no other smoke run on that account. Trigger name `Link is Clicked in Saleshandy` and subject `Link is clicked in Saleshandy` were seen on staging.
After the run: draft the summary from `jira/templates/comments/04-production-smoke-summary.md` into `jira/drafts`. QA sends it.
