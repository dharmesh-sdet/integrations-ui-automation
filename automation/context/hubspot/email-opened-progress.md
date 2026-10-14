# Sequence Email is Opened: progress

The current state and next steps are in `RESUME.md` (section "Email Opened").
Facts are in `email-opened.md`; scenarios in
`test-cases/hubspot/email-opened.md`.

Log (2026-10-12)
- Account `emailopened` added; QA created it and saved the login; MCP
  profile seeded by Claude from that login.
- Account setup spec: field mapping saved, 3 passed.
- Walkthrough: Triggers & Activity read (9 activities, Extra Configuration
  fields in `email-opened.md`), nothing saved.
- Sender accounts: `+8`, `+10`, `2kartiktest+1` are Disconnected (red dot,
  toggle off). QA: use the personal mailbox for now. Sending Settings set on
  dharmesh@saleshandy.com (id klw6Z3gjw1): 50/50, 45 to 55 s.
- Sequence 196462 created; `+8` removed; sender dharmesh@saleshandy.com.
- Track email opens needs a custom domain; `cd1.shengage02.com` added and
  verified (QA chose it); the sequence toggle then asks "Enable Open
  Tracking for Emails?", Enable Anyway, saved.
- Stage 2 approved. QA additions: Send now for step 2 or later steps;
  Update values two options ahead of the record's current value.

Log (2026-10-13)
- Restarted from RESUME.md "Not done". Step 2 added to sequence 196462
  (Day 3, same thread, plain body, no variables: typing `{{` in the editor
  opens the variable picker and scrambles the text). Toast "Sequence step
  created successfully". Sequence still not activated.
- Test data already existed (email-opened.csv 38 rows, -deals, -companies,
  generated 09:13 today, no .used file); kept, not regenerated.
- Next: walkthrough with one prospect (step 1 Sent, open in Mailinator,
  Opened count, Logs, HubSpot contact), then read the dropdown order.
- Triggers page: all triggers were off. Opened on, Create a Contact selected,
  modal saved empty, page Save: "Configuration Updated Successfully"
  (baseline 1 passes). Lead Status and Lead Lifecycle option order read and
  written to email-opened.md.
- First spec run (chromium): baseline 1 passed. Create a Contact 1 hit the
  10 min timeout: not a product failure. On an account with no logs yet the
  Logs page shows "No logs yet" and `logEntries` waited for a row forever.
  Fixed in hubspot-integration.page.ts (returns [] on the empty state).
  Emails tab column is "Opened" (confirmed). Edge project has no saved
  session for emailopened: run with --project=chromium.
- Prospects Caleb Kensington (09:35) and Lucia Cifuentes (09:45) are in the
  sequence, step 1 sent, Opened 0 (the open was never made by the test).
- Rerun (chromium) after the Logs fix: Create a Contact in HubSpot > 1
  PASSED in 2.9 min (add prospect, step 1 Sent, open in Mailinator, Opened
  count up, Logs Success, HubSpot contact has mapped fields). Baseline 1
  passed earlier. Rows 2 to 5 of the baseline and the rest of Phase 1 not
  run yet.
- Side effect to know: global-setup also replaced used rows in
  link-clicked.csv and reply-received.csv when this spec ran.
- Phase 1 rebuilt (2026-10-13): `tests/hubspot/email-opened.spec.ts` now has
  exactly the 37 Phase 1 rows of the scenario file (numbering matches),
  adapted from email-bounced.spec.ts; the shared Link Clicked rows are no
  longer used here. New: baseline 2 to 5 (open count, second open, step 2,
  other trigger only), Create a Task 1 and 2 (modal only), Note 3, Record 5.
  Data regenerated: `email-opened.csv` from email-bounced (Phase 1 rows);
  Phase 2 data must be generated separately later.
- Create a Task modal walked on staging: Save disabled from the start; after
  touching every field only Task Title (input-error) and Due In
  (bs-input-number-error) turn red. Task Type, Task Priority and Task
  Associated With did not turn red. Recorded as annotations, not asserted:
  QA decides if that is a bug.
- Batch 1 of the rebuilt Phase 1 (10 rows): 8 passed. Failures: baseline 4
  (no Step 2 row on the Emails tab: step 2 is Day 3, so no row until the
  prospect is moved) and Update a Contact 3 (data: the generated person
  already existed in HubSpot, twice).
- Step 2 (QA answer 2026-10-13): move the prospect from step 1 to step 2:
  Prospects tab > tick row > "Add to Sequence" icon (button[icon="send"]) >
  Sequence: current > Sequence Steps "Step 2 - Day 3" > Add > report
  "Successfully Moved 1" > Done. Then a "Step 2, Scheduled" row exists (the
  step 1 row is replaced) and Send now works. Added as
  `sequence.moveToStep`, used by baseline 4, Note 3 and Record 5.
- Data: generator pool of 11 countries kept re-creating people HubSpot
  already holds. Added 8 new countries (Turkey, Portugal, Netherlands,
  Finland, Argentina, Vietnam, Kenya, Thailand) in src/data/generate.ts and
  retired the old 11 for new people. email-opened.csv regenerated (30 rows).
  Data check spec `email-opened-data-check.spec.ts` (HubSpot footer count;
  sanity test proves it sees an existing and a missing contact): all 30 rows
  absent from HubSpot. First version of the check was invalid (looked for
  the email as a link; HubSpot truncates it) and was replaced.
- Create a Note 4 (alone) now expects Success and no Error in Logs, no note
  (QA decision 2026-10-13, lessons.md).
- Run with TEST_DATA_ONLY=hubspot/email-opened and --project=chromium.
- QA answers 2026-10-13: Task fields not turning red is NOT a bug (not
  asserted; recorded as an annotation). "Two steps ahead" on a deal = Pipeline
  Stage. Update a deal 1 and 2 (Extra Configuration empty): run once, QA
  decides. Sender: keep dharmesh@saleshandy.com.
- Sender dharmesh@saleshandy.com (id klw6Z3gjw1) Sending Settings: emails per
  day 50 to 150 (QA), saved and verified after reload (it had sent 14 of 50
  today). Inbox placement tests per day left at 50: QA's "5 to 70" is
  ambiguous (inbox placement 50 or Daily Ramp-up "Start with" 5), asked.
  Interval 45 to 55 s unchanged. Gmail warns above 30 per day.
- Baseline 4 passed with the fixed step list click (1.4 min); baselines 1 to
  4 pass.
- Full Phase 1 run 2026-10-13 (run6, 2.1 h): 29 passed, 8 failed.
  Script/environment: Create a company 4 (network drop ERR_CONNECTION_CLOSED);
  Update a company 2 (Add Prospects button not found after the previous
  row); Note 3 and Record 5 (prospect row not on page 1 of the Prospects
  tab: moveToStep now searches first); Record 3 and 4 (HubSpot shows
  "Logged email with <name> created via Saleshandy" + body, not the subject:
  loggedEmailContains fixed).
  Open, possible product issues: Update a company 1 (the workflow log shows
  Error); Create a Note 4 alone (a contact with the prospect's own phone
  exists in HubSpot; selection check added). Rerun with --output so another
  session's run does not wipe reports/test-results.
- Phase 1 status 2026-10-13 14:50: 35 of 37 pass. Reruns passed: Create a
  company 4 (network drop earlier), Note 2, 3 (moveToStep now searches the
  Prospects tab by email; "First Last" returns nothing there), Note 4 (with
  a check that Create a Note is the only selected activity; the earlier
  "contact exists" did not reproduce), Record 3 (HubSpot shows "Logged email
  with <name> created via Saleshandy" and the body, not the subject), 4, 5.
  Still failing: Update a company 1 (workflow log shows Error, 2 of 2 runs)
  and Update a company 2 (company City stays "--", expected the new City).
  Email Bounced session saw the same two rows (Logs Success, City "--");
  Reply Received passes them. QA decision on bug or not is pending.
- HubSpot session expired mid-run (saved 24 h earlier); QA ran
  `npm run login:hubspot -- emailopened` at 14:36.

## Final status (saved 2026-10-13, afternoon)

State in one line: Phase 1 is scripted (37 rows) and 35 of 37 pass (count at
14:50); Phase 2 is scripted (27 rows) but has NOT been run.

Phase 1 (`tests/hubspot/email-opened.spec.ts`, 37 rows)
- Passing 35: baseline 1 to 5, Create a Contact 1 to 2, Update a Contact 1 to
  3, Create a deal 1 to 4, Update a deal 1 to 4, Create a company 1 to 4,
  Update a company 3 to 4, Create a Task 1 to 2, Create a Note 1 to 4, Record
  1 to 5.
- Open rows (2): Update a company 1 (workflow log shows Error, 2 of 2 runs)
  and Update a company 2 (company City stays "--", expected the new City).
  Email Bounced saw the same rows (Logs Success, City "--"); Reply Received
  passes them. Not filed, no Jira draft.
- Update a deal 1 and 2 are "run once, QA decides" rows. They passed in the
  full run but the list reporter dropped their before/after annotations. The
  rerun to capture them (14:55) was SKIPPED by the script: Update a Deal now
  has a saved value ("Select Pipeline (when to update): Sales Pipeline").
  Saved Extra Configuration cannot be cleared, so those two rows need a NEW
  account to run empty again. Most likely cause: reading the dropdown lists
  through the Triggers page on 2026-10-13 (a pipeline was picked in the
  dialog to load the stage list); not proven.

Phase 2 (`tests/hubspot/email-opened-phase2.spec.ts`, 27 rows run, 18 skip)
- Derived from `src/flows/activity-rows.ts` (not edited). Data
  `test-data/hubspot/email-opened-phase2*.csv` (made from link-clicked rows).
- Update a deal rows set Pipeline Stage two positions after Prospecting (the
  start stage of a UI-made deal, probed 2026-10-13): Follow-Up. QA's own
  example said "Proposal sent" (three on in the real list); QA to confirm.
- Not run. Order matters: it saves Extra Configuration values for good.

QA decisions pending
1. Update a company 1 and 2 on this trigger: bug or not (evidence above).
2. Update a deal 1 and 2 empty-configuration values: accept the run6 pass
   without recorded values, or provide a new account.
3. Phase 2 stage: Follow-Up (two on) or Proposal Sent as in the example.
4. Address `TODO(needs-input)` for emailopened in accounts.ts: optional,
   harmless label (QA did not answer).

How to run
- Always: `cd automation` and `TEST_DATA_ONLY=hubspot/email-opened
  npx playwright test <file> --project=chromium --workers=1
  --reporter=list --output=<unique dir>` (a shared output folder gets
  wiped by other sessions' runs).
- Phase 1: `tests/hubspot/email-opened.spec.ts` (add `-g "<title>"` for rows;
  Note 3 needs Note 2 and Record 5 needs Record 4 in the same run).
- Phase 2: `tests/hubspot/email-opened-phase2.spec.ts` (about 2 hours).
- Data check: `tests/hubspot/email-opened-data-check.spec.ts`.
- HubSpot login expires: `npm run login:hubspot -- emailopened` (QA, in
  automation/). Sender dharmesh@saleshandy.com: 150/day, inbox placement 70,
  45 to 55 s.

Next steps
1. QA answers the four items above.
2. Run Phase 2 (`email-opened-phase2.spec.ts`), triage, rerun script/env
   failures with a unique `--output`.
3. If QA says bug: draft one Jira bug for Update a company 1 and 2 into
   `jira/drafts` (template in `jira/templates`), QA sends it.
4. Update `RESUME.md` Email Opened row, offer a commit (nothing is committed
   since 03923bb; QA decides).

Leftovers in HubSpot from a probe (2026-10-13): contact
`probe.stage<digits>@mailinator.com` with one deal "Probe deal <digits>"
(no delete helper exists; test runs delete nothing).
Knowledge base: the seven notes and the lessons entry were applied
2026-10-13 (QA OK).

## Product issues to review later (QA 2026-10-13: note them, do not wait)

Not filed, no Jira drafts. QA reviews this list after the Phase 2 run.

| Row | Expected | Seen | Evidence | Source |
|---|---|---|---|---|
| Update a company 1 | Log Success, company updated | Workflow log shows Error (2 of 2 runs) | see "Final status" above | Phase 1 |
| Update a company 2 | Company City and State updated | Logs Success, City stays "--" (same on Email Bounced; related AL-4030, AL-4109, AL-4110) | see "Final status" above | Phase 1 |

Phase 2 run (started 15:20 IST, log in session scratchpad p2.log): new product
failures get appended here as they appear.

Phase 2 failure, 15:50 IST 2026-10-13 (candidate product issue, not yet triaged):
- Update a deal 1 (Contact has 1 deal): expected pipeline Sales Pipeline, stage
  Follow-Up, deal type New Business, priority High. Seen after 60 s of
  polling: stage Prospecting, deal type "--", priority "--" (pipeline matched).
  The Logs step before it passed (Success), so Saleshandy reported success but
  HubSpot did not get the Extra Configuration values. Not yet checked: whether
  the saved Update a Deal config on the account really holds these values.
  Evidence: `test-results-emailopened-p2/hubspot-email-opened-phase-ad60d-ubSpot-1-Contact-has-1-deal-chromium/`
  (error-context.md, 3 screenshots, trace.zip).

Phase 2 failure, about 16:00 IST 2026-10-13 (candidate product issue, same
pattern as Update a deal 1):
- Update a deal 2 (Contact has 3 deals): the latest created deal stayed at
  stage Prospecting, deal type "--", priority "--" (expected Follow-Up, New
  Business, High; pipeline matched). Logs step passed (Success).
  Evidence: `test-results-emailopened-p2/hubspot-email-opened-phase-0512c-bSpot-2-Contact-has-3-deals-chromium/`.

Phase 2 failure, about 16:10 IST 2026-10-13 (candidate product issue, not
triaged):
- Update a deal 4 (Contact has 1 deal, Closing Date 51 Days): Close Date
  expected 12/03/2026, seen 10/31/2026 after 60 s of polling. Cause not
  checked (the deal's earlier close date was not compared).
  Evidence: `test-results-emailopened-p2/hubspot-email-opened-phase-68869-1-deal-Closing-Date-51-Days-chromium/`.
- Update a deal 5 and 6 were skipped (by design, no Extra Configuration run).

Phase 2 failure, about 16:20 IST 2026-10-13 (candidate product issue, not
triaged):
- Create a Note 4 (paired with Update a deal, contact has 1 deal): note
  "Note created via Saleshandy" not found on the deal record 0-3/353762846403
  after 180 s. May be related to the Update a deal 1, 2, 4 failures (the same
  Update a Deal action); not verified.
  Evidence: `test-results-emailopened-p2/hubspot-email-opened-phase-6d4ab-e-a-deal-contact-has-1-deal-chromium/`.
- Create a Note 5 (not listed in the log) and Create a Note 6 were skipped.

Phase 2 failure, about 16:35 IST 2026-10-13 (candidate product issue, same
pattern as Update a deal 1 and 2):
- Record an email activity 6 (paired with Update a deal, contact has 3
  deals): latest created deal stayed at stage Prospecting, deal type "--",
  priority "--" (expected Follow-Up, New Business, High).
  Evidence: `test-results-emailopened-p2/hubspot-email-opened-phase-e9938--a-deal-contact-has-3-deals-chromium/`.

## Phase 2 result (run finished 16:30 IST 2026-10-13, 1.2 h)

21 passed, 6 failed, 18 skipped by design. Log: session scratchpad p2.log;
evidence under `automation/test-results-emailopened-p2/`.

Failed (all candidate product issues, none filed, cause not triaged):
1. Update a deal 1 (Contact has 1 deal): stage/deal type/priority not applied.
2. Update a deal 2 (Contact has 3 deals): same.
3. Update a deal 3 (row 1 then Extra Configuration values changed): same, after
   the first click. Evidence `hubspot-email-opened-phase-affe3-onfiguration-values-changed-chromium/`.
4. Update a deal 4 (Closing Date 51 Days): Close Date 10/31/2026, expected 12/03/2026.
5. Create a Note 4 (paired with Update a deal): note not on the deal after 180 s.
6. Record 6 (paired with Update a deal): same as 1 and 2.

Pattern: every Update a Deal row with Extra Configuration shows Logs Success
but the deal keeps stage Prospecting, deal type "--", priority "--". Not yet
checked: the saved Update a Deal config on the `emailopened` account.

Passed (21): Create a Contact 2 to 6, Update a Contact 2, Create a Task 1 to 4,
Create a deal 1 to 5, Create a Note 1 to 3, Record 3 to 5.
Skipped (18, as printed in the run log; the reason for each skip is not
checked here): baseline 1, Create a Contact 1, Update a Contact 1, 3 and 4,
Create a company 1, 2, 3 and 4, Update a company 1 to 4, Update a deal 5 and
6, Create a Note 6, Record 1 and 2.

## Update a Deal config check (16:40 IST 2026-10-13, read only, nothing saved)

Opened Extra Configuration of "Update a Deal in Hubspot" under Sequence Email
is Opened on `emailopened` and cancelled. Saved values: Pipeline Sales
Pipeline, Pipeline Stage Follow-Up, Deal Type New Business, Deal Priority High,
Closing Date 0 Days. So the saved config matches what the Phase 2 rows expect;
setup on the account is not the cause of the Update a deal failures.
Screenshot: `.playwright-mcp/emailopened-update-deal-config.png`.

Facts to compare (not a conclusion):
- Link Clicked's Update a deal rows (`activity-rows.ts`, lines 346 on) configure
  stage "Initial Contact" and passed on 2026-10-13. Phase 2 here configures
  "Follow-Up" (two steps after the Prospecting start stage, QA 2026-10-13).
- The two stage fields are labelled "(when to update)"; Deal Type and Priority
  "(while updating)". Whether Pipeline/Stage are a condition or a target on
  this action is not documented in the KB; the Phase 2 rows treat Stage as a
  target. QA to confirm the meaning before any bug is drafted.

## Stage probe result (17:15 IST 2026-10-13)

Question: is the failure caused by the stage value (Follow-Up here, Initial
Contact on Link Clicked)? Ran Update a deal 1 from a throwaway copy of the
Phase 2 spec with stage "Initial Contact" (copy deleted afterwards).

Result: same failure. Logs Success; deal stays stage Prospecting, deal type
"--", priority "--" (expected Initial Contact, New Business, High). So the
stage value is NOT what separates this from Link Clicked. What differs left:
the trigger (Sequence Email is Opened vs Link is Clicked) and the account.
Evidence: `test-results-emailopened-probe3/hubspot-email-opened-phase-27690-ubSpot-1-Contact-has-1-deal-chromium/`.

Side effects to know:
- The saved Update a Deal config on `emailopened` is now Initial Contact
  (the probe saved it), not Follow-Up. Phase 2 rows that expect Follow-Up
  re-save it themselves when run.
- Two earlier probe attempts failed in setup (the test person already existed
  in HubSpot because the throwaway spec's file name did not match the CSV the
  data refresh keys on). Script issue, fixed by naming the copy
  `email-opened-phase2-probe.spec.ts`. Not a product result.
- `test-data/hubspot/email-opened-phase2.csv` has new people again (the
  refresh ran); earlier Phase 2 data rows are used up.

## Log comparison: why Update a Deal finds no deal (2026-10-14 09:55 IST, read only)

Method: opened the newest 25 Logs entries (execution detail, View Details on
every node, JSON expanded) on `emailopened` and on `linkclick`. Nothing saved,
no spec run.

Seen on `emailopened` (7 of 7 Update a Deal runs, e.g. 6ace1921f6d843d7c465c7f4
at Oct 13 5:12 PM): the only HubSpot call is `Search deal`, POST
`/crm/v3/objects/deals/search` with filter `dealname EQ <prospect email>`.
Response `total: 0`, so no update-deal HubSpot call runs, and the log still
shows Success (the `update deal` node is a rule node, `rule_result: true`).
Entries 4, 8, 19 to 23 (Create a deal rows) create the deal with
`dealname = <prospect email>`.

Seen on `linkclick` (Update a deal runs, e.g. 6ace0069c9a5007e3ff1504c): the
search value is the contact id (e.g. 567363742404), `total: 1`, then the deal
is updated. A contact search by email (`total: 1`) runs before it.

Test data fact: the deals the spec pre-creates for Update a deal rows are named
from the `-deals.csv` (e.g. "AWS Deal 1"), not the prospect email, so the
Email Opened search cannot match them.

Not proven: whether this is the intended design (deal is found by name =
prospect email) or a bug. QA decision needed before any draft. Not tried: a run
where the pre-created deal is named with the prospect email.

## Session 2026-10-14 (morning)

- Cause of the Update a Deal failures found from Logs (see "Log comparison"
  above). QA: it is a bug. Draft saved:
  `automation/jira/drafts/email-opened-update-deal-shows-success-not-updated.json`
  (links AL-4013, AL-3984; Environment Production, Note says Staging). NOT sent
  yet; QA sends with `npm run jira`, then the Jira key goes into the test-cases
  "Fail, AL-xxxx" marks (Update a deal 1 to 4, Create a Note 4, Record 6).
- QA decisions: Update a company 1 and 2: already filed by QA (AL-4126 is
  the Update a Company City bug on this trigger). Phase 2 stage: Follow-Up.
- Scenario file `test-cases/hubspot/email-opened.md` Phase 2 now says Prospecting
  becomes Follow-Up (was Initial Contact to Proposal Sent).
- The 18 skips in Phase 2 are by design: `email-opened-phase2.spec.ts` skips
  every scenario not in its PHASE_2 list ("Phase 1 row: runs in
  email-opened.spec.ts"), i.e. the scenarios with Extra Configuration empty.
- Still open: Update a deal 1 and 2 with Extra Configuration empty (no before
  and after values were recorded); the proposed probe (deal named with the
  prospect's email, run once); KB proposal (execution detail reading, Update a
  Deal search by name on this trigger) waiting for QA's OK; commit (nothing
  committed since 03923bb).
- Not verified: whether the empty-configuration Update a Deal runs from
  2026-10-13 also searched by name and found 0 deals (page 2 of the Logs did
  not load for the read-only check).

- 2026-10-14 10:35: QA filed the bug as AL-4128 (same text as the draft; assignee Rudra Chauhan, Epic AL-3982). "Fail, AL-4128" marked in test-cases/hubspot/email-opened.md Phase 2 (Update a deal 1 to 4, Create a Note + Update a deal, Record + Update a deal with 3 deals).
- 2026-10-14: QA decision: do NOT run the "deal named with the prospect's
  email" probe and never rename test deals to fit product behavior. Test deals
  keep realistic names from the `-deals.csv` (e.g. "Figma Deal 1"). The Search
  deal finding (AL-4128) stands on the log evidence.

## Rerun 2026-10-14 (Update a deal, 10:47 to 11:06 IST)

Command: `email-opened-phase2.spec.ts -g "Update a deal in HubSpot > [1-4]:"`, own
REPORTS_DIR and `--output=test-results-emailopened-deals-rerun`, realistic deal
names from the CSV, Extra Configuration Sales Pipeline, Follow-Up, New
Business, High, 0 Days.

Result: 4 passed (13.0 min): Update a deal 1 (contact has 1 deal), 2 (3 deals),
4 (Closing Date 51 Days), 3 (values changed, second open). AL-4128 did NOT
reproduce.

Log evidence (read only, execution detail of the 5 new entries, 10:56 to
11:06 AM): the Search deal now filters `associations.contact = <contact id>`
(total 1, and total 3 for the 3-deal contact), followed by an update call that
sends dealstage, dealtype newbusiness and hs_priority high. On 2026-10-13 (4:19
to 5:57 PM) the same step filtered `dealname = <prospect email>` and returned
total 0. So the workflow's behavior changed between 2026-10-13 5:57 PM and
2026-10-14 10:56 AM. Who changed it and why is not known (AL-4128 was filed
at 10:32 AM today; AL-4119 on Reply Received has the same symptom and status
QA Approved). Not checked: whether the earlier "dealname" version is still in
use for other accounts.

The "Fail, AL-4128" marks in test-cases/hubspot/email-opened.md were made
before this rerun; QA decides whether to change them.

Paired rerun 2026-10-14 (11:06 to 11:19 IST, `-g` Create a Note > 4 and Record
(log) > 6, output `test-results-emailopened-paired-rerun`): 2 failed, both at a
LATER step than yesterday (the Update a Deal part now works):
- Create a Note 4 (Update a Deal + Create a Note, contact has 1 deal): the note
  IS on the deal (that check passed; yesterday it was not found after 180 s).
  It also shows on the contact's Activities, but QA's expectation of 2026-10-13
  is "note on the deal only, not on the contact". Failing line
  `email-opened-phase2.spec.ts:821`. Needs QA: is note-on-contact now expected?
- Record 6 (Update a Deal + Record (log), contact has 3 deals): the latest deal
  IS updated (Follow-Up checked, passed). The deal's Activities show "Logged
  email by Email Opened via Saleshandy" with a content preview, not the
  expected "Logged email with Ayoub Tazi" (prospect name), so the check gave up
  after 180 s. Same family as AL-4123 / AL-4113 (logged email does not name
  the prospect); not confirmed to be the same bug. Needs QA.
Evidence: `test-results-emailopened-paired-rerun/hubspot-email-opened-phase-6d4ab-...-chromium/` and `...-e9938-...-chromium/`.

- 2026-10-14: QA says AL-4126 (Update a company City, this trigger) is FIXED
  and the retest is skipped for now. The scripts stay in place and enabled:
  `Update a company in HubSpot > 1` and `> 2` in `tests/hubspot/email-opened.spec.ts`
  (lines 552 and 575) and `src/flows/activity-rows.ts` (626, 648). Retest later
  with `-g "Update a company in HubSpot > [12]:"` (own REPORTS_DIR and --output).
  Not verified by a run: the fix itself.

AL-4128 retest 2026-10-14 (11:23 to 11:56 IST, 26.9 min, output
`test-results-emailopened-al4128-retest`): 4 passed, 2 failed.
- Passed: Update a deal 1 (1 deal), 2 (3 deals), 4 (Closing Date 51 Days), 3
  (values changed, second open). Second day-run in a row (first: 10:47 run,
  4 of 4 passed). AL-4128's symptom (deal not updated) did not reproduce.
- Failed: Create a Note 4 (note also on the contact; QA expectation deal only,
  line 821) and Record 6 (card reads "Logged email by Email Opened via
  Saleshandy", test expects "Logged email with <name>"; deal stage Follow-Up
  verified). Same as the 11:06 paired run. Waiting for QA (note on the contact
  expected? logged-email naming same as AL-4123?).
- AL-4126 run (Update a company 1 and 2) started right after, 2 tests.

- 2026-10-14 QA: for Record (log) + Update a deal (3 deals) the card "Logged
  email by Email Opened via Saleshandy" is the RIGHT one. Script changed:
  `email-opened-phase2.spec.ts` (Record 6, deal check) now expects that text
  instead of "Logged email with <name>". Not yet rerun. Create a Note + Update
  a deal: contact and its 1 deal exist in HubSpot before the email is opened
  (created by the test); the note shows on both; QA decision on that pending.

- 2026-10-14 QA rule (Create a Note pairing): with Create a deal, if the
  contact is not in HubSpot a contact and a deal are created and the note goes
  on BOTH the contact and the deal. With Update a deal, only the DEAL gets the
  note. The script already checks both (Note 1 expects contact + deal; Note 4
  expects deal only), so no script change. Create a Note 4 fails on the
  product side (note also on the contact, seen twice on 2026-10-14, contacts
  Sienna Kelly and Cian Connolly). Jira search found no existing bug for it
  (AL-4096 is a different symptom). The earlier "Fail, AL-4128" mark on this
  scenario was removed: it is not the AL-4128 symptom. Draft pending QA's yes.

- 2026-10-14 12:13: Record 6 rerun with the corrected card text PASSED (5.1 min,
  `test-results-emailopened-record6-rerun`). Scenario file mark changed from
  "Fail, AL-4128" to "Pass (2026-10-14)". The four Update a deal marks still
  read "Fail, AL-4128" until QA says to switch them (they passed twice today).

- 2026-10-14 12:20 QA, confirmed with the developer: Create a Note + Update a
  deal puts the note on BOTH the contact and the deal. This replaces the
  "deal only" rule (so it is NOT a product bug; the bug draft is dropped).
  Script: `email-opened-phase2.spec.ts` Create a Note 4 now expects the note
  on the deal and on the contact. Scenario file updated. Not yet rerun.
  Other files still say deal only and belong to other sessions: shared
  `src/flows/activity-rows.ts:807` (Link Clicked) and
  `tests/hubspot/email-bounced-phase2.spec.ts:451` (Email Bounced), plus the
  Link Clicked scenario/progress notes ("note on the deal only (not a bug)").

- 2026-10-14 12:34: Create a Note 4 rerun with the corrected expectation PASSED
  (4.5 min, `test-results-emailopened-note4-rerun`). AL-4128 scenarios marked
  Pass in the scenario file. Verification comment draft:
  `jira/drafts/al-4128-retest-comment.json` (NOT posted, QA sends). Link Clicked
  files updated for the note rule (see link-clicked-progress.md).

- 2026-10-14: one command for both phases: `npm run test:email-opened`
  (`scripts/run-email-opened.sh`): Phase 1 spec first, then Phase 2, each with
  its own TEST_DATA_ONLY, REPORTS_DIR and --output; exit 1 if either failed.
  Written and syntax-checked, NOT run. On an account with saved Extra
  Configuration, the Phase 1 scenarios that need an empty configuration skip
  themselves (guard in `useOnly`); the rest of Phase 1 still runs.

- 2026-10-14 (QA: make the dependent scenarios self-contained): in
  `email-opened-phase2.spec.ts`, Create a Contact 6, Create a Note 5 and
  Record 7 no longer reuse the prospect of scenario 3, 2 or 4 (`carried` and
  `fromRow` removed). Each has its own prospect (3 new rows added to
  `test-data/hubspot/email-opened-phase2.csv`, placeholder emails replaced
  with new people by the next run's refresh) and does its own first open.
  Create a Contact 6 is listed and was sent for a verification run (result
  below if it finished). Note 5 and Record 7 are dormant in this spec
  (`flow.step2Events` is false here), typechecked only, never run. The Phase 1
  spec has no dependent scenarios (no carried/fromRow there).

## Final status 2026-10-14 (afternoon)

- Create a Contact 6, rewritten self-contained, PASSED (5.0 min,
  `test-results-emailopened-contact6-selfcontained`).
- All 64 in-scope scenarios pass: Phase 1 37 of 37 (35 from the 2026-10-13 run;
  Update a company 1 and 2 passed on 2026-10-14 after the AL-4126 fix), Phase 2
  27 of 27 (21 from 2026-10-13; Update a deal 1 to 4, Create a Note 4, Record 6
  on 2026-10-14 after QA's rule changes). 18 skipped by design.
- Not one clean full run: results come from several runs on 2026-10-13 and
  2026-10-14. Phase 1 empty-configuration scenarios cannot be rerun on this
  account (saved Extra Configuration); QA will provide a new account.
- Update a deal with Extra Configuration empty (2 scenarios): passed, values
  not recorded; waits for the new account.
- Create a Note 5 and Record 7: self-contained code written, dormant in the
  Phase 2 spec (step2Events false), never run.
- Tickets: AL-4128 not reproducible (comment sent by QA), AL-4126 verified
  fixed by a run. Note on contact + deal confirmed with the developer.
- One command for both phases: `npm run test:email-opened` (not run).

- 2026-10-14 13:50 full run (`npm run test:email-opened`), Phase 1 first 25 rows:
  baseline 3 and 4 failed only because baseline 2 was skipped (saved Extra
  Configuration); baseline 5 hit a strict-mode locator error in `logEntries`
  (fixed with `.first()` on the union). QA: make baseline 3 and 4
  self-contained. Done in `email-opened.spec.ts`: each uses its own CSV row (3
  and 4), its own Create a Contact setup and its own first open. Typechecked,
  not run. On this account they skip like baseline 2 (the setup needs empty
  Extra Configuration); they run on the new account.

- 2026-10-14 14:07 full run, Phase 1 finished (36.6 min): 12 passed, 5 failed,
  20 skipped. Failed: baseline 3, 4 (baseline 2 skipped; made self-contained
  after), baseline 5 (locator strict mode, fixed), Create a Task 1 (5 min
  timeout waiting for the Triggers page toggle, page never loaded: looks
  environmental, not rerun yet), Create a Task 2 (Task Title did not turn red,
  `.input-error` count 0; on 2026-10-13 Title and Due In did turn red; not
  triaged, rerun alone first). Phase 2 running: Update a deal 1 failed at once
  with net::ERR_CONNECTION_CLOSED opening the Triggers page (network drop,
  rerun needed).

- 2026-10-14 QA: page loads that fail with net::ERR_CONNECTION_CLOSED must
  retry. Added `gotoWithRetry` in `src/utils/wait.ts` (up to 3 more tries after
  5, 10 and 20 s; only net::ERR_CONNECTION_*, NETWORK_*, INTERNET_DISCONNECTED,
  TIMED_OUT, NAME_NOT_RESOLVED, EMPTY_RESPONSE, SOCKET_NOT_CONNECTED), used by
  `BasePage.goto` (all Saleshandy and HubSpot page loads) and the Mailinator
  load. Not a whole-test retry (that would re-add prospects and use up data).
  Typechecked, not run; the already-running Phase 2 process does not have it.

- 2026-10-14 QA: the 18 Phase 2 "skipped by design" rows all have an equal
  scenario in Phase 1 (matched by description: baseline 1; Create a Contact 1;
  Update a Contact 1, 3, 4 = P1 UC 1, 2, 3; Update a deal 5, 6 = P1 UD 3, 4;
  Create/Update a company 1 to 4; Record 1, 2; Note 6 = P1 Note 4). They are no
  longer registered in `email-opened-phase2.spec.ts` (a Proxy on `test` keeps
  only PHASE_2 rows): `--list` shows 27 tests, typecheck clean. Side effect:
  Playwright's "Location" for every Phase 2 test now reads line 32 (the proxy),
  so use the test title to find a row. Coverage gap unchanged: 6 empty-
  configuration rows have no result on this account (new account needed).

## Full run result 2026-10-14 (`npm run test:email-opened`, 13:10 to 14:50 IST)

Phase 1 (36.6 min): 12 passed, 5 failed, 20 skipped (saved Extra Configuration).
Phase 1 failures: baseline 3, 4 (baseline 2 skipped; since made self-contained),
baseline 5 (strict-mode locator in logEntries; fixed), Create a Task 1 (Triggers
page toggle never loaded, 5 min timeout), Create a Task 2 (Task Title not red,
not triaged).
Phase 2 (1.1 h): 19 passed, 18 failed, 8 skipped. The 18 failures:
- net::ERR_CONNECTION_CLOSED (2): Update a deal 1, Create a Contact 3.
- Create a Contact 6: 10 min test timeout in changeProspect (after its first
  open), not triaged.
- "Test not found in the worker process" (10): Update a Contact 3, 4, Create a
  company 1, 2, 4, Update a company 1 to 4, Create a Note 6. CAUSE: Claude
  edited email-opened-phase2.spec.ts (unregistered the 18 Phase 1 rows) while
  the run was going; when the worker restarted after the Create a Contact 6
  timeout it loaded the edited file. Not product failures. Claude had said
  editing mid-run was safe; it was not (worker restarts reload the file).
- HubSpot login expired mid-run (3): Record 4, Record 6, Update a deal 3.
- Not triaged, may be the same session expiry (2): Record 3 ("Logged email with
  <name>" not found, Breeze Assistant text), Record 5 (contact not found in
  HubSpot after 180 s).
Passed in Phase 2 (19): Create a Contact 2, 4, 5, Update a Contact 2, Create a
Task 1 to 4, Create a deal 1 to 5, Create a Note 1 to 4, Update a deal 2, 4.
Blocked: HubSpot login for `emailopened` (QA: npm run login:hubspot --
emailopened). Then rerun: baseline 3, 4, 5; Create a Task 1, 2; Update a deal
1, 3; Create a Contact 3, 6; Record 3 to 6.
