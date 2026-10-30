# Prospect is Unsubscribed in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/prospect-is-unsubscribed-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a prospect unsubscribes, the workflow runs the Zoho actions in the action slots, then adds the tag Unsubscribed-Saleshandy to the contact.

## Rules and observed behavior

- U1: a new contact gets the real phone, a note and the tag.
- U2: the tag replaces the existing tag VIP (Z-6). The phone was kept.
- U3: all five actions together worked.
- VU1: an existing contact with a linked deal in Stage Needs Analysis. The contact and tag were updated, and the deal was updated by id with the Stage kept.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- Z-6 applies. Do not file it again.
- Do not unsubscribe prospects of other testers.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
