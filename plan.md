# Integration Test Automation Plan

Owner: Darshan (QA). Target for the main structure: Tuesday 13 Oct 2026.

## 0. Rules for Claude Code (read first, follow always)

1. Never invent facts. This covers URLs, selectors, API endpoints, request or response shapes, Jira field IDs, environment variable values, CLI flags, and library APIs. If a fact is not in this file, in `context/`, or in `test-cases/`, do one of:
   - Ask me.
   - Verify it from the installed package (`--help`, the package's types, its README in `node_modules`).
   - Write `TODO(needs-input): <what is missing>` in the code and continue.
2. Selectors come only from a real page inspection through Playwright MCP (or `codegen` output I give you). Never write a selector from memory or from general knowledge of HubSpot, Salesforce or Saleshandy.
3. Build only the current phase from section 11. When it is done, stop, list what you built, list open `TODO(needs-input)` items, and wait for my review.
4. Before writing code in a phase, post a short plan: files you will create or change, and assumptions you are making. Wait for my OK on any assumption that touches Jira, auth, or data deletion.
5. Pin and check versions. Run `node -v` and check the installed `@playwright/test` version before using any API. If an API differs from what you expect, follow the installed version.
6. Never read, print, log or commit secrets. Only touch `.env.example` (key names, no values). Never open `.env` or `auth/` contents.
7. Never write to Jira, HubSpot, Salesforce or any real system without an explicit confirm step in the code and my approval to run it.
   Standing approval (QA, 2026-10-08): on staging, the MCP walkthrough and tests may create and update records from the CSV, turn triggers on and off (other enabled triggers off first), and Save on Triggers & Activity, without asking each time. Added 2026-10-09 (QA: "it is okay since this is staging"): create, edit and activate sequences and use Send now on the workflow accounts. Also 2026-10-09: Claude runs the specs itself on staging and fixes script problems without waiting for QA, for every workflow. Still ask before touching data a test did not create, anything on production, and anything in Jira.
8. Test data is created by the test through the UI, from a CSV I provide, one record at a time (never a bulk import unless I say so). Created data stays on the site; tests do not delete it (decided 2026-10-08). Never modify or delete data a test did not create.
   QA, 2026-10-09: Claude runs each new spec on staging and fixes script errors until it is stable (see rule 7); QA then runs the stable spec manually. Claude owns the data. Records Claude creates in an MCP walkthrough are deleted by Claude afterwards (only those records), and their CSV rows are replaced with new people in the same file. Test runs leave their records; their used rows are replaced automatically before the next run (`src/data/global-setup.ts`).
9. If something fails twice, stop and report the exact error. Do not keep changing code in loops.
10. Keep files small and boring. No extra frameworks, no abstractions beyond what a section here asks for.

## 1. Goal

Cut the time spent on repetitive manual integration testing (HubSpot, Salesforce, others) by running test cases automatically, then turning failures into Jira bugs and passed runs into Jira comments with one click each. A human reviews every result before anything is written to Jira.

## 2. Principles

- Claude helps build the tests. It does not run regression. Execution is plain Playwright, so runs are fast, repeatable and free.
- Page Object Model (POM): selectors live in one place, tests read like the test case.
- UI testing only. API and backend testing is covered by the developers (decided 2026-10-08). Setup and result checks go through the UI, e.g. create a contact in HubSpot, then find it in Saleshandy.
- No credentials in code or chat. Sessions are saved locally after a manual login.
- Nothing reaches Jira without the reviewer's click.

## 3. How it works

```
Test case (md)  ->  Claude + Playwright MCP explore the UI  ->  Page object + spec generated
      ->  npx playwright test (parallel)  ->  Results + screenshots + traces
      ->  Interactive report (reviewed by QA)
      ->  Fail and real bug: one click creates Jira bug with screenshot
      ->  All reviewed: one click posts "tested" comment on the ticket
```

## 4. Unknowns (do not assume, ask me)

Ask these at the start of the phase that needs them. Record my answers in `context/project.md` so they are not asked twice.

| Unknown | Needed by | Answer |
|---|---|---|
| Language and runtime (default proposal: TypeScript, Node LTS, npm) | Wed 7 | TBD |
| Saleshandy staging URL (login start page; confirm with me which part is the base URL) | Wed 7 | https://pyxis.lifeisgoodforlearner.com/crm/list |
| Jira type: Cloud or Data Center/Server | Mon 12 | TBD |
| Jira base URL, project key | Mon 12 | TBD |
| Jira field IDs and defaults for Epic, Assignee, QA | Mon 12 | TBD |
| Does `docs/jira-reference.md` exist? If not, I will provide it | Mon 12 | TBD |
| HubSpot login URL (used by the Wed 7 login script) | Wed 7 | https://app-na2.hubspot.com/home-beta |
| HubSpot test account | Thu 8 | The account saved by `npm run login:hubspot`; safe to create data in |
| Which API is used to verify results | Thu 8 | None. UI only; results are checked in the Saleshandy UI |
| HubSpot to Saleshandy sync time | Thu 8 | About 1 minute (use as the maximum wait) |

## 5. Folder structure (POM)

```
automation/
  playwright.config.ts      workers, retries, projects, reporters
  package.json
  .env.example              key names only, no values
  .gitignore                .env, auth/, reports/, node_modules/
  auth/                     saved login sessions (gitignored)
  context/                  project.md, plus <integration>/<workflow>.md (workflow context QA pastes)
  test-cases/               _SCENARIO_TEMPLATE.md, plus <integration>/<workflow>.md (generated scenarios)
  test-data/                <integration>/<workflow>.csv from QA (gitignored)
  src/
    pages/                  page objects, one folder per platform
      base.page.ts
      saleshandy/
      hubspot/
      salesforce/
    components/             shared widgets (sidebar, modal, table)
    api/                    API clients for setup and verification
    fixtures/               hubspotPage and saleshandyPage (each with its saved login), page objects
    data/                   CSV reader and qa-auto-<timestamp> name prefix
    utils/                  wait-for-state helpers, logger
    config/                 environments and base URLs
  tests/                    specs, one folder per integration, one spec per workflow
    hubspot/
  scripts/                  login commands (login:hubspot, login:salesforce)
  reporter/                 interactive report (pass/fail, screenshots)
  jira/                     small local server: serves the report, create bug, post comment
  reports/                  run output (gitignored)
```

Rules:
- A spec never contains a selector.
- A page object never contains an assertion about business rules.
- Create only the folders needed by the current phase. Empty placeholder folders for later phases are fine, but no code in them.

## 6. Using Playwright MCP (authoring only)

**What it is:** a tool that lets Claude control a real browser and read the page structure, so it can discover real selectors and steps instead of guessing.

**Setup (once, done by me):** `claude mcp add playwright -- npx @playwright/mcp@latest`. Check options with `npx @playwright/mcp@latest --help`. Do not use flags that are not shown there.

**Per test case:**
1. I give you the test case and the context file for that platform.
2. You walk through the flow in the browser and report each step and the selector or role you used.
3. I watch the browser and confirm the steps match the test case.
4. You write or update the page object and the spec.
5. I run `npx playwright test <file>` and review the result.

**Starter prompt:**
"Open the browser, follow test case TC-xxx step by step using the context file. After each step tell me what you clicked and what you saw. Do not create or change data outside the case. Then write the page object and spec."

**Do:** use the saved session, work one case at a time, prefer role and label locators.
**Do not:** run regression through MCP, ask for passwords, or explore production.
**Fallback if MCP is unclear:** `npx playwright codegen <url>` records my clicks into code, and you then clean it into the POM.

## 7. Test case format

Test cases follow `automation/test-cases/_SCENARIO_TEMPLATE.md` (decided 2026-10-08, replaces the earlier ID/preconditions/steps format). The `ui-test-from-workflow` skill (`.claude/skills/`) generates them from a workflow context. A case's ID is `<Trigger name> > <Activity name> > <#>`; row numbers stay stable (append, never renumber) so results can be matched to Jira or QMetry later. If a case is missing anything the template needs, ask me. Do not fill the gap yourself.

## 8. Credentials and sessions

- `npm run login:<platform>` opens a headed browser. I log in myself (2FA and OAuth included). The session is saved to `auth/` using Playwright's storage state.
- API keys and tokens go in `.env` (never committed). `.env.example` lists key names only.
- Tell me which keys a flow needs. I fill them in locally.
- Sessions can expire. When a test hits a login page, fail with a clear message ("session expired, run npm run login:<platform>"). Do not try to log in automatically.

## 9. Parallel runs

- Different workflows and integrations run in parallel (Playwright workers, one spec file per workflow).
- Tests inside one workflow run in series. Configure this explicitly (for example `test.describe.configure({ mode: 'serial' })`), and check the installed Playwright docs for the exact API.
- Every test creates its own data from the CSV rows it is given, so tests do not collide. Data is not removed afterwards.
- Waits use "until state changes" helpers or Playwright auto-waiting and web-first assertions. Never fixed sleeps.

## 10. Report and Jira

### Report
One HTML page per run: summary (passed, failed, flaky), a row per test with final screenshot, and for failures the failure screenshot, error, trace link, and a short "what failed" note. The reviewer marks each failure as Bug, Not a bug, or Retest.

The report is served by the local server in `jira/` (not opened from a file path), so its buttons can call the server without cross-origin problems.

### Jira actions (local server, API token)
- **Create bug:** pre-filled from the failed case (summary, steps, actual, expected, screenshot). Shown for review, created only on confirm. Uses the defaults in `docs/jira-reference.md` once I provide it.
- **Tested comment:** drafted from the run results for the linked ticket, edited by the reviewer, posted only on confirm.
- A failed Jira write is never retried automatically. Show the error to the reviewer.
- Before coding any Jira call, confirm Jira Cloud vs Data Center with me, then read the official Jira REST docs for that type. Do not guess endpoints, auth headers, or the attachment upload format.
- The API token comes from `.env`. Never log it.

## 11. Timeline to Tuesday 13 Oct

Build one row at a time. Stop at the end of each row (rule 3).

| Day | Work | Output |
|---|---|---|
| Wed 7 | Base structure only (scope below) | Folders ready, login works, one sample case and context file |
| Thu 8 | `ui-test-from-workflow` skill (context + scenario template -> scenarios -> MCP walkthrough -> spec -> plain-English failure summary), then the first workflow spec through the UI | One test runs in parallel |
| Fri 9 | Interactive report with screenshots and failure details | Report opens after each run |
| Mon 12 | Jira bug and comment buttons with screenshot upload | Bug and comment flow works |
| Tue 13 | Buffer, fixes, end to end demo | Demo of the full flow |

### Wed 7 scope (base structure)
Build:
- Folders from section 5 and `package.json` with Playwright installed.
- `playwright.config.ts` (workers, retries, reporters).
- `.env.example`, `.gitignore`, `base.page.ts`, fixtures skeleton.
- `login:<platform>` scripts that save the session to `auth/` (Saleshandy and HubSpot; HubSpot URL is in section 4).
- One sample file each for the test case format (section 7) and a context file.

Do not build today: real selectors, specs, API clients, data setup or cleanup, report, anything Jira.

Weeks 2 to 4: remaining Saleshandy and HubSpot flows, then Salesforce and other platforms, then flaky-test cleanup and optional scheduled nightly runs.

## 12. Inputs I will provide

- Wed 7: language and runtime choice, Saleshandy staging URL and login, HubSpot login URL (already in section 4).
- Thu 8: test scenario template, first workflow's context (pasted in chat), CSV test data, HubSpot access and a stable test account.
- Mon 12: Jira API token in `.env`, project key, Epic/Assignee/QA defaults, and `docs/jira-reference.md`.

## 13. Risks

| Risk | Mitigation |
|---|---|
| 2FA, OAuth or unstable test accounts | Manual login with saved session; confirm accounts by Wed |
| Flaky sync-based flows | State-based waits (about 1 min max for HubSpot to Saleshandy), checks in the Saleshandy UI, limited retries |
| Jira buttons slip past Monday | Bug button first, comment push follows; Tuesday is buffer |
| Claude Pro usage caps | Small steps, one case at a time, short contexts |
| Claude Code guesses missing facts | Section 0 rules, section 4 unknowns table, `TODO(needs-input)` markers |

## 14. Definition of done for the main structure

- One real workflow runs end to end from one command, in parallel with a second.
- Report shows pass/fail with screenshots; failures show why.
- A failed case becomes a Jira bug with screenshot after review.
- A reviewed run posts a tested comment to the ticket.
- A new teammate can add a case by following sections 5 to 7.
- `grep -r "TODO(needs-input)"` returns nothing for the delivered flow.