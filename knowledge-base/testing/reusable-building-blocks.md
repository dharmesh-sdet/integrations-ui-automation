# Reusable building blocks

What already exists in `automation/`, so a new workflow or a new integration
(Salesforce next) reuses it instead of rebuilding it. Check here before
writing any helper, page object or fixture.

## Reuse as is (integration-agnostic)

| Need | Use | File |
|---|---|---|
| A logged-in page per platform, failing early with a login hint if the session is missing or older than 7 days | `loggedInPage()` in the fixtures; `assertSessionFresh()` | `src/fixtures/index.ts`, `src/utils/session.ts` |
| Save a login session for a workflow's account | `npm run login:<platform> -- <account>` (add `--force` to start logged out) | `scripts/login.ts`, accounts in `src/config/accounts.ts` |
| Pick the account a spec runs as (required, no default) | `test.use({ account: '<name>' })` at the top of the spec | `src/fixtures/index.ts` |
| Base URL per platform, browser presets (Chromium, Edge) | `platforms`, `browsers` | `src/config/environments.ts` |
| Read a QA CSV | `readCsv(file)` (quotes, commas, line breaks, BOM) | `src/data/csv.ts` |
| Use each CSV row once (data is never deleted) | `unusedRows(csv, rows, n)`, `markUsed(csv, email)` | `src/data/used.ts` |
| Wait for a sync on the Logs cadence (15 s, then 10 s, max 3 min) | `untilPasses(what, check)` | `src/utils/wait.ts` |
| Prove nothing happens | `staysTrue(page, check, times)` | `src/utils/wait.ts` |
| Page object base (goto plus login-page check) | `BasePage` | `src/pages/base.page.ts` |
| Saleshandy sidebar covering the page | `SaleshandyPage.closeSidebar()` | `src/pages/saleshandy/saleshandy.page.ts` |
| Salesforce card shows "Re-connect" mid-run | Automatic, once per test, staging only: reuses the worker's Salesforce login; if the popup asks for a login, runs `npm run login:salesforce:auto` (`.env` username and password; SMS code: a window opens, QA is notified, it waits 5 min) | `src/flows/salesforce-connection.ts`, `scripts/login-salesforce-auto.ts` |
| Run a Salesforce-side workflow now instead of waiting for its 3-hour cron | `npm run sf:run-now -- <account> "<workflow name or id>"`; in a spec `RefoldRunNow.open(page)`, then `run()` and `waitForEnd()` | `scripts/run-now.ts`, `src/flows/refold-run-now.ts` |
| Test a Salesforce-side workflow (Lead / Contact / Account / Opportunity is created in Salesforce) end to end: set the actions, make the Salesforce record, run the workflow now, find that run in Logs, check the prospect | `salesforceSideTests({...})`; specs `tests/salesforce/{lead,contact,account,opportunity}-created.spec.ts`, data `npm run data:salesforce-side` once | `src/flows/salesforce-to-saleshandy.ts` |
| Run chosen workflows in parallel, with a warning for workflows that affect each other | `npm run parallel -- salesforce/email-sent hubspot/link-clicked` (one lane per account; `--yes` skips the question) | `scripts/run-parallel.ts` |
| Daily send cap shared by parallel runs | `checkSendCap()` before, `recordSend()` after a successful send (`test-data/sends-<date>.log`) | `src/data/send-cap.ts` |
| Find a prospect in Saleshandy CRM and read its fields | `SaleshandyCrmPage.search/openProspect/field` | `src/pages/saleshandy/crm.page.ts` |
| Plain-English report after a run | reporter | `reporter/plain-report.ts`, `reporter/plain-english.ts` |
| Jira bug and comment drafts | Jira kit | `jira/CLAUDE.md` |

## Reusable patterns (copy the shape, not the code)

From `tests/hubspot/contact-updated.spec.ts`:

- **New log entries:** note the execution ids before the action, then wait
  until all entries not in that set are Success (`knownLogIds`,
  `expectNewLogsSuccess`).
- **Check a record:** inside `untilPasses`, search by email, expect exactly
  one match (no duplicate), open it, compare fields (`expectProspect`).
- **Trigger isolation:** turn every other trigger off, this one on, Save,
  wait for the saved alert (`enableOnly`, `save`, `savedToast`).
- **Spec shape:** one `test.describe` per trigger in serial mode, one
  `test()` per scenario row titled `<Activity> > <#>: <Scenario>`, every
  action in a plain-English `test.step`.

These three helpers live in the spec today. When a second spec needs them,
move them to `src/flows/` (improvement-plan.md item P7) rather than copying.

## HubSpot-specific (do not reuse for Salesforce)

- `src/pages/saleshandy/hubspot-integration.page.ts`: Triggers & Activity and
  Logs tabs on the HubSpot integration page. Whether Salesforce has the same
  tabs and row layout is not checked yet.
- `src/pages/hubspot/*`: HubSpot app screens.

## Checklist: adding a new integration (e.g. Salesforce)

1. Read the integration's public docs summary in
   [../product/saleshandy.md](../product/saleshandy.md) (Integrations section).
2. Ask QA for: the test account and login URL, the workflow list and
   contexts, field mapping, and the CSV. Record answers in
   `automation/context/project.md`.
3. Add the platform to `src/config/environments.ts` and a `login:<platform>`
   script in `package.json`; run the login once (QA logs in).
4. Write `automation/context/<integration>/00-overview.md` in the same shape
   as the HubSpot one.
5. Walk the Saleshandy integration page for this integration in the MCP
   browser. If its Triggers and Logs tabs match HubSpot's, make the HubSpot
   page object generic (pass the integration name) instead of copying it;
   ask QA before changing a page object a passing spec uses.
6. New page objects for the other app under `src/pages/<platform>/`.
7. Reuse everything in "Reuse as is" above; add new gotchas to
   [ui-gotchas.md](ui-gotchas.md).
