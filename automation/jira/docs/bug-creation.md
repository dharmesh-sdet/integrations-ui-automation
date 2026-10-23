# Filing a bug directly in Jira

Bugs are created straight in Jira through the Atlassian MCP server. Site
values, defaults, and payload shapes are in
[jira-reference.md](jira-reference.md). The description shape is in
[../templates/bug-description.md](../templates/bug-description.md).

## One-click route (QA, 2026-10-09)

This is the default when the Atlassian MCP is not connected, and whenever QA
wants to send from the review page.

1. **Ask QA first: is this a bug or not?** Never draft before QA says yes.
   The same goes for a comment: ask before drafting it.
2. Draft from the template ([../templates/bug-description.md](../templates/bug-description.md),
   or the matching file in [../templates/comments/](../templates/comments/)).
   If no template fits, ask QA for one. Ask every missing fact in one round.
3. Write the draft to `jira/drafts/<slug>.json` (bug: type, project, summary,
   description, priority, environment, epic, assignee, qa, links,
   attachments; comment: type, ticket, body; optional waitingFor). Copy an
   existing draft for the shape.
4. QA runs `npm run jira` and opens http://localhost:4317. The draft shows at
   the top under "Jira drafts" with every field (the review page lists only
   drafts still waiting; sent tickets and comments are on the Dashboard, under
   Salesforce or HubSpot > Drafts, newest first, older than 7 days under
   "Past"); QA can edit the text, then
   one click creates the bug (plus links and attachments) or posts the
   comment. That click is the confirmation gate.
5. The file then records the Jira key and cannot be sent again. A failed
   send shows Jira's error and is never retried.

Needs `JIRA_EMAIL` and `JIRA_API_TOKEN` in `automation/.env` (QA adds them;
Claude never reads the file). `npm run jira:check` tests the connection and
prints how the Environment, Epic Link and QA fields are set up, without
writing anything. Code: `jira/server/`.

## Steps (through the Atlassian MCP)

1. **Read the source.** This is the user's notes, a failed automated test
   case (its card in `reports/report.html`, the case row in `test-cases/`, and the
   screenshot), or a pasted description. For a failed case, first agree with
   the user that it is a product bug and not a script problem. Work out what you already know: Summary,
   Prerequisites, Steps, Actual, Expected, and Environment.
2. **Search Jira first.** Use `searchJiraIssuesUsingJql` to find:
   - possible duplicates (same workflow and symptom),
   - sibling bugs on the same trigger or workflow (to suggest as links),
   - the epic that similar bugs use,
   - the workflow's tracking ticket (for example the AL-3984 sub-task).
   If you find a likely duplicate, say so before drafting anything.
3. **Ask one round of questions** with AskUserQuestion. Cover bug content
   and metadata together, and offer a default for each:
   - bug content: whatever is missing from step 1,
   - Priority (default Medium),
   - Environment (always Production, QA 2026-10-13; the Note says "Affected
     Environment - Staging" or Production, where the bug was seen),
   - Epic Link (the one found in step 2),
   - Assignee (default Darshan),
   - QA (default Dharmesh Patel),
   - Linked Work Items (sibling bugs and the workflow's tracking ticket from
     step 2, plus the parent exploration ticket if there is one),
   - Summary prefix such as `[PostRelease]`, only if the user says the fix is
     deferred to after the release.
4. **Draft the ticket.** Write the Summary using the pattern below and the
   description using the template. Show the whole thing: Summary, the full
   description, and a field table (Priority, Environment, Epic Link,
   Assignee, QA, Linked Work Items).
5. **Wait for an explicit "looks good".** Apply any edits and show the
   result again if anything changed.
6. **Create the issue** with `createJiraIssue`. If it fails, show the error
   verbatim and stop. Do not retry.
7. **Add links** with `createJiraIssueLink` (via `executeWrite`), one call
   per linked ticket, link type `Relates`. Links are never set inside
   `createJiraIssue`.
8. **Attachments.** Screenshots are usually attached by the user in Jira. If
   you need to attach one, upload it first, then embed it with a separate
   `editJiraIssue` call (HTML content format).
9. **After filing,** report the key and URL. If the bug came from a test
   case, offer to append " - Fail, AL-xxxx" to that row's Expected cell in
   `test-cases/<integration>/<workflow>.md` (see
   `test-cases/_SCENARIO_TEMPLATE.md`, "Recording results"). Change the file
   only after the user agrees.

## Summary title pattern

`<Trigger name>: <Activity name> activity <short symptom>`

- Use the trigger and activity names exactly as they appear in the product.
- When the run shows Success but nothing happened, write
  `shows Success but <symptom>`. For other bugs (an error, wrong data, a UI
  issue), describe the symptom directly.
- For a bug outside a trigger/activity workflow, use
  `<Feature or page>: <short symptom>`.
- `[PostRelease]` goes at the very start, only when the user asks for it.

Real examples:
- Prospect Outcome is updated in Saleshandy: Update a Contact in HubSpot activity shows Success but does not update the contact
- Prospect Outcome is updated in Saleshandy: Create a Deal in HubSpot activity creates the contact without the mapped contact properties
- [PostRelease] Prospect Outcome is updated in Saleshandy: Create a Contact in HubSpot activity fails with an error when the Hiring Date Picker custom field is mapped

## Content rules

- Keep the user's exact error messages and URLs. Clean the steps to one
  action per line without changing what they mean.
- Do not add request/response JSON, field IDs, or API keys unless the user
  supplied them and wants them in the ticket. Never include secrets; say in
  a Note that they were left out.
- If several symptoms come from the same workflow, keep them in one bug and
  connect them in Actual Result. If two scenarios have different causes or
  symptoms, file them as separate bugs. Ask when it is not clear which.
- If a detail is already covered by another open bug, leave it out and
  mention that bug instead (or link it, if the user agrees).
- Evidence (a screenshot, a BetterBugs link) goes under Actual Result. If the
  user will attach it manually, write "A screenshot will be attached to the
  ticket manually."
