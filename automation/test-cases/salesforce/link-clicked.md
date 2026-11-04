# Link is Clicked in Saleshandy: all activities, Regression plan

Approved by QA 2026-11-04. Environment: Staging. Account `sflinkclicked` (dharmesh+zohointegration), Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4136 (parent AL-4131). Ticket is None except where a row links AL-4168.

34 rows. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. Run them and record what happens. Sources: developer API test log (v4, signed off), Email Opened and Email Sent cases on this org, QA answers of 2026-10-22. Extra Configuration read on staging 2026-11-04.

## Test data setup

- Each row uses its own new prospect, realistic name, email `firstname.lastname@mailinator.com`. Add it with Add Prospects, one at a time, to the active 2-step sequence. Step 1 holds two different links. Wait for Sent in Sequences > Emails.
- Sequence Safety Settings: Track link clicks on (Enable Anyway), Track email opens off. Custom tracking domain `cd1.shengage02.com`.
- Click: mailinator.com, type the prospect's address, Go, open the sequence email, click link 1. Wait 10 s after the send first. Click link 2 only in rows that say so.
- Step 2: Prospects tab > Add to Sequence > Sequence Steps > Step 2 > Add, then Send now on the step 2 row, then click.
- Check: refresh Sequences > Emails until Clicked goes up. Wait 15 s, look in Salesforce. If the record is missing, wait 5 s, hard refresh, look again. Only then open Logs. Error in Logs goes to QA, not marked failed.
- A record a row needs first is made by hand in Salesforce with one value that differs from the prospect's.
- Triggers: every other trigger off, only "Link is Clicked in Saleshandy" on, because a click also counts as an open. Keep only the activities named in the section heading, then Save.
- Extra Configuration: Create and Update a Opportunity have Closing date in Days and Opportunity Stage. Record(log) an Email Activity has Select Object. The other 7 activities have none.
- Known and accepted, not re-filed: Create a Contact next to a Lead with the same email can give DUPLICATES_DETECTED. Create a Opportunity makes a new Opportunity on every click.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Link Clicked trigger off, all others off | Turn it on, pick "Create a Lead in Salesforce", Save, reload | "Configuration Updated Successfully". Toggle and chip stay | None |
| 2 | New prospect received step 1 | Click link 1 | Clicked is 1 within about 10 s. Logs Success. One Lead | None |
| 3 | Link 1 already clicked once | Click link 2 in the same email after 10 s | Clicked is 2. A second Logs row. Still one Lead **(proposed, unconfirmed)** | None |
| 4 | Prospect moved to step 2 and sent | Click a link in the step 2 email | A Logs row for the step 2 click **(proposed, unconfirmed)** | None |
| 5 | Track link clicks is off in the sequence | Click link 1 | Clicked stays 0. No Logs row. No Lead **(proposed, unconfirmed)** | None |
| 6 | Only the Email Sent trigger is on | Click link 1 | Clicked goes up. No Link Clicked row in Logs. No Lead | None |
| 7 | Link Clicked and Email Opened both on, both set to Create a Lead | Click link 1 | Clicked and Opened both go up. One Logs row per trigger. One Lead **(proposed, unconfirmed)** | None |

## Create a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City | Click link 1 | One Lead with the mapped values as entered. Status "Open - Not Contacted" | None |
| 2 | A Lead with the email exists with another Job Title | Click link 1 | Logs Success. Still one Lead `[dev kit]` `[dev kit]` | None |
| 3 | A Contact with the email exists | Click link 1 | Logs Success. No Lead created `[dev kit]` `[dev kit]` | None |

## Update a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A Lead exists with another Job Title, Phone, Company | Click link 1 | One Lead. Mapped values show the prospect's `[dev kit]` `[dev kit]` | None |
| 2 | No Lead or Contact with the email | Click link 1 | Logs Success. Nothing created `[dev kit]` `[dev kit]` | None |

## Create a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Phone, Department, City | Click link 1 | One Contact with Name, Email, Business Phone, Department, Other City. No Lead | None |
| 2 | A Contact exists with another Phone | Click link 1 | Still one Contact. Business Phone updated `[dev kit]` `[dev kit]` | None |

## Update a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A Contact exists with another Phone and Department | Click link 1 | One Contact. Both fields show the prospect's `[dev kit]` `[dev kit]` | None |
| 2 | No Contact with the email | Click link 1 | Logs Success. Nothing created `[dev kit]` `[dev kit]` | None |

## Create a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Priya Nair" with Website, City, State, Country | Click link 1 | One Account named "Priya Nair" with Billing City, State, Country and Website `[QA 2026-10-22]` `[QA 2026-10-22]` | None |
| 2 | Account "Priya Nair" already exists | Click link 1 | Still one Account `[dev kit]` | None |
| 3 | New prospect "Sean O'Brien" | Click link 1 | One Account named "Sean O'Brien". Logs Success, no query error `[dev kit]` `[dev kit]` | None |

## Update a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An Account named like the prospect's full name exists with another Phone and City | Click link 1 | One Account. Mapped values show the prospect's `[QA 2026-10-22]` `[QA 2026-10-22]` | None |
| 2 | No Account with the prospect's full name | Click link 1 | Logs Success. Nothing created `[dev kit]` `[dev kit]` | None |

## Create a Opportunity in Salesforce

Extra Configuration: Stage Prospecting, Closing date 7 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, prospect Deal Value 12000 | Click link 1 | One Opportunity named with the prospect's email, Prospecting, Close Date today + 7, Amount 12,000.00, linked to the Contact `[dev kit]` `[dev kit]` | None |
| 2 | Contact is not in Salesforce | Click link 1 | A Contact and the Opportunity are created and linked `[dev kit]` `[dev kit]` | None |
| 3 | Closing date set to 0 Days | Open the modal and type 0 in Closing date | The field turns red. Save is disabled | AL-4168 |

## Update a Opportunity in Salesforce

Extra Configuration: Stage Qualification, Closing date 14 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | The Contact has 3 Opportunities with the email as name | Click link 1 | Only the newest changes: Qualification, Close Date today + 14. The other two stay `[dev kit]` `[dev kit]` | None |
| 2 | Closing date set to 0 Days | Open the modal and type 0 in Closing date | The field turns red. Save is disabled | AL-4168 |

## Attach Note in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Contact + Attach Note, new prospect | Click link 1, then copy the Note text | One Contact, one Note on it with Click Count 1 and the link `[dev kit]` `[dev kit]` | None |
| 2 | Same setup, link 1 already clicked | Click link 2 after 10 s | Still one Contact. A second Note with Click Count 2 `[dev kit]` `[dev kit]` | None |
| 3 | Create a Lead + Attach Note, new prospect | Click link 1 | One Lead, one Note **(proposed, unconfirmed)** | None |
| 4 | Create a Account + Attach Note, new prospect | Click link 1 | One Account, one Note **(proposed, unconfirmed)** | None |
| 5 | Create a Opportunity + Attach Note, new prospect | Click link 1 | One Opportunity, one Note **(proposed, unconfirmed)** | None |

## Record(log) an Email Activity in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact ticked + Update a Contact, Contact exists | Click link 1, then copy the Task Subject and body | One completed Email Task on the Contact. Description shows Click Count and Link Clicked `[dev kit]` `[dev kit]` | None |
| 2 | Lead ticked + Update a Lead, Lead exists | Click link 1 | One Email Task on the Lead `[dev kit]` `[dev kit]` | None |
| 3 | No object ticked, Contact exists | Click link 1 | Logs Success, no crash. Nothing on the Contact timeline `[dev kit]` `[dev kit]` | None |
