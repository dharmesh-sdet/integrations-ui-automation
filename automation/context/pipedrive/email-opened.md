# Email is Opened in Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Email Open Recorded in Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When a prospect opens a sequence email, the workflow runs the Pipedrive actions placed in the action slots.

## Rules specific to this workflow

- Open tracking must be on in the sequence settings, otherwise no event is sent.
- Lead title and deal title = prospect email.
- All other action rules are in `00-overview.md`.

## Set up before testing

Checks 1 to 6, 8 and 9 in `00-overview.md`.

## Unclear: expected functionality (proposed)

1. How the open is produced and how long until it registers: not documented. Proposed: open the received email once in the prospect mailbox with images loaded, wait 15 seconds after the event shows in Saleshandy (QA 2026-10-23).
2. Whether mail clients that prefetch images cause extra runs: not documented. Proposed: treat extra runs like link scanner clicks (Saleshandy event behavior), unconfirmed.
3. Whether the activity note carries `Open Count`: not documented for Pipedrive (Zoho notes have it). Proposed: not asserted.
