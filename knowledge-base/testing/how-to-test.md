# How we test

Applies to every integration. Project rules in `../../plan.md` section 0 win
over this page.

## Scope

- UI testing only. API and backend are covered by developers. Setup and
  checks go through the UI, e.g. create a contact in HubSpot, then find the
  prospect in Saleshandy [project].
- Staging only for automation: `pyxis.lifeisgoodforlearner.com`. Production
  smoke tests use a new user account on production (no URL documented) [project].
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

## Test data

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
- When a workflow starts in Saleshandy (Email Sent, Reply, Outcome), ask QA
  how the prospects get in before assuming an import [project].
- Salesforce: standard duplicate rules match Contact against Lead and
  fuzzy-match similar names with the same email. Use clearly different names
  per CSV row [dev kit: saleshandy-web-apis.md, 2026-10-07].

## Waiting and verifying

- Logs: refresh 15 seconds after the action, then every 10 seconds until the
  new entries show Success; give up after 3 minutes [QA, 2026-10-08]. Do not
  open log entries.
- Sending sequence emails [QA, 2026-10-09]: a single prospect added to step 1
  is sent by Saleshandy on its own; wait for "Sent", no Send now. Use Send now
  only when step 1 emails are queued (first runs after setup, many prospects
  added at once, e.g. a CSV import) and for step 2 and later (days away).
  "Email has already been sent" after Send now means it is out: carry on and
  look for the email. Code: `SaleshandySequencePage.ensureSent()` (step 1
  single: waits for "Sent" and fails after 3 minutes with a setup hint; bulk
  or step 2+: Send now).
- Before the first send test on an account, check the sender email account's
  time between emails. If it is 300 to 1200 seconds, emails queue for minutes:
  stop and ask QA to make sure the setup is right before testing; do not work
  around it [QA, 2026-10-09].
- Standard sender setup (Email Accounts > account > Sending Settings)
  [QA, 2026-10-09]: email account 1: emails per day 50, inbox placement test
  emails per day 50, time between emails 30-45 s; email account 2: 50, 50,
  45-55 s. Defaults are 15, 5, 300-1200. Saleshandy warns that Gmail may block
  above 30 a day; QA chose 50.
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

Open or undeployed tickets are listed in each scenario file's intro and are
not failures.

## After a run

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
- Jira bugs and comments only through `automation/jira/CLAUDE.md`, with QA's
  confirmation before any write.
