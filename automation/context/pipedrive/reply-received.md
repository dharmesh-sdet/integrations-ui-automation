# Reply is Received in Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Reply is Received in Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When Saleshandy detects a reply from a prospect, the workflow runs the Pipedrive actions placed in the action slots.

## Rules specific to this workflow

- Lead title and deal title = `First Name Last Name`. All other workflows use the email. Decided by QA.
- Update a Deal sets the deal title to the email, so it renames a deal that this workflow created with the person name. Naming was kept by decision.
- The activity type is `Email` (capital E). Other workflows use `email`. Both show as an email activity.
- The prospect must show as replied in Saleshandy. If Saleshandy did not detect the reply, no event goes to Pipedrive.
- All other action rules are in `00-overview.md`.

## Set up before testing

Checks 1 to 5, 7, 8 and 9 in `00-overview.md`.

## Unclear: expected functionality (proposed)

1. How the reply is produced in the UI and how long until Saleshandy detects it: not documented. Proposed: reply from the prospect mailbox to a sent sequence email, wait until the prospect shows as replied, then 15 seconds, check Pipedrive first (QA 2026-10-23).
2. Which shared person name is used when the prospect has no first or last name: `(No Name)` is documented for the person. Proposed: the lead and deal title fall back to the same empty-name behavior, unconfirmed.
