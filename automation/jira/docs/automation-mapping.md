# Automation project: test results to Jira

How this project turns test results into Jira bugs and comments: the review
page (`reports/report.html`, built by `reporter/`) drafts them today, and the
local Jira server planned in `../plan.md` section 10 will send them. The
rules are the same as for a person: the reviewer sees every draft and
confirms it, and a failed write is never retried.

Project paths (`test-cases/`, `reporter/`, `context/`) are relative to
`automation/`; `../plan.md` is one level above it. Links to kit files are
relative to this file.

## Where the data comes from

| Source | What it gives |
|---|---|
| `test-cases/<integration>/<workflow>.md` | Intro ("The workflow ticket is AL-XXXX"), Test data setup, one `## <Activity>` section per activity with its `Extra Configuration:` line, and rows `# \| Scenario \| Do \| Expected \| Ticket` |
| Test title | `<Activity name> > <#>: <Scenario>`; `<Activity name> > <#>` is the case ID that matches the row |
| `reporter/plain-english.ts` (`readScenarios`) | Per row: `expected` and `ticket`; per file: `workflowTicket` |
| `reporter/plain-report.ts` | Per test: `workflow` (the `test.describe` title, which is the trigger name), `steps` (the `test.step` titles), `failedStep`, `whatHappened`, screenshots, trace |
| Review page | The reviewer's mark (Bug, Not a bug, Retest) and note per failure |
| `context/<integration>/` | Tracking sub-task, intended behavior, open bugs |

## Failed case to bug

Fill the [bug description template](../templates/bug-description.md) from
the case and the run:

| Bug field | Comes from |
|---|---|
| Summary | `<Trigger>: <Activity> activity <symptom>`, with Trigger = `workflow` and Activity = the row's `## <Activity>` heading. The reviewer writes or edits the symptom. For a trigger-only workflow (no activities), use `<Trigger>: <symptom>` |
| Prerequisites | the file's Test data setup, plus the section's Extra Configuration line |
| Steps to Reproduce | the `test.step` titles, one action per line |
| Actual Result | `whatHappened` as plain language plus the workflow status in Logs, and "Screenshot attached." |
| Expected Result | the row's Expected cell (without a trailing " - Pass" or " - Fail, ...") |
| Environment | the run's environment. Runs are Staging today; ask if unsure |
| Linked Work Items | the row's Ticket (if not None), plus the workflow ticket |
| Priority, Assignee, QA, Epic Link | defaults in [jira-reference.md](jira-reference.md), editable in the review form |

Don't put a raw stack trace or selector error in Actual Result. Describe what
the user would see. The trace command can go under Note if the reviewer
wants it. If the failure looks like a script problem (locator, timing), it is
not a bug; say so instead of drafting one.

Before creating, search for an open bug on the same workflow with a similar
summary (the "Possible duplicates" JQL in
[jira-reference.md](jira-reference.md)) and show it, so the reviewer can
choose a Retest still failing comment instead of a duplicate.

After the bug is filed, offer to append " - Fail, AL-XXXX" to the row's
Expected cell, as `test-cases/_SCENARIO_TEMPLATE.md` says.

## Reviewed run to comment

| Run outcome on the linked ticket | Comment type |
|---|---|
| One case, passed, the ticket is a bug fix | [02 Verification](../templates/comments/02-verification.md) |
| Several cases for one activity or fix | [01 Retest table](../templates/comments/01-retest-table.md), one row per case: Scenario = the row's Scenario, Actual Result = observed, Status = Pass, or Fail, AL-XXXX once the bug exists |
| Production, a fixed bug passed after deploy | [03 Production deploy verified](../templates/comments/03-production-deploy-verified.md) |
| Production, whole workflow smoke run | [04 Production smoke summary](../templates/comments/04-production-smoke-summary.md) on the tracking ticket |
| Linked bug still fails | [05 Retest still failing](../templates/comments/05-retest-still-failing.md) |

Failures marked "Not a bug" by the reviewer become `Pass, working as
intended` rows only if the reviewer types the reason. Rows marked "Retest"
stay out of the comment.

## Current state (2026-10-08)

The review page builds both drafts in `reporter/template.html`
(`bugDraft`, `commentDraft`) and only offers Copy; Send to Jira is disabled.
Those drafts do not follow the shapes above yet:

- Summary is `<workflow>: <scenario> fails at "<step>"`, not the Summary
  pattern.
- The bug body is plain text (Workflow, Scenario, Browser, Steps, Expected,
  Actual, screenshot paths), not the description template.
- The comment is a bullet list of outcomes, not the Retest table.

Reshape them in the Mon 12 Jira phase (plan section 11), or earlier if QA
asks.

## Local server (built 2026-10-09)

`npm run jira` (code in `jira/server/`) serves the review page at
http://localhost:4317 and sends the drafts in `jira/drafts/` with one click;
see "One-click route" in [bug-creation.md](bug-creation.md). Jira type is
Cloud (saleshandy.atlassian.net). Not yet run against Jira: the first
`npm run jira:check` confirms the custom field setup. The page's own "Create
Jira bug" dialog on a failed test still only copies; a failed test becomes a
draft file the same way (QA confirms, Claude drafts).

## Calling Jira from code (REST API, not MCP)

Not verified in this project yet. These notes come from general Jira Cloud
API knowledge. Plan section 10 says to confirm Jira Cloud vs Data Center
with QA and read the official REST docs before coding any call; do that and
correct this section.

The local server uses an API token, so it calls the Jira REST API directly
instead of the MCP tools. The MCP tools convert markdown for you; the REST
API does not:

- `POST /rest/api/3/issue` and `POST /rest/api/3/issue/{key}/comment` need
  the description or comment body in Atlassian Document Format (ADF).
  Convert the markdown template to ADF in code (with a library or a small
  converter for headings, bold, lists, and tables).
- Custom fields need their ids (for example QA is `customfield_10048`). Read
  the Environment and Epic Link ids once from `GET /rest/api/3/field` and
  keep them in config, not in code.
- Links: `POST /rest/api/3/issueLink` with type `Relates`.
- Screenshot: `POST /rest/api/3/issue/{key}/attachments` with the header
  `X-Atlassian-Token: no-check`.
- Credentials (email + API token) live in `.env` only. Add the key names to
  `.env.example` in that phase.
