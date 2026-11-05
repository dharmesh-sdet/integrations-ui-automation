# Prospect is Unsubscribed in Saleshandy (Salesforce): Smoke scenarios

Approved by QA 2026-11-05. Script written, not run.

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4137 (parent AL-4131). The only fixed ticket for this
trigger is AL-4168 (Closing date 0). Jira shows no other linked bug on AL-4137. This is a baseline
check of every activity plus the AL-4168 field check. Built from the 32 staging rows
(`test-cases/salesforce/prospect-unsubscribed.md`, 30 of 30 automated rows passed at least once on
2026-11-05). 9 checks, 8 sends (checks 1 to 8, one send each).

Not covered, still open: Mark as Unsubscribe (the staging result is not recorded), the second
open of the same link, Subscribe here, the step 2 and two-sequence rows, the replied-then-unsubscribed
row, Create a Opportunity with empty Extra Configuration (not valid on the staging account), the
Record(log) an Email Activity row (one staging row only, left out by QA's default) and the Email Opt
Out field. Known and accepted: "Manually Unsubscribed?" in the Note stays blank (dev kit F-1). A
prospect in no sequence fires no event (F-3, by design). Create a Contact next to a Lead with the same
email can give DUPLICATES_DETECTED. Create a Opportunity makes a new Opportunity on every event.

The Logs tab is never opened (QA, 2026-11-05). A record still missing after 3 minutes goes to QA and
QA decides if it is a bug. Draft only, the script writes no Jira item.

## Test data setup

- Each check has its own new Mailinator prospect `firstname.lastname.<tag>@mailinator.com` with a unique
  name. Names that earlier runs used for Accounts are not reused, because Create a Account finds an Account
  by full name and creates nothing. The names differ from the Email is Bounced smoke names, so the two can run together.
- Checks 1 to 8: add the prospect to the sequence, Send now on step 1, wait until the Emails tab shows Sent.
  Wait 93 s after the send, open the step 1 email in Mailinator and click "Unsubscribe here". The page says
  "You will no longer receive emails from us". The Prospects tab shows Unsubscribed. Every check unsubscribes
  by the real link.
- After the unsubscribe, wait 15 s and look in Salesforce, then every 10 s for up to 3 minutes. Open no Logs.
- A record a check needs first is created by hand in Salesforce with the prospect's email. At least one value
  differs. Existing records are never edited.
- Triggers: "Prospect is Unsubscribed in Saleshandy" is on with only the activities named in the check. Save in
  the modal and on the page. Read the saved activities back after a reload. Other triggers are left as found
  (KEEP_OTHER_TRIGGERS), so Email is Bounced can run beside it. If Email Sent, Email Opened or Link Clicked is on,
  the check stops before the send. QA turns it off.
- The gate runs first (Salesforce connected, Field Mapping complete). For the Opportunity checks, the run
  unmaps Closing Date first and maps it back after check 8, as in notes 23, 24 and 25.
- A setup spec creates "Salesforce Prospect Unsubscribed Smoke <date>" with two email steps (a one-step sequence
  turns a prospect Completed and the link does not register), saves "Unsubscribe as Link" in Sequence Settings >
  Unsubscribe, adds a listed sender (with room in the daily limit) and activates it. It runs only with
  `SETUP_SMOKE_SEQUENCE=1`.
- Runs beside Email is Bounced (note 25) with `npm run smoke:salesforce-bounced-unsubscribed-pair`. Both runs
  unmap and map Closing Date on the same Opportunity mapping, so an Opportunity failure in a pair run is read
  as a possible clash first.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Create a Lead (baseline) | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City. Not in Salesforce | Open the real unsubscribe link | Prospects tab shows Unsubscribed. One Lead with the mapped values as entered, Status "Open - Not Contacted" | None |
| 2 | Update a Lead | A Lead with the prospect's email exists with an old Job Title, Phone and Company | Open the real link | Still one Lead, mapped fields show the prospect's values | None |
| 3 | Create a Contact + Attach Note | New prospect with Phone, Department, City. Not in Salesforce | Open the real link | One Contact with Name, Email, Business Phone, Department, Other City. No Lead. One Note on the Contact, record the Note text | None |
| 4 | Update a Contact | A Contact with the prospect's email exists with an old Phone and Department | Open the real link | One Contact, both fields show the prospect's values | None |
| 5 | Create a Account | New prospect with Website, City, State, Country and a full name no earlier run used. No such Account | Open the real link | One Account named with the prospect's full name, with Billing City, State, Country and Website | None |
| 6 | Update a Account | An Account named with the prospect's full name exists with an old Phone and City | Open the real link | One Account, mapped values show the prospect's | None |
| 7 | Create a Opportunity | New prospect with Deal Value 12000. Contact exists. Closing date 7 days, Stage "Prospecting" | Open the real link | One Opportunity named with the prospect's email, linked to the Contact, Close Date 7 days out, Stage "Prospecting", Amount 12,000.00 | None |
| 8 | Update a Opportunity | The Contact has 3 Opportunities named with the prospect's email. Closing date 14 days, Stage "Qualification" | Open the real link | Only the newest changes: Stage "Qualification", Close Date 14 days out. The other two are unchanged | None |
| 9 | Closing date field (no send) | Open the Create a Opportunity modal | Type 0 in Closing date in Days | Field turns red, Save is disabled. Same check on Update a Opportunity | AL-4168 |
