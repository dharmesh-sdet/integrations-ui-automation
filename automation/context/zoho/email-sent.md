# Email Sent from Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/email-sent-from-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a sequence email is sent to a prospect, the workflow runs the Zoho actions placed in the action slots.

## Rules and observed behavior

- All five actions apply: Account, Contact, Lead, Deal, Task. Rules for each are in `00-overview.md`.
- Developers ran the most scenarios here (E1 to E12, D1 to D6, T1, T2, F1 to F8, G1 to G7). The other six workflows use the same branch logic.
- Account only: the account name is the prospect company. A second event updates the same account and adds a second note.
- Contact: a pre-existing contact is updated and its Phone and Title are kept. No duplicate contact.
- Lead: a prospect with no company still gets a lead, without Company.
- Deal: Closing Date is today plus the "Deal Closing date" number. Empty means no closing date. Stage that someone changed by hand stays.
- Deal for a contact with two linked deals: the newest deal is updated and the older one is untouched.
- Task for a prospect with no Zoho contact: the contact is created first, then the task is linked to it. Empty Subject skips the task and its note.
- All five actions together on a new prospect: one contact, and the task and deal link to it on the first event.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- Prospects are `rudra+zoho-<scenario>@saleshandy.com` in the logs. Use your own addresses.
- Z-1: a mistyped mapped value (Company Size "11-50", a Twitter URL, a date with a time) fails the whole record.
- Z-5: a deal and an account together can give two accounts.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
