# Email Sent from Saleshandy (Salesforce): Smoke scenarios

Draft, waiting for QA approval (2026-10-22). No script until QA says "looks good".

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4132 (parent AL-4131). Confirms the fix AL-4168 (Closing
date 0 Days can no longer be saved) on Production, plus the baseline of every activity. Built from
the Email Sent staging regression (`test-cases/salesforce/email-sent.md`), only rows QA confirmed
as passed on 2026-10-21. Covers all 10 activities in 10 rows. Attach Note is checked inside the Create a Contact and Create a
Lead rows, Record(log) an Email Activity inside the Update a Contact and Create a Opportunity rows.

Not covered, still open: none known for this trigger.

If the AL-4168 rows fail on Production, the fix is not deployed there yet. QA reopens AL-4168
(draft only, no Jira write from the script).

## Test data setup

- Own brand-new Mailinator prospect per row (unique name and email), added to the smoke
  sequence, then Emails tab > row > three dots > Send now. Rows with a send use step 1. 8 sends
  in all. The production account has two email accounts, Salesforce EmailSent SMTP Default (50 a day)
  and Rudra EmailSent SMTP (150 a day), read 2026-10-22.
- Records a row needs first (Lead, Contact, Account, Opportunities) are created by hand in
  Salesforce with the prospect's email (Company name for Account), with at least one value that
  differs from the prospect's.
- Check: after Send now wait 15 s, look in Salesforce. If missing, wait 5 s, hard refresh, look
  again. Only then open Logs. Error in Logs is reported to QA, not failed.
- Triggers: only "Email Sent from Saleshandy" on, only the activities named in the section
  selected, then Save in the modal and on the page. HubSpot triggers are not touched; QA confirms
  they are off.
- Field mapping (checked and fixed by the gate): Lead (First Name, Last Name, Email, Company,
  Phone, Job Title, Industry, Website, City, State, Country, Company Revenue, Company HQ
  Location), Contact (First Name, Last Name, Email, Phone to Business Phone, Department, City,
  State, Country, HQ Location, Photo URL), Account (Website, City, State,
  Country, Industry, Size, Revenue, Founded Year, Phone, HQ Location; Company is left unmapped,
  QA 2026-10-22, so the Account is named with the prospect's First Name and Last Name),
  Opportunity (Prospect Overview to Description, Deal Value to Amount, Closing Date to Close Date).

## Gate check (runs first, in the same command)

- Open the saved Saleshandy session, go to API & Integrations > Integrations > Salesforce.
- If the tab shows Re-connect: stop, no rows run, QA is notified to reconnect.
- If connected: compare Field Mapping for Lead, Contact, Account and Opportunity with the list
  above. Add every missing mapping, Save, reload, compare again.
- Gate passes only when all four objects match after the reload. Any leftover difference stops
  the run and is listed in the report.

## Sequence setup (runs after the gate, same command)

- Create a new sequence "Salesforce Email Sent Smoke <date>" with one email step.
- Settings > Email Account > add both email accounts, then activate the sequence.
- Run again the same day, the same sequence is reused (email accounts and activation are checked).

## Create a Account in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Company, Website, City, State, Country filled, no Account named like the prospect's full name | Send now on step 1 | Success. One more Account named like the prospect's full name (First Name Last Name), with Website, Billing City, Billing State/Province, Billing Country from the prospect | None |

## Update a Account in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account named like the prospect's full name exists with a different Phone and City | Send now on step 1 | Success. One Account. Mapped values show the prospect's | None |

## Create a Contact in Salesforce

Extra Configuration: None. Attach Note also selected.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with First Name, Last Name, Email, Phone, Department, City, Job Title, Company filled, not in Salesforce | Send now on step 1 | Success. One Contact with Name, Email, Business Phone, Department, Other City from the prospect. Title and Account Name empty. No Lead created. One Note on the Contact, text recorded: Step, Variant, Prospect Outcome | None |

## Update a Contact in Salesforce

Extra Configuration: None. Record(log) an Email Activity also selected, Select Object = Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists with a different Phone and Department | Send now on step 1 | Success. One Contact, Business Phone and Department show the prospect's values. One email on the Contact timeline, From, To, Subject and body recorded | None |

## Create a Lead in Salesforce

Extra Configuration: None. Attach Note also selected.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with First Name (accented), Last Name (apostrophe), Email, Phone, Job Title, Company, City filled, not in Salesforce | Send now on step 1 | Success within 3 min. Exactly one Lead with the mapped values as entered. Lead Status "Open - Not Contacted". One Note on the Lead, text recorded | None |

## Update a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead with the prospect's email exists with a different Job Title, Phone and Company | Send now on step 1 | Success. Still one Lead. Title, Phone and Company show the prospect's values | None |

## Create a Opportunity in Salesforce

Extra Configuration: Stage = Prospecting, Closing date = 1 Day. Record(log) an Email Activity
also selected on row 1, Select Object = Opportunity and Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, no Opportunity, prospect has Deal Value 5000 | Send now on step 1 | Success. One Opportunity named with the prospect's email, Stage Prospecting, Close Date today + 1, Amount 5000, tied to the Contact. The email shows on the Opportunity and the Contact | None |
| 2 | Extra Configuration modal open | Enter 0 in Closing date | The field turns red and Save in the modal is disabled. 0 Days cannot be saved | AL-4168 |

## Update a Opportunity in Salesforce

Extra Configuration: Stage = Qualification, Closing date = 2 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 3 Opportunities, each made from the Contact's Opportunities list (the Contact is its Contact Role) | Send now on step 1 | The latest Opportunity shows Stage Qualification and Close Date today + 2. The other two are unchanged. The Contact still has 3 | None |
| 2 | Extra Configuration modal open | Enter 0 in Closing date | The field turns red and Save in the modal is disabled. 0 Days cannot be saved | AL-4168 |
