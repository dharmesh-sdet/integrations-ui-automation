# Email Sent from Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Email sent from Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When a sequence email is sent to a prospect, the workflow runs the Pipedrive actions placed in the action slots.

## Rules specific to this workflow

- Create a Person adds an activity on the person (type `email`, done) whose note contains the full email body.
- Update a Person adds an activity on the person that does NOT contain the email body.
- Lead title and deal title = prospect email.
- Create a Person + Update a Person selected together: the person gets 2 activities for one event.
- All other action rules (shared person step, newest deal, organization matching, errors without a person) are in `00-overview.md`.

## Set up before testing

Checks 1 to 4, 5, 8 and 9 in `00-overview.md`. A new prospect email per scenario. Mappings saved for Contact, Deal and Organisation fields.

## Unclear: expected functionality (proposed)

1. How long a sent email takes to reach Pipedrive, and how the send is done in the UI: not documented. Proposed: send from an active sequence with a new prospect, wait until the Emails tab row shows Sent, then 15 seconds, check Pipedrive first (QA 2026-10-23).
2. Whether the email body in the activity keeps formatting or the `\"` double escape: the escape is a known issue, kept by decision. Proposed: assert that the body text is present, not its HTML.
