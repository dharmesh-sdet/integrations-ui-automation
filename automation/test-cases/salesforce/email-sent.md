# Email Sent from Saleshandy: all activities, Regression plan

Approved by QA 2026-10-21 (replaces the earlier 34-row file). Environment: Staging (pyxis.lifeisgoodforlearner.com).
Account `sfemailsent`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket
AL-4132 (parent AL-4131). No sub-bugs, so Ticket is None for every row.

Scope: every activity the trigger offers (10): Create and Update for Account,
Contact, Lead and Opportunity, Attach Note, Record(log) an Email Activity. Each
activity has 2 to 6 rows a person can prepare and check by hand: 40 rows in all.
Rows marked **(proposed, unconfirmed)** have an Expected result that is neither
documented nor seen. Run them and record what happens; a different result is not
automatically a failure.

Sources for the Expected results: `[staging]` seen on this org, `[observed]` seen
on Reply Received with the same activity on 2026-10-20 and awaiting QA
confirmation. The public docs do not say how Create or Update finds an existing
record, or what happens when none exists, so none of those rows rests on them.

## Test data setup

- Own brand-new prospect per row (unique name and email), added to the active
  sequence with Add Prospects, then Emails tab > row > three dots > Send now. The
  sequence has 2 steps.
- Records a row needs first (Lead, Contact, Account, Opportunity) are created by
  hand in the Salesforce UI with the prospect's email (or Company name, for
  Account), with at least one value that differs from the prospect's.
- Check: after Send now wait 15 s, look in Salesforce. If missing, wait 5 s, hard
  refresh, look again. Only then open Logs. Error in Logs is reported to QA, not
  failed. Attach Note rows are checked from Logs first, then the Note in
  Salesforce.
- Triggers: every other trigger off, only "Email Sent from Saleshandy" on. For each
  section keep only the activities named in its heading selected, then Save.
- Field mapping (saved on `sfemailsent`): Lead (First Name, Last Name, Email,
  Company, Phone, Job Title, Industry, Website, City, State, Country, Company
  Revenue, Company HQ Location), Contact (First Name, Last Name, Email, Phone to
  Business Phone, Department, City, State, Country, HQ Location, Photo URL; Job
  Title and Company not mapped), Account (Company to Account Name, Website, City,
  State, Country, Industry, Size, Revenue, Founded Year, Phone, HQ Location),
  Opportunity (Prospect Overview to Description, Deal Value to Amount, Closing Date
  to Close Date).
- Extra Configuration `[staging]`: Create and Update an Opportunity have "Closing
  date" in Days and "Opportunity Stage". Record(log) an Email Activity has "Select
  Object" (Lead, Opportunity, Contact). The other 7 activities have none.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Email Sent trigger off, every other trigger off | Turn it on, pick "Create a Lead in Salesforce", click Save, reload | "Configuration Updated Successfully". Toggle on and chip persists after reload | None |
| 2 | Only "Reply is Received in Saleshandy" on, Email Sent off | Send now on step 1 | No Email Sent entry in Logs after 3 min. No Lead in Salesforce | None |
| 3 | Email Sent on with Create a Lead, prospect already got step 1 | Send now on step 2 | A second Email Sent entry in Logs for the prospect, status recorded | None |

## Create a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with First Name (accented), Last Name (apostrophe), Email, Phone, Job Title, Company, City filled, not in Salesforce | Send now on step 1 | Success within 3 min. Exactly one Lead with the mapped values exactly as entered. Lead Status "Open - Not Contacted" `[staging]` | None |
| 2 | New prospect with no Company | Send now on step 1 | Logs status recorded. If Success: one Lead and its Company value recorded. If Error: no Lead **(proposed, unconfirmed)** | None |
| 3 | A Lead with the prospect's email already exists | Send now on step 1 | Still exactly one Lead for the email. Record whether its values changed **(proposed, unconfirmed)** | None |
| 4 | Prospect already got step 1 and has one Lead | Send now on step 2 | Still exactly one Lead for the email **(proposed, unconfirmed)** | None |

## Update a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead with the prospect's email exists with a different Job Title, Phone and Company | Send now on step 1 | Success. Still one Lead. Title, Phone and Company show the prospect's values `[observed]` | None |
| 2 | Lead exists with Lead Status "Working - Contacted", prospect has a new Job Title | Send now on step 1 | Success. Title updated. Lead Status still "Working - Contacted" **(proposed, unconfirmed)** | None |
| 3 | No Lead or Contact with the prospect's email | Send now on step 1 | No Lead is created. Record the Logs status **(proposed, unconfirmed)** | None |

## Create a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with First Name, Last Name, Email, Phone, Department, City, Job Title, Company filled, not in Salesforce | Send now on step 1 | Success. One Contact with Name, Email, Business Phone, Department, Other City from the prospect. Title and Account Name empty (not mapped). No Lead created `[observed]` | None |
| 2 | A Contact with the prospect's email already exists | Send now on step 1 | Still exactly one Contact for the email. Record whether its values changed **(proposed, unconfirmed)** | None |
| 3 | A Lead with the prospect's email exists (made by hand), no Contact | Send now on step 1 | One Contact is created. The Lead is unchanged **(proposed, unconfirmed)** | None |

## Update a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists with a different Phone and Department | Send now on step 1 | Success. One Contact. Business Phone and Department show the prospect's values **(proposed, unconfirmed)** | None |
| 2 | No Contact with the prospect's email | Send now on step 1 | No Contact is created. Record the Logs status **(proposed, unconfirmed)** | None |

## Create an Account in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Company "QA Acme 01", Website, City, State, Country, no such Account | Send now on step 1 | Success. One Account named "QA Acme 01" with Website, Billing City, Billing State/Province, Billing Country from the prospect **(proposed, unconfirmed)** | None |
| 2 | An Account named like the prospect's Company already exists | Send now on step 1 | Still one Account with that name. Record whether a second one appears **(proposed, unconfirmed)** | None |
| 3 | New prospect with no Company | Send now on step 1 | Logs status recorded. No Account without a name **(proposed, unconfirmed)** | None |

## Update an Account in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account named like the prospect's Company exists with a different Phone and City | Send now on step 1 | Success. One Account. Mapped values show the prospect's **(proposed, unconfirmed)** | None |
| 2 | No Account matches the prospect's Company | Send now on step 1 | No Account is created. Record the Logs status **(proposed, unconfirmed)** | None |

## Create a Opportunity in Salesforce

Extra Configuration: Stage = Prospecting, Closing date = 1 Day, unless the row says otherwise.
The integration names the Opportunity with the prospect's email `[observed]`, and it shows in the
Contact's Related tab under Opportunities. QA, 2026-10-21: an Opportunity that cannot be created
with Closing date 0 Days is a bug, most likely a UI bug (0 Days should not be accepted at Save).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, no Opportunity | Send now on step 1 | Success. One Opportunity named with the prospect's email, Stage Prospecting, Close Date today + 1, tied to the Contact **(proposed, unconfirmed)** | None |
| 2 | Contact not in Salesforce | Send now on step 1 | Logs status recorded. Record whether an Opportunity, Contact or Lead appears **(proposed, unconfirmed)** | None |
| 3 | Contact already has 1 Opportunity | Send now on step 2 (step 1 made the first one) | A new Opportunity is created. The Contact now shows Opportunities (2) **(proposed, unconfirmed)** | None |
| 4 | Closing date = 1 Day, prospect has Deal Value 5000 | Send now on step 1 | Opportunity Close Date is today + 1 and Amount is 5000 `[observed]` | None |
| 5 | Extra Configuration saved with Stage left empty | Send now on step 1 | Logs status recorded. Opportunity Stage recorded (Prospecting was seen) `[observed]` | None |
| 6 | Closing date = 0 Days | Save the Extra Configuration, then Send now on step 1 | 0 Days is rejected at Save. If it is accepted, the Opportunity is created and Logs shows Success (QA, 2026-10-21). Seen: accepted at Save, Logs Error, no Opportunity | None |

## Update a Opportunity in Salesforce

Extra Configuration: Stage = Qualification, Closing date = 2 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 Opportunity | Send now on step 1 | That Opportunity shows Stage Qualification and Close Date today + 2. Still 1 Opportunity **(proposed, unconfirmed)** | None |
| 2 | Contact has 3 Opportunities, each made from the Contact's Opportunities list (the Contact is its Contact Role) | Send now on step 1 | Record which Opportunity changed and which stayed the same **(proposed, unconfirmed)** | None |
| 3 | Contact has 0 Opportunities | Send now on step 1 | Nothing is created. Record the Logs status **(proposed, unconfirmed)** | None |
| 4 | Contact has 1 Opportunity, Closing date = 0 Days | Save the Extra Configuration, then Send now on step 2 | 0 Days is rejected at Save (QA, 2026-10-21). If it is accepted, the Opportunity is updated and Logs shows Success | None |

## Attach Note in Salesforce

Extra Configuration: None. QA, 2026-10-21: a Note can go on a Contact, Lead, Account or Opportunity.
It is created only when Attach Note is selected together with the action for that entity.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Attach Note selected alone, Contact exists | Send now on step 1 | No Note on the Contact. Record the Logs status **(proposed, unconfirmed)** | None |
| 2 | Create a Contact + Attach Note, new prospect | Send now on step 1 | One Contact and one Note on it `[observed]`. Record the Note text: Step, Variant, Prospect Outcome | None |
| 3 | Same prospect as row 2, step 1 already sent | Send now on step 2 | A second Note on the Contact, text shows Step 2. The first Note is unchanged **(proposed, unconfirmed)** | None |
| 4 | Create a Lead + Attach Note, new prospect | Send now on step 1 | One Lead and one Note on it. Record the Note text **(proposed, unconfirmed)** | None |
| 5 | Create an Account + Attach Note, new prospect with Company | Send now on step 1 | One Account and one Note on it. Record the Note text **(proposed, unconfirmed)** | None |
| 6 | Create a Opportunity + Attach Note, new prospect | Send now on step 1 | One Opportunity and one Note on it. Record the Note text **(proposed, unconfirmed)** | None |

## Record(log) an Email Activity in Salesforce

Extra Configuration: Select Object, set per row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Record(log) alone, no object ticked, Contact exists | Send now on step 1 | Logs status recorded. Nothing on the Contact timeline **(proposed, unconfirmed)** | None |
| 2 | Contact ticked, Update a Contact selected, Contact exists | Send now on step 1 | One email on the Contact timeline. Record From, To, Subject and body | None |
| 3 | Lead ticked, Update a Lead selected, Lead exists | Send now on step 1 | One email on the Lead timeline. Lead values updated | None |
| 4 | Opportunity and Contact ticked, Create a Opportunity (Closing date 1 Day) selected, Contact exists | Send now on step 1 | Opportunity created. The email shows on the Opportunity and the Contact **(proposed, unconfirmed)** | None |
