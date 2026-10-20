# How we test

Applies to every integration. Project rules in `../../plan.md` section 0 win
over this page.

## Scope

- UI testing only. API and backend are covered by developers. Setup and
  checks go through the UI, e.g. create a contact in HubSpot, then find the
  prospect in Saleshandy [project].
- Staging only for automation: `pyxis.lifeisgoodforlearner.com`. Production
  smoke tests run on production, my.saleshandy.com, with the account
  `emailopenedprod` [QA, 2026-10-14]. Scope and setup:
  [../../automation/notes/production-testing/README.md](../../automation/notes/production-testing/README.md).
- Two modes [project: test-cases/_SCENARIO_TEMPLATE.md]:
  - **Smoke** (production): 1 to 3 rows per activity, confirms fixes hold.
  - **Regression** (staging): every variation in the template's coverage checklist.

## Before a workflow test

0. New account: run the "Extra Configuration skipped" rows first, without
   saving any values. Saved Extra Configuration cannot be cleared again, even
   by removing and re-adding the activity (expected) [QA, 2026-10-09].
1. Field mapping is configured (without it, data may not be created on either side) [project].
2. On Triggers & Activity, turn every other enabled trigger off, turn on only
   the one under test, then Save and wait for "Configuration Updated
   Successfully" [QA, 2026-10-08]. Another trigger left on adds its own log
   entries and records, which breaks the checks.
3. HubSpot portal settings as in 00-overview.md (company auto-create off).
4. Link Clicked / Email Opened: a link click also counts as an open. Turn off
   every other workflow first, or their activities run at the same time
   [dev kit: saleshandy-web-apis.md, 2026-10-07].
5. Prospect Outcome is updated only fires when the prospect has a sent email
   in a sequence [dev kit: sh-outcome-run.sh].
6. Removing a prospect from a sequence finishes in the background; adding it
   again too early is silently dropped [dev kit: sh-email-sent-run.sh]. The
   kit's `sleep 10` is for its API script only. In a UI test, wait until the
   UI shows the prospect removed (see "UI waits vs dev kit waits" below).
7. A new account's test sequence must have an always-on sending schedule
   (Settings > Sending Schedule > Add Schedule covering all days and hours)
   before any timed run. HubSpot's default window (Mon-Fri 09:00-18:00) will
   queue step emails as "Scheduled Tomorrow" and fail any row that runs
   outside it, as a timing artifact, not a product bug [QA, 2026-10-18,
   Unsubscribed AL-4015: Create a Deal rows 1 and 2 failed this way].

## Test data

- Every run starts with all-new people [QA, 2026-10-13]: before the tests,
  `src/data/global-setup.ts` replaces every row of the CSV of each workflow
  being run (and its -deals and -companies files) with new people from about 60
  countries. Nothing to run by hand. Every email ever made is kept in
  `test-data/_generated-emails.txt` and never repeated. `KEEP_TEST_DATA=1`
  replaces used rows only (use it when a walkthrough is using the CSV's people);
  `TEST_DATA_ONLY=hubspot/<slug>` limits it to one workflow.

- Any `playwright test` run (seed, spec or test agent) with no CSV of its own,
  or while other workflows are live, needs `KEEP_TEST_DATA=1` or
  `TEST_DATA_ONLY=<own slug>` [QA, 2026-10-14]. Without it, a run with no
  matching CSV refreshes the data of every workflow (a seed check did this on
  2026-10-14 while four runs were live; see `lessons.md`). The `playwright-test`
  MCP entry sets `KEEP_TEST_DATA=1` for the agents.

- A run changes only its own workflow's CSV; other workflows' used rows are
  replaced by their own next run [QA, 2026-10-15; `REFRESH_OTHER_USED=1`
  restores the old behavior].

- From a QA CSV in `automation/test-data/<integration>/`, used exactly as
  written, no name prefix [QA, 2026-10-08].
- Records are created one at a time through the UI, never bulk-imported,
  unless QA says otherwise [QA, 2026-10-08].
- Test runs delete nothing; each CSV row is used once and the `.used.txt`
  file next to the CSV lists used emails. Used rows are replaced with new
  people before every run (`src/data/global-setup.ts`) [project]. Records
  Claude creates in a walkthrough are deleted by Claude afterwards and the
  rows replaced [QA, 2026-10-09].
- Never edit or delete data a test did not create [project].
- Re-running a CSV row collides with the contact the first attempt created.
  Add the row's email to the `.used.txt` file first; the next run's setup
  replaces the row [staging, 2026-10-12].
- Delete test contacts in HubSpot with normal Delete, not "Permanently
  delete". A permanent delete blocks that email for good [staging,
  2026-10-12].
- Each run empties its `test-results` folder: give every run a unique
  `--output` and copy screenshots out before the next row. `TaskStop` does
  not kill a test that already started; check with
  `pgrep -f '[r]eply-received.spec'` from a separate command, because inside
  a command that contains the spec name it matches its own shell [staging,
  2026-10-12].
- Trigger settings are per Saleshandy account, so two sessions cannot share
  one account; one account per workflow [staging, 2026-10-12].
- Sender daily cap: a step 1 email showing "Scheduled, Tomorrow" with the
  sender at 50/50 means the cap is used up. Rows that fail then are not
  product bugs. Do not change sender settings; tell QA [staging,
  2026-10-13].
- Never set a Closing Date on the prospect. The Saleshandy to HubSpot date
  conversion is invalid (bug filed, found through other tickets). From
  HubSpot to Saleshandy the same date arrives in a different format. Closing
  Date rows use the Extra Configuration's Days only, and the CSV Closing
  Date column stays empty [QA, 2026-10-12].
- Bounce tests: a plain `name@mailinator.com` never bounces by itself, so it
  is safe for manual "Mark as bounced" rows [QA, 2026-10-12]. A real bounce
  uses `name@<company>.mailinator.com` (not yet seen on staging) and goes
  through the real sender accounts, so real bounces are capped per plan, a
  few rows only [QA, 2026-10-12].
- When a workflow starts in Saleshandy (Email Sent, Reply, Outcome), ask QA
  how the prospects get in before assuming an import [project].
- Salesforce: standard duplicate rules match Contact against Lead and
  fuzzy-match similar names with the same email. Use clearly different names
  per CSV row [dev kit: saleshandy-web-apis.md, 2026-10-07].

## Waiting and verifying

- A wait or timeout for a product event is set from a measured time or from
  QA's stated manual steps, not guessed. If neither exists, ask QA how they do
  it by hand, then copy that [QA, 2026-10-19].
- Set the test timeout in `test.beforeEach`, before the first step, not inside
  the trigger step. HubSpot pages took about 40 s each to load on the new
  production portal, so creating a contact and 3 deals used the 5 minute
  default before the trigger step raised it (Unsubscribed smoke 04 and 06,
  [production, 2026-10-20]).
  A later `test.setTimeout` replaces it (`runTrigger` did, 2026-10-20): after
  changing a timeout, grep `setTimeout` in the spec and `src/flows/`, and
  confirm the failure time moved.
- Logs: refresh 15 seconds after the action, then every 10 seconds until the
  new entries show Success; give up after 3 minutes [QA, 2026-10-08]. Do not
  open log entries.
- Prospect is Unsubscribed on production [QA, 2026-10-19]: Mark as Unsubscribe
  in the UI does not trigger the workflow there, the real "Unsubscribe here"
  link does (the sequence needs "Unsubscribe as Link" saved). Method: add the
  prospect, Send now from the Emails tab if the email is scheduled, open the
  delivered email in Mailinator, wait 93 seconds, open the link, go back to
  the Prospects tab and hard refresh: the prospect shows Unsubscribed. Code:
  `MailinatorPage.openUnsubscribeLink(email, subject, 93_000)` and
  `SaleshandySequencePage.expectProspectStatusAfterRefresh()`
  (`tests/hubspot/unsubscribed-smoke.spec.ts`). Passed for check 00
  [production, 2026-10-19]. Staging's UI-vs-link equivalence stays open.
  Full smoke (all 9 activities) passed [QA, 2026-10-20]. A prospect not in
  any sequence that is unsubscribed manually does not trigger the workflow;
  this is valid product behavior, not a bug [QA, 2026-10-20].
- A Logs entry is the custom workflow's run, not one activity's result
  [QA, 2026-10-13]. Success does not prove a note, task, contact or deal was
  written: check the record in HubSpot. An activity selected alone (Create a
  Note, Record (log) an email) still gives a Success log and writes nothing.
- Sending sequence emails [QA, 2026-10-09]: a single prospect added to step 1
  is sent by Saleshandy on its own; wait for "Sent", no Send now. Use Send now
  only when step 1 emails are queued (first runs after setup, many prospects
  added at once, e.g. a CSV import) and for step 2 and later (days away).
  "Email has already been sent" after Send now means it is out: carry on and
  look for the email. Code: `SaleshandySequencePage.ensureSent()` (step 1
  single: waits for "Sent" and fails after 3 minutes with a setup hint; bulk
  or step 2+: Send now). A step 2 that starts on Day 3 has no row to Send now
  until the prospect is moved to it: `SaleshandySequencePage.moveToStep()`
  (Prospects tab > Add to Sequence, see `product/saleshandy.md`) [QA,
  2026-10-13].
- Before the first send test on an account, check the sender email account's
  time between emails. If it is 300 to 1200 seconds, emails queue for minutes:
  stop and ask QA to make sure the setup is right before testing; do not work
  around it [QA, 2026-10-09].
- Standard sender setup (Email Accounts > account > Sending Settings)
  [QA, 2026-10-09]: email account 1: emails per day 50, inbox placement test
  emails per day 50, time between emails 30-45 s; email account 2: 50, 50,
  45-55 s. Defaults are 15, 5, 300-1200. Saleshandy warns that Gmail may block
  above 30 a day; QA chose 50.
- Account `emailopened`, sender dharmesh@saleshandy.com: emails per day 150,
  inbox placement test emails per day 70, time between emails 45-55 s
  [QA, 2026-10-13]; Saleshandy shows the same Gmail warning above 30.
- Data check against HubSpot (`tests/hubspot/email-opened-data-check.spec.ts`,
  [project]): reads the contacts list footer count for each CSV email and marks
  any that already exist as used. It has a sanity test (a known existing
  contact and a made-up address) because a first version looked for the email
  as a link, could never find anything, and "passed" [staging, 2026-10-13].
- Link Clicked: open the email in Mailinator (mailinator.com, type the
  prospect email, Go) and click the link right away. The click takes 1 to
  1.5 min to show in Saleshandy (developer's max); check Logs only after the
  clicked count in Sequences > Emails goes up. The test gives up after 3 min
  [QA, 2026-10-08].
- Identify "new" entries by comparing execution ids before and after the
  action, not by time.
- One HubSpot change can create several log entries (one per changed
  property, AL-4039). Check that all new entries are Success, not that exactly
  one exists.
- Then check the record itself (Saleshandy prospect or HubSpot record). A
  Success log alone is not a pass; an Error log can still have partly
  succeeded [project: 00-overview.md].
- Salesforce: a step can show Success while its sub-request failed and
  nothing was created. Always check the record in Salesforce [dev kit:
  common-bugs #49].
- An Expected Result that no QA answer or staging run has confirmed is not a
  verdict: report what happened and ask QA before calling it a product issue
  or scripting it. When QA answers with several behaviors in one message,
  list each as expected or bug and get a yes before writing any of them into
  a scenario or test [lessons.md 2026-10-13].
- When QA changes an expected result, search the whole automation project for
  the old text and fix the config line it comes from (for example
  `loggedEmailContains`), not only the spec in front of you. A spec made by
  copying rows re-reads every QA decision in that workflow's progress file
  first [lessons.md 2026-10-14].
- "Nothing should happen" checks wait out a window (15 s, then 10 s steps,
  about 45 s total) and confirm no new log entry and no change.
- No fixed sleeps anywhere else; use the wait helpers in
  [reusable-building-blocks.md](reusable-building-blocks.md).

### UI waits vs dev kit waits

The dev kit (`integration-skills/`) triggers events by direct API calls and
uses fixed `sleep`s. Our tests go through the UI and have their own waits.
Take the dev kit's facts (what happens, what is slow), never its wait values
[QA, 2026-10-08].

| Situation | UI test waits like this |
|---|---|
| Any page action | Playwright auto-waiting and web-first assertions |
| Sync to show in Logs | `untilPasses()`: 15 s, then every 10 s, max 3 min |
| Record to show on the other platform | `untilPasses()` around search and check |
| Nothing should happen | `staysTrue()`: 15 s, then 10 s steps, about 45 s |
| Something finishing in the background (e.g. removal from a sequence) | Wait for the UI to show the new state; if the UI shows nothing, ask QA |

## Not a bug (avoid false failures)

Listed in 00-overview.md under "Intended behavior (confirmed)". The ones that
most often look like failures:

- Several log entries for one change (AL-4039).
- Mark Prospect as Finished/Replied/Paused does nothing when the prospect is
  not in the configured sequence.
- Prospect Outcome trigger: logged email has empty description and "Unknown
  Contact" as From (AL-4113).
- HubSpot refuses backward lifecycle stage moves.
- Two companies created when HubSpot's company auto-create is on (AL-4029).
- Saleshandy alert "You have reached the maximum daily sending limit for this sender email" rejects Send now late in a long run (sender limit 15 per day). Re-run the row [staging, 2026-10-14].
- No row depends on another row's prospect any more. Link Clicked's second-event rows (Create a Contact 6, Create a Note 5, Record 7) used to continue from Create a Contact 3, Create a Note 2 and Record 4 in the same run; they now run their own first event on their own prospect, so each can run alone [QA, 2026-10-15; all three passed alone on 2026-10-15, `reports/linkclick2`, 11.2 min]. Reply Received and Email Opened were already self-contained [project].

Open or undeployed tickets are listed in each scenario file's intro and are
not failures.

## After a run

- Count tests with `npx playwright test <spec> --list`, not from memory: the
  runner counts Setup too (Company Created: 19 cases plus Setup = 20).
- The first run of a new spec is a learning run. After fixing, rerun only the
  failed and not-yet-run rows (`KEEP_TEST_DATA=1`, `-g`); never restart the
  whole chain (QA, 2026-10-15).

- Failures are summarised in plain English in `automation/reports/failures.md`;
  say whether the likely cause is the script or the product.
- Before calling it a bug, rule out a setup gap (empty required field,
  missing prerequisite record, permissions, connector not authorised). Fix the
  setup and rerun; do not report it [dev kit:
  integration-testing SKILL.md].
- For a product failure, name the likely area in `failures.md` as a best
  guess for the developer: workflow JSON, Saleshandy backend, Saleshandy web
  UI, Refold platform, CRM config, or a missing Saleshandy connector action
  [dev kit: integration-testing SKILL.md step 8].
- "Mapped field not populated" bug: after the run (not during the test), open
  the log entry and attach (1) whether the mapping step received the map,
  (2) whether the value exists on the HubSpot record, (3) which panel the
  field was mapped in (Contact or Deal properties) [dev kit:
  common-bugs #31].
- Results are recorded in the scenario's Expected cell: " - Pass" or
  " - Fail, AL-XXXX".
- To see why a Success log did nothing, read the entry's execution detail
  after the run (Logs > click the entry > View Details on a step > expand the
  Request and Response JSON). It shows which HubSpot calls ran and what they
  returned: a Search step with `total: 0` and no update call means the record
  was never found [staging, 2026-10-14, AL-4128]. Read only; never during a
  test.
- Jira bugs and comments only through `automation/jira/CLAUDE.md`, with QA's
  confirmation before any write.
