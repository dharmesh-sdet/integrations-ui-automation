# Prospect is Unsubscribed in Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Prospect is Unsubscribed in Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When a prospect is unsubscribed in Saleshandy, the workflow runs the Pipedrive actions placed in the action slots.

## Rules specific to this workflow

- In one earlier pass this workflow still ran the old v1 definition. Read the node names in the run log before testing: v1 shows "Find a deal" and "Create a person"; v2 shows "Find person's latest deal" and "Person - Find a person". A v1 result is a setup gap, not a v2 bug.
- Lead title and deal title = prospect email.
- The document lists no unsubscribe-specific rule for Pipedrive (no tag or flag on the person, unlike Zoho). All action rules are in `00-overview.md`.

## Set up before testing

Checks 1 to 5, 8 and 9 in `00-overview.md`.

## Unclear: expected functionality (proposed)

1. How the unsubscribe is produced in the UI and how long until it registers: not documented. Proposed: use the same trigger method as the HubSpot unsubscribed cases (`test-cases/hubspot/unsubscribed.md`), wait 15 seconds after the event shows in Saleshandy (QA 2026-10-23).
2. Whether the unsubscribe changes anything on the Pipedrive person besides the activity: not documented. Proposed: no.
3. Whether the live staging workflow is now v2: not confirmed. Proposed: confirm from the run log before the first scenario.
