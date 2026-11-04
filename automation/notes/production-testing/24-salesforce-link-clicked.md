# Link is Clicked in Saleshandy (Salesforce): Smoke scenarios

Approved by QA 2026-11-04. Script written, not run.

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4136 (parent AL-4131). The only fixed ticket for this
trigger is AL-4168 (Closing date 0). This is a baseline check of every activity plus the
AL-4168 field check. The developer's v2 and v3 fixes (empty-body reads, Phone, apostrophe,
update-opportunity, newest Opportunity) are covered by the baseline rows. Built from the 34
staging rows QA approved on 2026-11-04 (`test-cases/salesforce/link-clicked.md`). 11 checks,
10 sends, one click on link 1 per send.

Not covered, still open: a second click, the step 2 click, the Lead-exists and Contact-exists
variations, the no-match rows and the Track link clicks off row. Create a Opportunity makes a new
Opportunity on every click (accepted). Create a Contact next to a Lead with the same email can give
DUPLICATES_DETECTED (accepted).

If a check fails on Production, QA decides if it is a bug. Draft only, the script writes no
Jira item.

## Test data setup

- Each row has its own new Mailinator prospect with a unique name and email. Use the row's three
  dots > Send now for step 1. Wait until step 1 shows Sent.
- Wait 90 s after the send, then click link 1 in the Mailinator email (developer, 2026-10-15: a
  click made earlier is not counted). Make sure that the Clicked count goes to 1. Wait 15 s and
  look in Salesforce first. If the record is missing, open Logs. A Logs Error goes to QA and
  is not counted as a failure.
- A record a row needs first is created by hand in Salesforce with the prospect's email. At least
  one value differs. Existing records are never edited.
- Runs alone on `emailopenedprod`, after the Salesforce Reply Received and Email Opened pair (QA,
  2026-11-04). A click also counts as an open, so only the Link is Clicked trigger is on, with only
  the activities named in the row. Every other trigger is switched off. Save in the modal and on
  the page. Read the saved activities back after a reload.
- The gate runs first (Salesforce connected, Field Mapping complete). For the Opportunity rows, the
  run unmaps Closing Date first, as on staging and in note 23.
- A setup spec creates "Salesforce Link Clicked Smoke <date>" with one email step that holds two
  links, Track link clicks on and Track email opens off, adds the listed senders and activates it.
  It runs only with `SETUP_SMOKE_SEQUENCE=1`.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Create a Lead (baseline) | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City. Not in Salesforce | Click link 1 | Clicked is 1. One Logs row Success. One Lead with the mapped values as entered, Status "Open - Not Contacted" | None |
| 2 | Update a Lead | A Lead with the prospect's email exists with an old Job Title, Phone and Company | Click link 1 | Success. Still one Lead. Mapped fields show the prospect's values | None |
| 3 | Create a Contact | New prospect with Phone, Department, City. Not in Salesforce | Click link 1 | Success. One Contact with Name, Email, Business Phone, Department, Other City. No Lead | None |
| 4 | Update a Contact | A Contact with the prospect's email exists with an old Phone and Department | Click link 1 | Success. One Contact. Both fields show the prospect's values | None |
| 5 | Create a Account | New prospect "Priya Nair" with Website, City, State, Country. No such Account | Click link 1 | Success. One Account named "Priya Nair" with Billing City, State, Country and Website | None |
| 6 | Update a Account | An Account named with the prospect's full name exists with an old Phone and City | Click link 1 | Success. One Account. Mapped values show the prospect's | None |
| 7 | Create a Opportunity | New prospect with Deal Value 12000. Contact exists. Closing date 7 days, Stage "Prospecting" | Click link 1 | Success. One Opportunity named with the prospect's email, linked to the Contact, Close Date 7 days out, Stage "Prospecting", Amount 12,000.00 | None |
| 8 | Update a Opportunity | The Contact has 3 Opportunities named with the prospect's email. Closing date 14 days, Stage "Qualification" | Click link 1 | Only the newest changes: Stage "Qualification", Close Date 14 days out. The other two are unchanged | None |
| 9 | Attach Note (with Create a Contact) | New prospect. Create a Contact and Attach Note selected | Click link 1 | Success. One Contact and one Note on it with Click Count 1 and the link. Record the Note text | None |
| 10 | Record(log) an Email Activity | Select Object "Contact". A Contact with the prospect's email exists | Click link 1 | Success. One completed Email Task on the Contact. Description shows Click Count and Link Clicked. Record Subject and body | None |
| 11 | Closing date field (no send) | Open the Create a Opportunity modal | Type 0 in Closing date in Days | Field turns red, Save is disabled. Same check on Update a Opportunity | AL-4168 |
