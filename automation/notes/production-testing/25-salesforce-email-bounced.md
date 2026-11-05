# Email is Bounced in Saleshandy (Salesforce): Smoke scenarios

Approved by QA 2026-11-05. Script written and typechecked, not run.

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4138 (parent AL-4131). The only fixed ticket for this
trigger is AL-4168 (Closing date 0). This is a baseline check of every activity plus the
AL-4168 field check. The developer's v2 and v3 fixes (empty-body reads, Phone, apostrophe,
update-opportunity, newest Opportunity) are covered by the baseline rows. Built from the 34
staging rows (`test-cases/salesforce/email-bounced.md`, all passed at least once on 2026-11-05).
9 checks, 1 send (check 1, real bounce).

Not covered, still open: the step 2 bounce, the paused sequence row, the Lead-exists and
Contact-exists variations, the no-match rows and the second real-bounce row. One real bounce can
create two Bounced Logs entries, one Success and one Error (DUPLICATES_DETECTED on Create a Lead),
as on HubSpot. If one entry is Success, check 1 passes. The Error goes to QA. Create a
Opportunity makes a new Opportunity on every event (accepted). Create a Contact next to a Lead with
the same email can give DUPLICATES_DETECTED (accepted).

If a check fails on Production, QA decides if it is a bug. Draft only, the script writes no
Jira item.

## Test data setup

- Each row has its own new Mailinator prospect with a unique name and email. Names that earlier runs
  used for Accounts are not reused, because Create a Account finds an Account by full name and
  creates nothing.
- Checks 2 to 8 (manual): add the prospect to the sequence, then Emails tab > row > Actions > Mark as
  bounced. Send now is not needed. The row reads Hard Bounced. A manual bounce has no bounce reason,
  so "Bounce Reason" stays blank.
- Check 1 (real bounce): address `name@<company>.mailinator.com` (QA, 2026-11-05). Use the row's three
  dots > Send now on step 1 and wait until the Emails tab shows Bounced.
- After the bounce, wait 15 s and look in Salesforce first. If the record is missing, wait 5 s, hard
  refresh and look again. Open Logs only then. A Logs Error goes to QA and is not counted as a failure.
- A record a row needs first is created by hand in Salesforce with the prospect's email. At least one
  value differs. Existing records are never edited.
- Runs alone on `emailopenedprod` (QA, 2026-11-05). Only the Email is Bounced trigger is on, with
  only the activities named in the row. Every other trigger is switched off. Save in the modal and on
  the page. Read the saved activities back after a reload.
- The gate runs first (Salesforce connected, Field Mapping complete). For the Opportunity rows, the
  run unmaps Closing Date first, as in notes 23 and 24.
- A setup spec creates "Salesforce Email Bounced Smoke <date>" with two email steps, adds the listed
  senders (with room in the daily limit) and activates it. It runs only with `SETUP_SMOKE_SEQUENCE=1`.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Create a Lead (baseline, real bounce) | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City, real-bounce address. Not in Salesforce | Send now on step 1 and wait for the real bounce | Emails tab shows Bounced. At least one Logs row Success. One Lead with the mapped values as entered, Status "Open - Not Contacted" | None |
| 2 | Update a Lead + Record(log) an Email Activity | Update a Lead and Record(log) with Select Object "Lead" selected. A Lead with the prospect's email exists with an old Job Title, Phone and Company | Mark as bounced | Success. Still one Lead, mapped fields show the prospect's values. One completed Email Task on the Lead. Record Subject and body | None |
| 3 | Create a Contact + Attach Note | New prospect with Phone, Department, City. Not in Salesforce. Create a Contact and Attach Note selected | Mark as bounced | Success. One Contact with Name, Email, Business Phone, Department, Other City. No Lead. One Note on the Contact, Bounce Reason blank. Record the Note text | None |
| 4 | Update a Contact | A Contact with the prospect's email exists with an old Phone and Department | Mark as bounced | Success. One Contact. Both fields show the prospect's values | None |
| 5 | Create a Account | New prospect with Website, City, State, Country and a full name no earlier run used. No such Account | Mark as bounced | Success. One Account named with the prospect's full name, with Billing City, State, Country and Website | None |
| 6 | Update a Account | An Account named with the prospect's full name exists with an old Phone and City | Mark as bounced | Success. One Account. Mapped values show the prospect's | None |
| 7 | Create a Opportunity | New prospect with Deal Value 12000. Contact exists. Closing date 7 days, Stage "Prospecting" | Mark as bounced | Success. One Opportunity named with the prospect's email, linked to the Contact, Close Date 7 days out, Stage "Prospecting", Amount 12,000.00 | None |
| 8 | Update a Opportunity | The Contact has 3 Opportunities named with the prospect's email. Closing date 14 days, Stage "Qualification" | Mark as bounced | Only the newest changes: Stage "Qualification", Close Date 14 days out. The other two are unchanged | None |
| 9 | Closing date field (no send) | Open the Create a Opportunity modal | Type 0 in Closing date in Days | Field turns red, Save is disabled. Same check on Update a Opportunity | AL-4168 |
