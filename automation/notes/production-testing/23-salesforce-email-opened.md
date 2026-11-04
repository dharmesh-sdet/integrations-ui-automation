# Sequence Email is Opened in Saleshandy (Salesforce): Smoke scenarios

Approved by QA 2026-11-04. Script written, not run.

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4135 (parent AL-4131). No bug ticket exists for this
trigger except AL-4168 (Closing date 0), so this is a baseline check of every activity plus the
AL-4168 field check. The developer's v2 fixes (empty-body reads, Phone, apostrophe, update-opportunity)
are covered by the baseline rows. Built from the 31 staging rows QA approved on 2026-11-04
(`test-cases/salesforce/email-opened.md`). 11 checks, 10 sends.

Not covered, still open: a second open, the Lead-exists and Contact-exists variations, the no-match
rows and the step 2 open. Create a Opportunity makes a new Opportunity on every open (accepted).
Create a Contact next to a Lead with the same email can give DUPLICATES_DETECTED (accepted).

If a check fails on Production, QA decides if it is a bug. Draft only, the script writes no Jira item.

## Test data setup

- Each row has its own new Mailinator prospect with a unique name and email. Use the row's three
  dots > Send now for step 1. Wait until step 1 shows Sent.
- Wait 60 s after the send, then open the email in Mailinator. Make sure that the Opened count goes
  to 1. Wait 15 s and look in Salesforce first. Open Logs only if the record is missing. A Logs Error
  goes to QA and is not counted as a failure.
- A record a row needs first is created by hand in Salesforce with the prospect's email. At least one
  value differs. Existing records are never edited.
- Runs in parallel with the Salesforce Reply Received smoke on `emailopenedprod` (QA, 2026-11-04):
  other triggers are left as they are (`KEEP_OTHER_TRIGGERS=1`). Only the Email Opened trigger of this
  run is set, with only the activities named in the row. Save in the modal and on the page.
- The gate runs first (Salesforce connected, Field Mapping complete). For the Opportunity rows, the
  run unmaps Closing Date first, as on staging. The Reply Received run maps it again at its end.
- A setup spec creates "Salesforce Email Opened Smoke <date>" with one email step, Track email opens on
  and Track link clicks off, adds the listed senders and activates it. It runs only with
  `SETUP_SMOKE_SEQUENCE=1`.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Create a Lead (baseline) | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City. Not in Salesforce | Open the email | Opened is 1. One Logs row Success. One Lead with the mapped values as entered, Status "Open - Not Contacted" | None |
| 2 | Update a Lead | A Lead with the prospect's email exists with an old Job Title, Phone and Company | Open the email | Success. Still one Lead. Mapped fields show the prospect's values | None |
| 3 | Create a Contact | New prospect with Phone, Department, City. Not in Salesforce | Open the email | Success. One Contact with Name, Email, Business Phone, Department, Other City. No Lead | None |
| 4 | Update a Contact | A Contact with the prospect's email exists with an old Phone and Department | Open the email | Success. One Contact. Both show the prospect's values | None |
| 5 | Create a Account | New prospect "Priya Nair" with Website, City, State, Country. No such Account | Open the email | Success. One Account named "Priya Nair" with Billing City, State, Country and Website | None |
| 6 | Update a Account | An Account named with the prospect's full name exists with an old Phone and City | Open the email | Success. One Account. Mapped values show the prospect's | None |
| 7 | Create a Opportunity | New prospect with Deal Value 12000. Contact exists. Closing date 7 days, Stage "Prospecting" | Open the email | Success. One Opportunity named with the prospect's email, linked to the Contact, Close Date 7 days out, Stage "Prospecting", Amount 12000 | None |
| 8 | Update a Opportunity | Contact has 3 Opportunities named with the prospect's email. Closing date 14 days, Stage "Qualification" | Open the email | Only the newest changes: Stage "Qualification", Close Date 14 days out. The other two are unchanged | None |
| 9 | Attach Note (with Create a Contact) | New prospect. Create a Contact and Attach Note selected | Open the email | Success. One Contact and one Note on it. Record the Note text | None |
| 10 | Record(log) an Email Activity | Select Object "Contact". A Contact with the prospect's email exists | Open the email | Success. One completed Email Task on the Contact. Record Subject and body | None |
| 11 | Create a Opportunity, Closing date field (no send) | Open the Create a Opportunity modal | Type 0 in Closing date in Days | Field turns red, Save is disabled. Same check on Update a Opportunity | AL-4168 |
