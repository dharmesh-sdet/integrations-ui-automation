# Email is Bounced in Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Email is bounced in Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When a sequence email bounces for a prospect, the workflow runs the Pipedrive actions placed in the action slots.

## Rules specific to this workflow

- Lead title and deal title = prospect email.
- The document lists no bounce-specific rule for Pipedrive (no tag or flag on the person, unlike Zoho). All action rules are in `00-overview.md`.

## Set up before testing

Checks 1 to 5, 8 and 9 in `00-overview.md`.

## Unclear: expected functionality (proposed)

1. How a bounce is produced and how long until it registers: not documented. Proposed: same method as the HubSpot Email Bounced cases (`test-cases/hubspot/email-bounced.md`): mark the prospect's email as bounced in the sequence Emails tab (Mark as bounced), so no real bounce is sent; keep real bounces to the cap QA sets.
2. Whether the bounce changes anything on the Pipedrive person besides the activity: not documented. Proposed: no, only the actions in the slots run.
