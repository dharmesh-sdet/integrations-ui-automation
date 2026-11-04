# Reply is Received in Saleshandy (Salesforce): Smoke scenarios

Approved by QA 2026-11-04. Script not written yet.

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4133 (parent AL-4131). No bug ticket exists for this
trigger, so this is a baseline check of every activity. The workflow is not published on
production yet (QA, 2026-11-04), so QA runs the script after it is published. Built from the 37 staging rows QA
approved on 2026-11-04 (`test-cases/salesforce/reply-received.md`). 10 checks, one per activity,
10 sends.

Not covered, still open: the Note holds no reply text (accepted). The Note sequence link uses the
production host. A second reply, the empty-mapping Lead and the no-match rows are not in this
smoke.

If a check fails on Production, QA decides if it is a bug. Draft only, the script writes no
Jira item.

## Test data setup

- Each row has its own new Mailinator prospect with a unique name and email. The prospect goes
  into the smoke sequence. On the Emails tab, use the row's three dots > Send now for step 1.
  Wait until step 1 shows Sent, then Mark as replied from the Emails tab.
- A record a row needs first (Lead, Contact, Account, Opportunity) is created by hand in
  Salesforce with the prospect's email. At least one value differs from the prospect's. Existing
  Salesforce records are never edited.
- After Mark as replied, wait 15 s and look in Salesforce. If the record is missing, wait 5 s,
  hard refresh and look again. Only then open Logs. A Logs Error goes to QA and is not counted as
  a failure.
- Runs in parallel with other smoke runs on `emailopenedprod` (QA, 2026-11-04): other triggers are left as they are (`KEEP_OTHER_TRIGGERS=1`). Only the Reply Received trigger of this run is set, with only the activities named in the section. Save in
  the modal and on the page. Check the chips again after each save.
- The gate runs first. It checks that Salesforce is connected and that the Field Mapping matches.
  For the Opportunity rows, the gate unmaps Closing Date and restores it after, as on staging.
- A setup spec creates "Salesforce Reply Received Smoke <date>" with one email step, adds both
  listed senders and activates it. It runs only with `SETUP_SMOKE_SEQUENCE=1`.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Create a Lead | New prospect with accented First Name, apostrophe in Last Name, Email, Phone, Job Title, Company and City filled. Not in Salesforce | Mark as replied | Success within 3 min. Exactly one Lead with the 7 mapped values as entered | None |
| 2 | Update a Lead | A Lead with the prospect's email exists with an old Job Title, Phone and Company | Mark as replied | Success. Still one Lead. The mapped fields show the prospect's values | None |
| 3 | Create a Contact | New prospect with phone, department and city filled. Not in Salesforce | Mark as replied | Success. One Contact with Name, Email, Business Phone, Department and Other Address. Title and Account Name empty. No Lead | None |
| 4 | Update a Contact | A Contact with the prospect's email exists with an old Phone and Department, and has a Title | Mark as replied | Success. One Contact. Business Phone and Department show the prospect's values. Title is unchanged | None |
| 5 | Create a Account | New prospect with Company, phone and city. No such Account | Mark as replied | Success. One Account with the mapped Company, phone and city. Record the Account Name for QA | None |
| 6 | Update a Account | An Account named with the prospect's full name exists with an old Phone and City | Mark as replied | Success. One Account. The mapped values show the prospect's | None |
| 7 | Create a Opportunity | New prospect with Deal Value 12000. Nothing in Salesforce. Closing date 7 days, Stage "Prospecting" | Mark as replied | Success. One Contact and one Opportunity linked to it. Close Date 7 days out, Stage "Prospecting", Amount 12000 | None |
| 8 | Update a Opportunity | Two Opportunities are named with the prospect's email, both in "Qualification". Closing date 14 days, Stage "Negotiation/Review" | Mark as replied | Only the newest changes: Stage "Negotiation/Review", Close Date 14 days out. The older one is unchanged | None |
| 9 | Attach Note (with Create a Contact) | New prospect with outcome "Add Outcome". Create a Contact and Attach Note are selected | Mark as replied | Success. One Contact and one Note. Title "reply-received", Body with sequence, step, sender and email details. No reply text (accepted) | None |
| 10 | Record(log) an Email Activity | Select Object "Contact". A Contact with the prospect's email exists | Mark as replied | Success. One completed Email Task linked to the Contact. Description and "Email body:" can be empty (accepted) | None |
