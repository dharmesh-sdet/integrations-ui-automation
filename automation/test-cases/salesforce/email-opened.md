# Sequence Email is Opened in Saleshandy: all activities, Regression plan

Approved by QA 2026-11-04. Environment: Staging. Planned account `sfemailopened`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4135 (parent AL-4131). Ticket is None except where a row links AL-4168.

31 rows. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. Run them and record what happens. Sources: developer API test log (v4, signed off), Email Sent and Reply Received on this org, QA answers of 2026-10-22 (`context/salesforce/email-opened.md`).

## Test data setup

- Own new prospect per row, realistic name, email `firstname.lastname@mailinator.com`. Add it with Add Prospects, one at a time, to the active 2-step sequence. Wait for Sent in Sequences > Emails.
- Sequence Safety Settings: Track email opens on (Enable Anyway), Track link clicks off. Custom tracking domain `cd1.shengage02.com`.
- Open the email: mailinator.com, type the prospect's address, Go, open the sequence email. Wait 10 s after the send first.
- Step 2: Prospects tab > Add to Sequence > Sequence Steps > Step 2 > Add, then Send now on the step 2 row, then open it.
- Check: refresh Sequences > Emails until Opened goes up. Wait 15 s, look in Salesforce. If the record is missing, wait 5 s, hard refresh, look again. Only then open Logs. Error in Logs goes to QA, not marked failed.
- A record a row needs first is made by hand in Salesforce with one value that differs from the prospect's.
- Triggers: every other trigger off, only "Sequence Email is Opened in Saleshandy" on. Keep only the activities named in the section heading, then Save.
- Field mapping copied from `sfemailsent`. The activity modal has extra fields for two activities: Create and Update a Opportunity have Closing date in Days and Opportunity Stage. Record(log) an Email Activity has Select Object. The other 7 activities have none.
- Known and accepted, not re-filed: Create a Contact next to a Lead with the same email can give DUPLICATES_DETECTED. Create a Opportunity makes a new Opportunity on every open.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Opened trigger off, others off | Turn it on, pick "Create a Lead in Salesforce", Save, reload | "Configuration Updated Successfully". Toggle and chip stay | None |
| 2 | New prospect got step 1 | Open the email in Mailinator | Opened is 1 within about 10 s. Logs Success. One Lead | None |
| 3 | First open done | Open the same email again after 10 s | Opened is 2. A second Logs row. Still one Lead **(proposed, unconfirmed)** | None |
| 4 | Prospect moved to step 2 and sent | Open the step 2 email | A Logs row for the step 2 open **(proposed, unconfirmed)** | None |
| 5 | Only Email Sent trigger on, with Update a Lead selected | Open the email | Opened goes up. No Opened row in Logs. No Lead (Update a Lead matches nothing for a new prospect, so the send makes none) | None |

## Create a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City | Open the email | One Lead with mapped values as entered. Status "Open - Not Contacted" | None |
| 2 | Lead with the email exists with another Job Title | Open the email | Success. Still one Lead `[dev kit]` | None |
| 3 | Contact with the email exists | Open the email | No Lead created. Success `[dev kit]` | None |

## Update a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead exists with another Job Title, Phone, Company | Open the email | One Lead. Mapped values show the prospect's `[dev kit]` | None |
| 2 | No Lead or Contact with the email | Open the email | Nothing created. Logs Success `[dev kit]` | None |

## Create a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Phone, Department, City | Open the email | One Contact with Name, Email, Business Phone, Department, Other City. No Lead | None |
| 2 | Contact exists with another Phone | Open the email | Still one Contact. Business Phone updated `[dev kit]` | None |

## Update a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists with another Phone and Department | Open the email | One Contact. Both show the prospect's `[dev kit]` | None |
| 2 | No Contact with the email | Open the email | Nothing created. Logs Success `[dev kit]` | None |

## Create a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Priya Nair" with Website, City, State, Country | Open the email | One Account named "Priya Nair" with Billing City, State, Country, Website `[QA 2026-10-22]` | None |
| 2 | Account "Priya Nair" already exists | Open the email | Still one Account, no duplicate `[dev kit]` | None |
| 3 | New prospect "Sean O'Brien" | Open the email | One Account named "Sean O'Brien". Logs Success, no query error `[dev kit]` | None |

## Update a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account named like the prospect's full name exists with another Phone and City | Open the email | One Account. Mapped values show the prospect's `[QA 2026-10-22]` | None |
| 2 | No Account with the prospect's full name | Open the email | Nothing created. Logs Success `[dev kit]` | None |

## Create a Opportunity in Salesforce

Extra Configuration: Stage Prospecting, Closing date 7 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, prospect Deal Value 12000 | Open the email | One Opportunity named with the prospect's email, Prospecting, Close Date today + 7, Amount 12,000.00, linked to the Contact `[dev kit]` | None |
| 2 | Contact not in Salesforce | Open the email | A Contact and the Opportunity are created, linked `[dev kit]` | None |
| 3 | Type 0 in Closing date | Open the modal | Field turns red, Save disabled | AL-4168 |

## Update a Opportunity in Salesforce

Extra Configuration: Stage Qualification, Closing date 14 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 3 Opportunities with the email as name | Open the email | Only the newest changes: Qualification, Close Date today + 14. The other two stay `[dev kit]` | None |
| 2 | Type 0 in Closing date | Open the modal | Field turns red, Save disabled | AL-4168 |

## Attach Note in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Contact + Attach Note, new prospect | Open the email | One Contact, one Note on it. Record the Note text | None |
| 2 | Create a Lead + Attach Note, new prospect | Open the email | One Lead, one Note **(proposed, unconfirmed)** | None |
| 3 | Create a Account + Attach Note, new prospect | Open the email | One Account, one Note **(proposed, unconfirmed)** | None |
| 4 | Create a Opportunity + Attach Note, new prospect | Open the email | One Opportunity, one Note **(proposed, unconfirmed)** | None |

## Record(log) an Email Activity in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact ticked + Update a Contact, Contact exists | Open the email | One completed Email Task on the Contact. Record Subject and body `[dev kit]` | None |
| 2 | Lead ticked + Update a Lead, Lead exists | Open the email | One Email Task on the Lead `[dev kit]` | None |
| 3 | No object ticked, Contact exists | Open the email | Logs Success, no crash. Nothing on the Contact timeline `[dev kit]` | None |
