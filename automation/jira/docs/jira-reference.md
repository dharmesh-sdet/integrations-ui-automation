# Jira reference

Values used by both bug creation and comments. They come from the Bug
Creation workspace as of 2026-10-08. If one stops working (for example a
transition id changes), look it up again and update it here.

## Site

- Site: https://saleshandy.atlassian.net
- cloudId: `b6724b57-8729-4b0d-8177-ba62b6ab8da0`. Call
  `getAccessibleAtlassianResources` only if this ever fails.
- Project key: `AL` (Saleshandy Alpha). Some product bugs live in `SH`
  (for example SH-20233). Ask which project to use when it isn't an
  integration-workflow bug.
- Atlassian MCP server config (`.mcp.json` at the project root):

```json
{
  "mcpServers": {
    "atlassian": { "type": "http", "url": "https://mcp.atlassian.com/v2/mcp" }
  }
}
```

## People (accountIds)

Assignee and QA need an accountId. Passing an email fails with "User
'<email>' was not found in the system".

| Person | Email | accountId | Default for |
|---|---|---|---|
| Darshan | darshan@saleshandy.com | `5af5d8dd244bc90a10605d4f` | Assignee |
| Dharmesh Patel | dharmesh@saleshandy.com | `712020:c7dedb58-9cb3-4450-a98f-5b5b56f6556b` | QA |

For anyone else, look them up (for example with `lookupJiraAccountId` via
`discover`) and add them here.

## Field defaults

Offer these as the suggested answers in the single question round. Never
apply them silently.

| Field | Default | How it is set |
|---|---|---|
| Project | `AL` | fixed (ask for non-integration bugs) |
| Issue Type | `Bug` | fixed |
| Summary | none | from the source; see the pattern in [bug-creation.md](bug-creation.md) |
| Priority | `Medium` | `priority` |
| Assignee | Darshan | `assignee` (accountId) |
| Environment | `Production` always (QA, 2026-10-13: tickets then move to QA Approved, not Done). The environment where the bug was seen goes in the description Note as "Affected Environment - Staging" (or Production) | `additional_fields` |
| Epic Link | `AL-3982` for HubSpot integration bugs; for other integrations, search Jira and ask | `additional_fields` |
| QA | Dharmesh Patel | `additional_fields` (accountId) |
| Linked Work Items | sibling bugs + the workflow tracking ticket + parent ticket. Salesforce bugs always link AL-4131 first, then the trigger's tracking ticket (QA, 2026-10-21) | separate `createJiraIssueLink` call after creation |

Pass Environment, Epic Link, and QA by their label in `additional_fields`.
The MCP server resolves the `customfield_*` id itself (QA is
`customfield_10048`). The Environment and Epic Link ids are not recorded
yet; they are only needed for the REST API (see
[automation-mapping.md](automation-mapping.md)). Add them here once looked
up.

## HubSpot workflow tracking tickets

The parent is AL-3984 ("[HubSpot] Triggers and Activities, Exploration and
Test Cases"), with one sub-task per trigger. Production smoke summaries and
test case tables go on these sub-tasks. When another integration (for
example Salesforce) gets its own parent and sub-tasks, add a table like this
one for it. The same list, with each workflow's context file, is in
`context/hubspot/00-overview.md` (path from `automation/`); keep the two in
sync.

| Sub-task | Trigger |
|---|---|
| AL-4006 | Contact Created/Properties Updated in HubSpot |
| AL-4007 | Contact Updated in HubSpot |
| AL-4008 | Deal Created/Properties Updated in HubSpot |
| AL-4009 | Company Created/Properties Updated in HubSpot |
| AL-4010 | Email Sent from Saleshandy |
| AL-4011 | Reply is received in Saleshandy |
| AL-4012 | Prospect Outcome is updated in Saleshandy |
| AL-4013 | Sequence Email is opened in Saleshandy |
| AL-4014 | Link is Clicked in Saleshandy |
| AL-4015 | Prospect is Unsubscribed in Saleshandy |
| AL-4016 | Email is bounced in Saleshandy |
| AL-4017 | Import Prospect when contact created on Hubspot |

## Salesforce workflow tracking tickets

The parent is AL-4131 ("[SalesForce] Triggers and Activities"), with one
sub-task per workflow, titled with the workflow name. Table and release
dates: `context/salesforce/00-overview.md` (path from `automation/`); keep
the two in sync.

Every Salesforce bug links AL-4131 (the parent, "[SalesForce] Triggers and
Activities") first, then the sub-task of the trigger it was found on, for
example AL-4132 for Email Sent from Saleshandy (QA, 2026-10-21). In a draft
file the order is `"links": ["AL-4131", "AL-4132"]`; add siblings after them.

| Sub-task | Trigger |
|---|---|
| AL-4132 | Email Sent from Saleshandy |
| AL-4133 | Reply is Received in Saleshandy |
| AL-4134 | Prospect Outcome is Updated in Saleshandy |
| AL-4135 | Sequence Email is Opened in Saleshandy |
| AL-4136 | Link is Clicked in Saleshandy |
| AL-4137 | Prospect is Unsubscribed in Saleshandy |
| AL-4138 | Email is Bounced in Saleshandy |
| AL-4139 | Call Logged in Saleshandy |
| AL-4140 | Call Outcome Updated in Saleshandy |
| AL-4141 | Contact is Created in Salesforce |
| AL-4142 | Opportunity is Created in Salesforce |
| AL-4143 | Account is Created in Salesforce |
| AL-4144 | Lead is Created in Salesforce |

## `createJiraIssue` payload

```json
{
  "cloudId": "b6724b57-8729-4b0d-8177-ba62b6ab8da0",
  "projectKey": "AL",
  "issueType": "Bug",
  "summary": "<summary>",
  "priority": "Medium",
  "assignee": "5af5d8dd244bc90a10605d4f",
  "description": "<markdown from templates/bug-description.md>",
  "additional_fields": {
    "Environment": "Staging",
    "Epic Link": "AL-3982",
    "QA": "712020:c7dedb58-9cb3-4450-a98f-5b5b56f6556b"
  }
}
```

## Linking (after creation, one call per link)

Run through `executeWrite`:

```json
{
  "name": "createJiraIssueLink",
  "cloudId": "b6724b57-8729-4b0d-8177-ba62b6ab8da0",
  "inputs": { "linkType": "Relates", "inwardIssue": "<new key>", "outwardIssue": "<linked key>" }
}
```

## Comments

Use `addOrEditJiraIssueComment` with a markdown body. Pass the comment id to
edit an existing comment. To read comments, use `listJiraIssueComments` via
`executeRead`. The MCP cannot delete comments; the user deletes them by hand
in Jira.

## Release transitions (AL project, bug to Done after Production)

Use these only when the user asks. Every step is a Jira write and needs the
confirmation gate.

1. Post the Production deploy verified comment.
2. Transition **Approved for Release** (id `341`). This step shows the
   Resolution popup; set Resolution to `Fixed`.
3. Transition **Released** (id `351`). The ticket lands in Done.

If an id is rejected, list the issue's available transitions first and show
the user the list before trying anything else.

## Useful JQL

Replace `<SUBTASK>` with the workflow tracking ticket.

- All bugs for a workflow: `issue in linkedIssues(<SUBTASK>) AND issuetype = Bug`
- Waiting for QA: add `AND status = "READY FOR QA"`
- Still open: add `AND status = "To Do"`
- Closed in a week: add `AND status CHANGED TO Done DURING ("<monday>", "<saturday>")`
- Created in a week: add `AND created >= "<monday>" AND created < "<saturday>"`
- Possible duplicates: `project = AL AND issuetype = Bug AND text ~ "<activity name>" ORDER BY created DESC`
