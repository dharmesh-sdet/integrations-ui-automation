# Reply is Received in Saleshandy: all activities, Regression plan

For QA review. Not scripted. Supersedes `reply-received.md` (16 rows) and
`reply-received-other-activities-proposal.md` (12 rows) once approved; both stay
until then. Environment: Staging (pyxis.lifeisgoodforlearner.com). Account
`sfreplyreceived`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4133
(parent AL-4131). No sub-bugs, so Ticket is None for every row.

Scope: every activity the trigger offers (10): Create and Update for Account,
Contact, Lead and Opportunity, Attach Note, Record(log) an Email Activity.
Each activity has 3 to 4 rows a person can prepare and check by hand. Rows marked
**(proposed, unconfirmed)** have an Expected result that is neither documented nor
seen. Run them and record what happens; a different result is not automatically a
failure.

## What changed from the written rows

- Create a Lead: 13 rows cut to 4. Dropped: Lead Status mapped (needs a Saleshandy
  field QA has not named), Owner (folded into row 3), Only Last Name and Email
  mapped, Lead and Contact with same email as separate rows (folded into row 4),
  mapping change mid-run (long, changes shared setup).
- Update a Lead, Create a Contact, Attach Note: kept, trimmed to the realistic
  rows, with the pilot results of 2026-10-20 in Expected.
- New: Update a Contact, Create an Account, Update an Account, Create and Update
  an Opportunity, Record(log) an Email Activity, two combined-activity rows.

## Test data setup

- Own brand-new prospect per row (unique name and email), added to the launched
  sequence with Add Prospects. Wait for step 1 Sent, then Mark as Replied (Emails
  tab > row > three dots).
- Records a row needs first (Lead, Contact, Account, Opportunity) are created in
  the Salesforce UI with the prospect's email (or company name, for Account), with
  at least one value that differs from the prospect's.
- Check (QA, 2026-10-20): after Mark as Replied wait 15 s, look in Salesforce. If
  missing, wait 5 s, hard refresh, look again. Only then open Logs. Error in Logs
  is reported to QA, not failed. Attach Note rows are checked from Logs first,
  then the Note in Salesforce.
- Triggers: every other trigger off. For each section keep only the activities
  named in its heading selected, then Save.
- Field mapping: Lead (7 fields) and Contact (as seen 2026-10-20) are saved.
  **Account and Opportunity property mapping has not been opened yet.** Their rows
  stay proposed until it is.
- Extra Configuration seen 2026-10-21: Create and Update an Opportunity have
  "Closing date" in Days and "Opportunity Stage" (Prospecting, Qualification, Needs
  Analysis, Value Proposition, Id. Decision Makers, Perception Analysis,
  Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost). Record(log)
  an Email Activity has "Select Object" (Lead, Opportunity, Contact). The other
  activities have none.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger on, activity list unopened | Open the activity dropdown and pick "Create a Lead in Salesforce" (do not Save) | Dropdown lists 10 activities. A chip with x shows the pick. No Extra Configuration opens | None |
| 2 | Every other trigger off, only "Create a Lead in Salesforce" selected | Click Save, reload | Success message shows. Toggle is on and the chip persists after reload | None |
| 3 | Lead Properties mapping empty (Save disabled) | Map the 7 fields, Save, reload | Mapping saved and persists after reload | None |
| 4 | Trigger turned off and saved | Mark as Replied | No Logs entry after 3 min. No record in Salesforce | None |

## Create a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with First Name (accented), Last Name (apostrophe), Email, Phone, Job Title, Company, City filled, not in Salesforce | Mark as Replied | Success within 3 min. Exactly one Lead with the 7 mapped values exactly as entered | None |
| 2 | New prospect with no Company | Mark as Replied | Logs status recorded. If Success: one Lead and its Company value recorded. If Error: no Lead **(proposed, unconfirmed)** | None |
| 3 | Lead mapping empty, trigger on | Mark as Replied | Success. One Lead with Salesforce defaults: Lead Status "Open - Not Contacted", Company "HubSpot", Owner Alias "ChintanS" (QA, 2026-10-16) | None |
| 4 | A Lead with the prospect's email already exists in Salesforce | Mark as Replied | Still exactly one Lead for the email. Record whether its values changed **(proposed, unconfirmed)** | None |

## Update a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead with the prospect's email exists with a different Job Title, Phone and Company | Mark as Replied | Success within 3 min. Still one Lead. Title, Phone, Company and Address show the prospect's values **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 2 | Lead exists with Lead Status "Working - Contacted", prospect has a new Job Title | Mark as Replied | Success. Title updated. Lead Status still "Working - Contacted" **(proposed, unconfirmed)** | None |
| 3 | Lead exists with a Phone, prospect has no Phone | Mark as Replied | Success. Record whether Phone stays or is cleared **(proposed, unconfirmed)** | None |
| 4 | No Lead or Contact with the prospect's email | Mark as Replied | No Lead is created. Record the Logs status **(proposed, unconfirmed)** | None |

## Create a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with First Name, Last Name, Email, Phone, Department, City, Job Title and Company filled, not in Salesforce | Mark as Replied | Success within 3 min. One Contact with Name, Email, Business Phone, Department and Other Address from the prospect. Title and Account Name empty (not mapped). No Lead created **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 2 | A Contact with the prospect's email already exists | Mark as Replied | Still exactly one Contact for the email. Record whether its values changed **(proposed, unconfirmed)** | None |
| 3 | A Lead with the prospect's email exists (made by hand), no Contact | Mark as Replied | One Contact is created. The Lead is unchanged **(proposed, unconfirmed)** | None |

## Update a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists with a different Phone and Department | Mark as Replied | Success. One Contact. Business Phone and Department show the prospect's values. Title unchanged **(proposed, unconfirmed)** | None |
| 2 | No Contact with the prospect's email | Mark as Replied | No Contact is created. Record the Logs status **(proposed, unconfirmed)** | None |
| 3 | Contact exists with a Phone, prospect has no Phone | Mark as Replied | Success. Record whether Phone stays or is cleared **(proposed, unconfirmed)** | None |

## Create an Account in Salesforce

Extra Configuration: None. Account mapping not seen.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Company "QA Acme 01", no such Account in Salesforce | Mark as Replied | Success. One Account named "QA Acme 01" **(proposed, unconfirmed)** | None |
| 2 | An Account named like the prospect's Company already exists | Mark as Replied | Still one Account with that name. Record whether a second one appears **(proposed, unconfirmed)** | None |
| 3 | New prospect with no Company | Mark as Replied | Logs status recorded. No Account without a name **(proposed, unconfirmed)** | None |

## Update an Account in Salesforce

Extra Configuration: None. Account mapping not seen.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account named like the prospect's Company exists with a different Phone or City | Mark as Replied | Success. Mapped values show the prospect's. One Account **(proposed, unconfirmed)** | None |
| 2 | No Account matches the prospect's Company | Mark as Replied | No Account is created. Record the Logs status **(proposed, unconfirmed)** | None |
| 3 | Prospect has no Company | Mark as Replied | Logs status recorded. No Account changes **(proposed, unconfirmed)** | None |

## Create an Opportunity in Salesforce

Extra Configuration: Closing date (days), Opportunity Stage. Opportunity mapping not seen.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration: 7 days, stage "Prospecting". New prospect | Mark as Replied | Success. One Opportunity with Close Date 7 days after the reply and Stage "Prospecting" **(proposed, unconfirmed)** | None |
| 2 | Extra Configuration: 0 days, stage "Closed Won" | Mark as Replied | Success. Close Date is the reply day, Stage "Closed Won" **(proposed, unconfirmed)** | None |
| 3 | Extra Configuration saved with no stage | Click Save in the dialog | Save is blocked or a message names the missing stage. Record which **(proposed, unconfirmed)** | None |

## Update an Opportunity in Salesforce

Extra Configuration: Closing date (days), Opportunity Stage. How the Opportunity is found is not known.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Opportunity linked to the prospect exists in Stage "Qualification". Extra Configuration: 14 days, stage "Negotiation/Review" | Mark as Replied | Success. Stage "Negotiation/Review", Close Date 14 days out. One Opportunity **(proposed, unconfirmed)** | None |
| 2 | No Opportunity for the prospect | Mark as Replied | No Opportunity is created. Record the Logs status **(proposed, unconfirmed)** | None |

## Attach Note in Salesforce (with Create a Contact)

Extra Configuration: None. Checked from Logs first; on Success the Note is looked up on the Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect, outcome "Add Outcome". Create a Contact and Attach Note selected | Mark as Replied | Logs status recorded. On Success: one Contact and one Note (Title "reply-received", Body with sequence, step, sender, email details). Latest Outcome empty **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 2 | A Contact with the prospect's email already exists | Mark as Replied | Logs status recorded. On Success: still one Contact, one Note on it **(proposed, unconfirmed)** | None |
| 3 | Attach Note selected alone | Mark as Replied | Logs status recorded. On Success: no Note on any record **(proposed, unconfirmed)** | None |
| 4 | New prospect, outcome set to "Interested" before the reply | Change the outcome, then Mark as Replied | Logs status recorded. On Success: Note Body shows Latest Outcome "Interested" **(proposed, unconfirmed)** | None |

## Record(log) an Email Activity in Salesforce

Extra Configuration: Select Object (Lead, Opportunity, Contact). What gets logged for a reply is not known.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Select Object "Contact". Contact with the prospect's email exists | Mark as Replied | Success. One email activity on the Contact; record its subject and body **(proposed, unconfirmed)** | None |
| 2 | Select Object "Lead". Lead with the prospect's email exists | Mark as Replied | Success. One email activity on the Lead **(proposed, unconfirmed)** | None |
| 3 | Select Object "Opportunity". Opportunity linked to the prospect exists | Mark as Replied | Success. One email activity on the Opportunity **(proposed, unconfirmed)** | None |
| 4 | Select Object "Contact". No Contact for the prospect | Mark as Replied | No activity is logged. Record the Logs status **(proposed, unconfirmed)** | None |

## Combined activities

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead and Create a Contact both selected, new prospect | Mark as Replied | One Lead and one Contact for the email, each with its mapped values **(proposed, unconfirmed)** | None |
| 2 | Create an Account and Create a Contact both selected, new prospect with Company | Mark as Replied | One Account and one Contact. Record whether the Contact is linked to the Account **(proposed, unconfirmed)** | None |

## Regression set (every release)

Must be able to fail, so only confirmed Expected results: Baseline 1 to 4,
Create a Lead 1 and 3, Update a Lead 1 and 4, Create a Contact 1, Attach Note 1.
Everything else runs on change or when QA asks, until QA confirms its result.
Rows total: 4 baseline + 33 activity + 2 combined = 39.
