# Sequence Email is Opened in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/email-is-opened-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a prospect opens a sequence email, the workflow runs the Zoho actions in the action slots.

## Rules and observed behavior

- Open tracking must be on in the sequence options. The first dev attempt failed because it was off. That is a setup gap.
- O1: a manual open made a contact and a note with Open Count 1.
- VO1: four manual opens made one contact and one deal. The deal search ran before the contact insert, so the deal was unlinked on that event.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- The Pipedrive Email Opened file `../pipedrive/email-opened.md` shows what QA tested there. Compare before you write cases.
- Opened and Link Clicked can both fire for one click.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
