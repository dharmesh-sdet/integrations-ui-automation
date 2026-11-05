# Email is Bounced in Saleshandy: all activities, Regression plan

Approved by QA 2026-11-05. Environment: Staging. Account `sfemailopened` (dharmesh+noemailsent), Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4138 (parent AL-4131). Ticket is None except where a row links AL-4168.

34 rows. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. Run them and record what happens.

Sources: developer API test log (v2, only B1 run live). The Email Sent, Reply Received, Email Opened and Link Clicked cases on this org. QA answers of 2026-10-22 (`context/salesforce/email-bounced.md`).

## Test data setup

- Each row uses its own new prospect, realistic name, email `firstname.lastname@mailinator.com`. Add it with Add Prospects, one at a time, to the Active 2-step sequence. A prospect can be marked as bounced once.
- Bounce the email (manual): Sequences > Emails tab > the prospect's row > Actions > Mark as bounced. Send now is not needed. The row then reads Hard Bounced. A manual bounce has no bounce reason, so "Bounce Reason" stays blank in Notes and Tasks `[dev kit]`.
- Real bounce: two rows only, address `TODO(needs-input)` (QA's own address). Send now on step 1, wait for Saleshandy to set Bounced.
- Step 2: Prospects tab > Add to Sequence > Sequence Steps > Step 2 > Add, then mark the step 2 row as bounced without sending it.
- Check: wait 15 s, look in Salesforce. If the record is missing, wait 5 s, hard refresh, look again. Only then open Logs. Error in Logs goes to QA, not marked failed.
- A record a row needs first is made by hand in Salesforce with one value that differs from the prospect's.
- Triggers: every other trigger off (Email Opened is still on from its smoke), only "Email is Bounced in Saleshandy" on. Keep only the activities named in the section heading, then Save.
- Extra Configuration: Create and Update a Opportunity have Closing date in Days and Opportunity Stage. Record(log) an Email Activity has Select Object. The other 7 activities have none.
- Known and accepted, not re-filed: Create a Contact next to a Lead with the same email can give DUPLICATES_DETECTED. Create a Opportunity makes a new Opportunity on every event.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Bounced trigger off, all others off | Turn it on, pick "Create a Lead in Salesforce", Save, reload | "Configuration Updated Successfully". Toggle and chip stay | None |
| 2 | New prospect in the Emails tab, sequence Active | Mark as bounced | Row reads Hard Bounced. Logs Success. One Lead | None |
| 3 | Sequence paused after being Active | Mark as bounced | Same as row 2 **(proposed, unconfirmed)** | None |
| 4 | Prospect added to step 2, step 2 email not sent | Mark the step 2 row as bounced | A Logs row for the step 2 bounce. One Lead **(proposed, unconfirmed)** | None |
| 5 | Only the Email Sent trigger is on, with Update a Lead selected | Mark as bounced | Row reads Hard Bounced. No Bounced row in Logs. No Lead | None |
| 6 | New prospect with a real address, Create a Lead on | Send now on step 1, wait for the real bounce | Email shows Bounced. Logs Success. One Lead | None |

## Create a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City | Mark as bounced | One Lead with the mapped values as entered. Status "Open - Not Contacted" | None |
| 2 | A Lead with the email exists with another Job Title | Mark as bounced | Logs Success. Still one Lead `[dev kit]` | None |
| 3 | A Contact with the email exists | Mark as bounced | Logs Success. No Lead created `[dev kit]` | None |

## Update a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A Lead exists with another Job Title, Phone, Company | Mark as bounced | One Lead. Mapped values show the prospect's `[dev kit]` | None |
| 2 | No Lead or Contact with the email | Mark as bounced | Logs Success. Nothing created `[dev kit]` | None |

## Create a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Phone, Department, City | Mark as bounced | One Contact with Name, Email, Business Phone, Department, Other City. No Lead | None |
| 2 | A Contact exists with another Phone | Mark as bounced | Still one Contact. Business Phone updated `[dev kit]` | None |

## Update a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A Contact exists with another Phone and Department | Mark as bounced | One Contact. Both fields show the prospect's `[dev kit]` | None |
| 2 | No Contact with the email | Mark as bounced | Logs Success. Nothing created `[dev kit]` | None |

## Create a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Priya Nair" with Website, City, State, Country | Mark as bounced | One Account named "Priya Nair" with Billing City, State, Country and Website `[QA 2026-10-22]` | None |
| 2 | Account "Priya Nair" already exists | Mark as bounced | Still one Account `[dev kit]` | None |
| 3 | New prospect "Sean O'Brien" | Mark as bounced | One Account named "Sean O'Brien". Logs Success, no query error `[dev kit]` | None |

## Update a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An Account named like the prospect's full name exists with another Phone and City | Mark as bounced | One Account. Mapped values show the prospect's `[QA 2026-10-22]` | None |
| 2 | No Account with the prospect's full name | Mark as bounced | Logs Success. Nothing created `[dev kit]` | None |

## Create a Opportunity in Salesforce

Extra Configuration: Stage Prospecting, Closing date 7 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, prospect Deal Value 12000 | Mark as bounced | One Opportunity named with the prospect's email, Prospecting, Close Date today + 7, Amount 12,000.00, linked to the Contact `[dev kit]` | None |
| 2 | Contact is not in Salesforce | Mark as bounced | A Contact and the Opportunity are created and linked `[dev kit]` | None |
| 3 | Closing date set to 0 Days | Open the modal and type 0 in Closing date | The field turns red. Save is disabled (QA, 2026-10-22) | AL-4168 |

## Update a Opportunity in Salesforce

Extra Configuration: Stage Qualification, Closing date 14 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | The Contact has 3 Opportunities with the email as name | Mark as bounced | Only the newest changes: Qualification, Close Date today + 14. The other two stay `[dev kit]` | None |
| 2 | Closing date set to 0 Days | Open the modal and type 0 in Closing date | The field turns red. Save is disabled | AL-4168 |

## Attach Note in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Contact + Attach Note, new prospect | Mark as bounced, then copy the Note text | One Contact, one Note on it. Bounce Reason blank `[dev kit]` | None |
| 2 | Create a Lead + Attach Note, new prospect | Mark as bounced | One Lead, one Note **(proposed, unconfirmed)** | None |
| 3 | Create a Account + Attach Note, new prospect | Mark as bounced | One Account, one Note **(proposed, unconfirmed)** | None |
| 4 | Create a Opportunity + Attach Note, new prospect | Mark as bounced | One Opportunity, one Note on the Opportunity, not on the Contact `[dev kit]` | None |

## Record(log) an Email Activity in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact ticked + Update a Contact, Contact exists | Mark as bounced, then copy the Task Subject and body | One completed Email Task on the Contact. Record what it says for a bounce `[dev kit]` | None |
| 2 | Lead ticked + Update a Lead, Lead exists | Mark as bounced | One Email Task on the Lead `[dev kit]` | None |
| 3 | No object ticked, Contact exists | Mark as bounced | Logs Success, no crash. Nothing on the Contact timeline `[dev kit]` | None |

## Combined activities

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Contact + Attach Note + Record(log) with Contact ticked, new prospect, real address | Send now on step 1, wait for the real bounce | One Contact, one Note, one Email Task on the Contact. Logs Success **(proposed, unconfirmed)** | None |
| 2 | Update a Contact + Update a Lead + Update a Opportunity + Update a Account selected, nothing exists for the prospect | Mark as bounced | Logs Success. Nothing created, no errored step `[dev kit]` | None |
