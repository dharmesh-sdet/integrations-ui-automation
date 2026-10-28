---
name: ui-test-from-workflow
description: Turn one integration workflow (any platform: HubSpot, Salesforce or another) into reviewed test scenarios, then a Playwright UI spec written through the Playwright test agents (planner, generator, healer), then running it and a plain-English failure summary. Use when QA pastes a workflow context, asks for scenarios, a plan or a script for a workflow, or asks why a run failed.
---

# UI test from workflow

One workflow per run of this skill. Four stages. The Playwright test agents
do the planning, the spec writing and the fixing (QA, 2026-10-14, `../plan.md`
section 0 rule 12): start them with the Agent tool, `subagent_type`
`playwright-test-planner`, `playwright-test-generator` and
`playwright-test-healer`. Do not hand-write a new spec yourself. **Stop at the end of a stage only where
the stage says so**; between stages 1 and 2, and between 2 and 3 when the check
passes with nothing unconfirmed, continue without waiting (QA, 2026-10-15).

All paths below are relative to `automation/` unless they start with `../`.

## Before anything

Read these, every time:

1. `../plan.md` section 0. Those rules win over this file. The most important:
   never invent facts; selectors only from a real page in the MCP browser;
   nothing is written to HubSpot, Saleshandy or Jira without QA's approval;
   if something fails twice, stop and report the exact error.
2. `context/project.md` for answers already given (do not ask them again).
3. `test-cases/_SCENARIO_TEMPLATE.md`. It is the test case format and the
   scenario rules. Do not edit it.
4. `context/<integration>/00-overview.md` (integration overview, field
   mapping, confirmed intended behavior), then the workflow's context file.
   Where they disagree, the workflow file wins; ask if it matters.

Name the workflow with a short kebab-case slug, e.g. `contact-created`.
Files for it:

| What | Path |
|---|---|
| Workflow context | `context/<integration>/<slug>.md` |
| Scenarios | `test-cases/<integration>/<slug>.md` |
| Test data (CSV from QA) | `test-data/<integration>/<slug>.csv` |
| Spec | `tests/<integration>/<slug>.spec.ts` |
| Failure notes ("Likely reason" per failed test) | `reports/failure-notes.json` |
| Review report: one page, Integration > Workflow > Activity, latest run of each workflow, failures included (written by `reporter/plain-report.ts` when a run ends; `npm run report` rebuilds it) | `reports/report.html` |

`<integration>` is the platform folder, e.g. `hubspot` or `salesforce`.

## Stage 1: Context

1. Build the workflow context yourself from docs.saleshandy.com (and the
   integration's own docs where relevant). Check anything the docs leave
   unclear on staging (read-only unless plan rule 7 allows). Tag every fact
   with its source: `[docs]`, `[staging]` or `[QA]` (QA decision, 2026-10-15).
   If QA pastes a context in chat, that one wins over the docs; save it as
   given (formatting fixes only, keep every statement and its meaning).
2. Anything unclear goes under **Unclear: expected functionality
   (proposed)**: what you think should happen and why. Never write it as a
   fact. Put the related Jira tickets at the top if QA gave them.
3. Save to `context/<integration>/<slug>.md` and tell QA the path. Continue to
   stage 2 without waiting; the gaps are asked there in one round.

## Stage 2: Scenarios

Follow the template's sections 3 to 7 exactly. In short:

1. Confirm the mode (Smoke or Regression) if QA did not say it.
   For Smoke, before drafting:
   - Read `automation/notes/production-testing/README.md`, the last approved
     checklist (06) and `_SCENARIO_TEMPLATE.md`, and copy their format.
   - Ask QA the row count (default 10 to 12): one row per activity, a
     secondary activity rides inside another row, each fixed ticket gets a
     row, only rows QA confirmed as passed.
   - Before sizing sends, read the production account's email accounts,
     Salesforce connection and Field Mapping read-only and use those, not the
     README (its sender and limits go stale).
   - The runner plan always includes: gate, new sequence, email accounts
     added, sequence enabled.
2. List the activities in product UI order.
3. Go through the template's coverage checklist. Collect every gap, missing
   Expected result, unclear setup or conflict, and ask them **all in one
   round** with AskUserQuestion, offering what the context suggests as the
   default.
   Always include: how the trigger event is done in the UI, and how long
   until it registers (so the scenarios carry the right steps and waits).
   Any choice you make while drafting (values, setup, data) also goes into
   this round, with the default; do not settle it silently in the draft.
4. Start the **`playwright-test-planner`** agent. Give it: the workflow context
   path, the platform and account, the account's seed file
   `tests/seeds/<account>.seed.spec.ts` (pass it as `seedFile`, project
   `chromium`), the
   answers from step 3, staging only, and the data rule (`KEEP_TEST_DATA=1` or
   `TEST_DATA_ONLY=<slug>`, plan rule 11). Also give it the template
   `test-cases/_SCENARIO_TEMPLATE.md` (its output must follow it), one approved
   case file as the reference (e.g. `test-cases/hubspot/email-bounced.md`), and
   every Unclear point with your proposed expected result. The agent must
   carry each proposed result into its case marked **(proposed, unconfirmed)**;
   it must not guess and must not drop it. It explores in the MCP browser and
   saves its plan to `specs/<slug>.md`.
5. **Check** the planner's output against our approved cases:
   1. same sections, columns and ID format as the template;
   2. steps and expected results specific enough to automate;
   3. no product behaviour that is not in the context or the proposed list;
   4. similar in depth and wording to our approved cases.
   Fix small gaps by editing. Post a 5-line verdict in chat.
6. Turn the plan into the template's output shape and save to
   `test-cases/<integration>/<slug>.md`. Show the full draft in chat.

Scenario IDs are not added to the tables. A scenario's ID is built from the
file: `<Trigger name> > <Activity name> > <#>`. Keep `#` stable: when rows are
added later, append, do not renumber.

**Stop only when needed** (QA, 2026-10-15):

- If any case carries a **(proposed, unconfirmed)** item, or the check in
  step 5 found a difference you could not fix, stop and wait for QA to review.
  QA's answer replaces "proposed" with the confirmed result.
- If the check passed and every case rests on documented or QA-confirmed
  behaviour, go straight to stage 3.

## Stage 3: Script

### 3-pre. Scope check (before generating anything)

Multiply the approved scenario count by 6 minutes (the measured average run
time per scenario: Unsubscribed lite, 144 min / 27 rows). If the estimate
exceeds 3 hours (roughly 30 scenarios), or the list contains a variant that
only re-proves a trigger already proven once at baseline (e.g. a duplicated
"real link" row per activity, or prospects chained across rows instead of a
fresh one per row), stop before generating. Show QA the count, the estimate,
and the specific rows you would cut, with AskUserQuestion. Generate only
after QA decides the scope (lesson 2026-10-18, Unsubscribed AL-4015: a
63-row spec built without this check left rows 16-63 unrun and was dropped).

### 3-copy. Copying a spec or rows from another workflow

Before copying a spec, its assertions or its data rows from a sibling
workflow, search that workflow's `*-progress.md` for "proposed, not applied"
and open QA decisions, and apply or flag each one in the new spec (QA OK,
2026-10-20; lesson: the Unsubscribed smoke copied the Link Clicked "older deals
have no email" check after AL-4130 had made it expected behavior).

### 3a. Test data

If a scenario needs records created and `test-data/<integration>/<slug>.csv`
is not there yet, generate it yourself; never ask QA for a CSV:
`npm run data:generate -- <slug> --from <sibling workflow>` (template
`test-data/_DATA_TEMPLATE.md`). Confirm in one round only what is unclear:

- which CSV columns go to which form fields, if they differ from the sibling;
- how each record is created. HubSpot records (contacts, deals, companies) are
  created **one at a time through the HubSpot UI**, never bulk-imported. If the
  workflow starts in Saleshandy (e.g. Email Sent), ask how the prospects get in
  before assuming an import.

Type the CSV values exactly as they are, with no prefix (QA decision,
2026-10-08). Created data stays on the site. So each row can be created only
once: specs take the next unused rows with `unusedRows()` and call
`markUsed()` after creating one (`src/data/used.ts`). When few rows are left,
add new ones yourself in the same columns, with every value unique across the
file. In HubSpot, edit only properties whose label cannot be confused with
another (e.g. avoid Country/Region next to Country/Region Code). Never edit or
delete data a test did not create.

### 3b. Generate with the generator agent (replaces the manual walkthrough)

Start the **`playwright-test-generator`** agent once per approved scenario row,
with its test suite, test name, test file (`tests/<integration>/<slug>.spec.ts`),
seed file (`tests/seeds/<account>.seed.spec.ts`, project `chromium`) and the row's steps. Put the rules below in
its prompt. It walks the scenario in the MCP browser, one scenario at a time.

- Workflows that send sequence emails: before the first send, check the
  sender email account's time between emails. If it is 300 to 1200 seconds,
  stop and ask QA to fix the setup first (QA, 2026-10-09).
- On a new account, walk every "Extra Configuration skipped" row first,
  before any row saves Extra Configuration values: saved values can never be
  cleared again (QA, 2026-10-09). The spec keeps the same order.

- Do not stop to ask once QA has given the data. On staging you may create
  and update records from the CSV, turn triggers on and off (turn other
  enabled triggers off first), and Save on Triggers & Activity (standing
  approval, plan rule 7). Ask only when information is missing, or before
  touching data a test did not create, production, or Jira.
- Logs: do not open log entries. Refresh the Logs tab 15 seconds after the
  action; if the new entries are not Success, refresh every 10 seconds until
  they are (a third party, Refold, delivers data late). Then check the record
  in Saleshandy or HubSpot.
- After each step, report: what you did, what you saw, and the locator you will
  use. Prefer `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`. Use
  CSS only when nothing better exists, and say why.
- Only use locators you saw on the real page in this walkthrough. Never write
  one from memory or general knowledge of HubSpot or Saleshandy.
- MCP browsers run headless (QA, 2026-10-09). If the walkthrough gets stuck
  on something only QA can do (a login page, CAPTCHA, "verify it's you"):
  close the MCP browser (`browser_close`), send one desktop notification,
  then open a visible window on the same profile at the stuck page, in the
  background: `npm run mcp:open -- <profile folder in auth/> <url>`
  (e.g. `mcp-companycreated-profile`; add `msedge` for the Edge server). Ask
  QA in chat, wait for the script to exit (QA closes the window), then carry
  on headless. Never ask for or type a password.
- While on each platform, note how its login page is recognised (URL or
  element) and fill the `TODO(needs-input)` in `src/pages/base.page.ts`.

QA watches the browser and confirms the steps match the scenario.

The healer (stage 4) may edit fixtures and page objects as well as the spec.
List every change to a shared file (`src/fixtures`, `src/pages`, `src/flows`)
in the run summary for QA to review.

### 3c. Code

The generator writes the spec. Review it against these conventions and fix it
by editing (reuse `src/flows/` and the page objects; no selectors in the spec).

- **Page objects** in `src/pages/<platform>/<screen>.page.ts`, extending
  `BasePage`. Locators and actions only, no business assertions. Register them
  in `src/fixtures/index.ts`, built on `hubspotPage` or `saleshandyPage`.
- **Spec** in `tests/<integration>/<slug>.spec.ts`:
  - import `test` and `expect` from `src/fixtures/index.ts`;
  - `test.describe('<Trigger name>', ...)` with
    `test.describe.configure({ mode: 'serial' })`;
  - one `test()` per scenario row, titled `<Activity name> > <#>: <Scenario>`;
  - every action and check inside a `test.step('<plain English>', ...)`, e.g.
    `'Create the contact in HubSpot'`, `'Find the prospect in Saleshandy'`.
    These names are what QA reads when a test fails;
  - checks across platforms use `untilSynced()` from `src/utils/wait.ts`
    (about 1 minute). No `waitForTimeout`, no fixed sleeps;
  - no selectors in the spec.
- Anything you do not know: write `TODO(needs-input): <what>` and list it.
- Run `npx tsc --noEmit`, then run the spec yourself on staging and go
  straight to stage 4 without waiting for QA (QA, 2026-10-09; staging only):
  `REPORT_OPEN=never npm test -- tests/<integration>/<slug>.spec.ts --workers=1`
  in the background, watching the results.
- **Check the data before handing a spec over** (QA OK, 2026-10-20): run
  `npm run data:check -- <slug>` and compare each row's deal and company count
  with what its test title says (a title "contact has 3 deals" needs 3 rows in
  the -deals file). Fix the rows or the spec before QA runs it.
- **The first run is a learning run** (QA, 2026-10-15). Read every failure,
  fix it, then rerun only the failed and not-yet-run rows with
  `KEEP_TEST_DATA=1` and `-g` (add `CREATED_LABELS=C1,C2` when their contacts
  already exist in HubSpot). Do not restart the whole chain; the full run is
  QA's, after the fixes.
  Before naming a cause for a failure, read the failing test's trace (network
  calls and the last screenshot). State the cause only if the trace shows it;
  otherwise write "cause not proven" and say what you will check (QA OK,
  2026-10-19). When running a subset with `-g`, first run the same command
  with `--list` and confirm it lists the intended tests (QA OK, 2026-10-19).
- **Healer runs with the run** (QA, 2026-10-15). Whenever any spec runs in the
  background, start `playwright-test-healer` for each test as it fails, while
  the remaining tests keep running. Script failures (locator, timing, fixture,
  page object) are healed without asking QA; list shared-file edits in the run
  summary. At most 2 heal attempts per test, then stop and report the exact
  error (plan rule 9). The healer never changes an assertion's expected value
  to make a test pass; that is a product question for QA.
- **Ask QA only about product functionality, and only when a test fails** and
  the cause looks like the product (wrong data, no sync, error in Logs,
  behaviour differs from the case). Do not stop the run: log it in the
  progress file, keep running, then ask once at the end in one batched
  question with the evidence (what happened, what the case expected, your
  suggested expected result). Never ask about locators, waits or data.

### 3d. Account gate (before the first run on an account)

Lesson 2026-10-21 (Salesforce, `sfoutcomeupdated`): a run on an account with no
Field Mapping creates no records while Logs says Success.

- Read every Field Mapping tab of the account (Salesforce: Lead, Contact,
  Opportunity, Account; HubSpot: its tabs) and compare with the fields the
  activities write.
- Read the workflow's `*-progress.md` "Not checked" list.
- Do not run until each item is checked, set with QA's OK, or QA says skip.
- An empty mapping is reported to QA, never worked around in the script.

## Stage 4: Results

After the run (yours or QA's):

1. Read `reports/results.json`.
2. For each failed test, open its screenshot (Read the PNG) and the error.
   Check the CRM first. If the data is not in the CRM after the wait, open
   Logs and read the entry for errors. RUNNING means Refold has not finished:
   refresh, do not report it. Success does not prove the record. Error is a
   finding only with its steps and the CRM state: ask QA, do not fail the row
   alone (QA, 2026-10-28).
3. Failures live in the report page, not in a separate file (QA, 2026-10-09).
   The page already shows each failure's step, expected result, what happened,
   screenshots and replay command. Add the likely reason for each failed test
   to `reports/failure-notes.json` (keep other workflows' entries):

   ```json
   { "<spec file>::<test title>": { "likelyReason": "<plain English; say \"likely\". Script problem (locator, timing) or product problem (wrong data, no sync, error in Logs)>" } }
   ```

   `<spec file>` is the path from `automation/`, e.g.
   `tests/hubspot/company-created.spec.ts`. Write it for a QA reader: no
   stack traces, no code. Then run `npm run report` to rebuild the page.
4. Summarise in chat: passed, failed, and for each failure one line.
5. If the cause is the script (locator, timing, data), start the
   **`playwright-test-healer`** agent with the spec file and the failing test
   title (it checks the locator on the real page, then reruns only that test,
   `-g "<title>"`). If the same test still fails after a fix,
   stop and report the exact error (plan rule 9). If the cause is the product,
   do not change the code to make it pass; report it to QA. A failure on a
   case still marked "proposed, unconfirmed" is reported as an unconfirmed
   expectation, not as a product bug, until QA confirms the expected result.
6. When QA confirms a result, append it to the Expected cell in the scenarios
   file as the template says: " - Pass" or " - Fail, AL-XXXX".
7. If QA wants a bug filed or a comment posted, follow `jira/CLAUDE.md`
   (bug or comment flow, confirmation gate before any Jira write).

**Stop.**
