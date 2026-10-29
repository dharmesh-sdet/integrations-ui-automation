# Reply is Received in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/reply-received-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a prospect replies to a sequence email, the workflow runs the Zoho actions in the action slots.

## Rules and observed behavior

- Developer scenarios: R1 (account and contact with notes) and VR1 (account updated with no duplicate, contact updated, deal created and linked, notes added).
- Saleshandy must detect the reply first. In one run a reply was never detected (the prospect had no reply time). That was the Saleshandy reply tracker, not the workflow.
- A reply also fires the Conversation Category workflow. With the gate false, nothing else ran.
- Test rule from the dev kit: a manual reply from the prospect mailbox is the real trigger.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- The Pipedrive reply file in `../pipedrive/reply-received.md` has the activity variants QA tested. Compare before you write cases.
- Z-1 and Z-5 apply.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
