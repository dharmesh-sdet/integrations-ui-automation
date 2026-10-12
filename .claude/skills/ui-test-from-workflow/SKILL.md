---
name: ui-test-from-workflow
description: Turn one integration workflow (e.g. HubSpot Contact Created/Properties Updated and its activities) into reviewed test scenarios, then a Playwright UI spec walked through Playwright MCP, then running it and a plain-English failure summary. Use when QA pastes a workflow context, asks for scenarios or a script for a workflow, or asks why a run failed.
---

# UI test from workflow

One workflow per run of this skill. Four stages. **Stop at the end of every
stage** and wait for QA before starting the next one.

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

`<integration>` is `hubspot` for now.

## Stage 1: Context

1. QA pastes the workflow context in chat. Do not start without it.
2. Save it to `context/<integration>/<slug>.md`. Fix formatting only (headings,
   lists). Keep every statement and its meaning. Put the related Jira tickets
   at the top if QA gave them.
3. Tell QA the path. Do not ask about gaps yet; that happens in stage 2.

**Stop.** Wait for QA to say continue.

## Stage 2: Scenarios

Follow the template's sections 3 to 7 exactly. In short:

1. Confirm the mode (Smoke or Regression) if QA did not say it.
2. List the activities in product UI order.
3. Go through the template's coverage checklist. Collect every gap, missing
   Expected result, unclear setup or conflict, and ask them **all in one
   round** with AskUserQuestion, offering what the context suggests as the
   default.
   Always include: how the trigger event is done in the UI, and how long
   until it registers (so the scenarios carry the right steps and waits).
   Any choice you make while drafting (values, setup, data) also goes into
   this round, with the default; do not settle it silently in the draft.
4. Write the draft in the template's output shape. Show the **full draft in
   chat**.
5. Save to `test-cases/<integration>/<slug>.md` only after QA says "looks good"
   (or clearly approves).

Scenario IDs are not added to the tables. A scenario's ID is built from the
file: `<Trigger name> > <Activity name> > <#>`. Keep `#` stable: when rows are
added later, append, do not renumber.

**Stop.** QA reviews the scenarios.

## Stage 3: Script

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

### 3b. Walkthrough in the MCP browser

Use the `playwright` MCP server (Chrome). One scenario at a time.

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

### 3c. Code

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

## Stage 4: Results

After the run (yours or QA's):

1. Read `reports/results.json`.
2. For each failed test, open its screenshot (Read the PNG) and the error.
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
5. If the cause is the script (locator, timing, data), fix it yourself: check
   the locator on the real page in the MCP browser first, then rerun only the
   failing tests (`-g "<title>"`). If the same test still fails after a fix,
   stop and report the exact error (plan rule 9). If the cause is the product,
   do not change the code to make it pass; report it to QA.
6. When QA confirms a result, append it to the Expected cell in the scenarios
   file as the template says: " - Pass" or " - Fail, AL-XXXX".
7. If QA wants a bug filed or a comment posted, follow `jira/CLAUDE.md`
   (bug or comment flow, confirmation gate before any Jira write).

**Stop.**
