# Jira QA kit: rules for Claude

This folder holds everything needed to file Jira bugs and write Jira comments
(Staging and Production) in this project. The project root `CLAUDE.md` loads
it with the line `@jira/CLAUDE.md`. The kit itself is self-contained, so it
can be copied to another project as is (see [README.md](README.md)).

## What to open for each task

| Task | Open |
|---|---|
| File a bug in Jira | [docs/bug-creation.md](docs/bug-creation.md), then [templates/bug-description.md](templates/bug-description.md) |
| Write a comment on a ticket | [docs/comments.md](docs/comments.md), then the one file it points to in [templates/comments/](templates/comments/) |
| Site, cloudId, accountIds, field defaults, payloads, transitions, JQL | [docs/jira-reference.md](docs/jira-reference.md) |
| The report's Jira drafts and the planned local Jira server (failed case to bug, run to comment) | [docs/automation-mapping.md](docs/automation-mapping.md) |

## How this fits the automation project

Project paths in this section are relative to `automation/` (the project
root); `../plan.md` is the plan one level above it. Links elsewhere in the
kit are relative to the file they are in.

- `../plan.md` section 0 still applies and wins on conflict. Its rule 7: no
  Jira write without QA's approval, and the standing Staging approval does
  not cover Jira.
- Test cases live in `test-cases/<integration>/<workflow>.md` (format:
  `test-cases/_SCENARIO_TEMPLATE.md`). Each row's Ticket column and the
  intro's "workflow ticket is AL-XXXX" line give the tickets to link or
  comment on.
- Workflow context (tracking sub-task, intended behavior, open bugs) is in
  `context/<integration>/`. Read it before asking the user.
- After a run, the review page `reports/report.html` holds every result,
  failures included (Integration > Workflow > Activity; likely reasons from
  `reports/failure-notes.json`). It is the usual source for a bug or a comment.

## Core rules (apply to every task)

1. **Make no assumptions.** Never invent or infer a Summary, Actual or
   Expected result, error text, URL, environment, ticket key, or field value.
   If something is missing, unclear, or ambiguous, ask. No TODO placeholders,
   no blank fields, no likely-sounding guesses in anything sent to Jira.
   (In code, plan rule 1's `TODO(needs-input)` still applies.)
2. **Ask everything in one round.** List every open question up front (bug
   content and ticket metadata together) and ask them all at once. Use the
   AskUserQuestion tool, not plain chat text. The user may still answer in
   chat (for example with a screenshot); accept that.
3. **Look things up before asking,** so each question can offer a real
   default. Search Jira (`searchJiraIssuesUsingJql`) for duplicates, sibling
   bugs, and the epic that similar bugs use, then offer what you find as the
   suggested answer ("Epic AL-3982, same as the other HubSpot bugs?").
4. **Don't over-ask for error text.** A UI-level description ("the workflow
   shows Error status", "the action shows the Errored label") is enough for
   Actual Result. Ask for exact text only when the notes do not say *what*
   failed.
5. **Confirmation gate on every Jira write.** Show the full final draft
   (description or comment text, plus every field in the payload) and get an
   explicit "looks good" before calling any write: `createJiraIssue`,
   `addOrEditJiraIssueComment`, `editJiraIssue`, `createJiraIssueLink`,
   `transitionJiraIssue`, attachments. Small follow-ups ("also add X to the
   comment") need the gate too.
6. **Never retry a failed Jira write.** A retry can create a duplicate ticket
   or comment. Show the exact error verbatim, stop, and wait for the user.
7. **Match the established style.** Reshape the user's notes into the
   templates and real examples in this kit. Rewording is fine; adding facts
   is not. If you are unsure how to phrase something, show the draft and ask.
8. **Writing style.** No em-dashes anywhere (use a comma, period, semicolon,
   or parentheses). Use " > " for UI paths (Settings > Integrations > HubSpot
   > Logs). Name the trigger (workflow) before the activity. Keep comments
   short unless several scenarios need a table.
9. **Send descriptions and comments as markdown** (or HTML only for inline
   images). Never hand-build ADF JSON for the Atlassian MCP tools.
10. **Deleting comments is not possible through the Atlassian MCP.** If a
    comment goes to the wrong ticket, tell the user so they can delete it
    manually.
11. **Prerequisites name the activity that owns the failing behavior.** Use
    the activity that produces the failing record or field, not the one
    selected in the run where it was first seen, and put the Prerequisites in
    the question round for QA's yes. If the symptom can show up in several
    workflows or rows, say so in Note instead of picking one. When asked which
    scenario failed, answer from the run evidence (report or trace), not from
    a draft, and say "not known" if neither shows it.
