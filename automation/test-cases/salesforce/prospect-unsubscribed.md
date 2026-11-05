# Prospect is Unsubscribed in Saleshandy: all activities, Regression plan

Approved by QA 2026-11-05. Cut to 32 rows on 2026-11-05 (QA, for run time). Environment: Staging. Account `sflinkclicked` (dharmesh+zohointegration, reused, QA 2026-11-05), Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4137 (parent AL-4131). Ticket is None except where a row links AL-4168.

32 rows. Trigger rows 5 and 9 are manual: no script (they need a prospect in no sequence and a second active sequence). The script runs the other 30. Cut as repeats of what the shared Salesforce graph and the finished workflows already covered: Create a Opportunity (Contact not in Salesforce), Attach Note with Update a Contact, with Create a Account and with Create a Opportunity, and Record(log) with Lead ticked and with no object ticked. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. Run them and record what happens. Sources: developer API test log (v2, v3 not live-tested), Link Clicked and Email Sent cases on this org, QA answers of 2026-10-22. When the account exists, confirm Extra Configuration on staging.

Known and accepted, not re-filed. "Manually Unsubscribed?" in the Note is always blank (dev kit F-1). A prospect in no sequence fires no event (dev kit F-3, by design). Create a Contact next to a Lead or Opportunity with the same email can give DUPLICATES_DETECTED. Create a Opportunity makes a new Opportunity on every run. Record(log) an Email Activity can miss a record created in the same run (dev kit F-2). Its rows use records that exist before the unsubscribe.

Not asserted: the Salesforce Email Opt Out field. QA asks the developer.

## Test data setup

- Each row uses its own new prospect with a realistic name and the email `firstname.lastname@mailinator.com`. Add it with Add Prospects to the active sequence with two steps. Wait for Sent in Sequences > Emails.
- An unsubscribed prospect cannot be added to a sequence or moved to another step (product behavior). Do every add, move and send first, and unsubscribe last. A prospect is unsubscribed once per row, except in trigger row 4.
- Sequence > Settings > Unsubscribe: "Include Unsubscribe Option in Emails" = "Unsubscribe as Link", Save.
- Real link: mailinator.com, type the prospect's address, Go, open the email, LINKS tab, open "Unsubscribe here". Wait about 93 s after the send first. The page says "You will no longer receive emails from us".
- Mark as Unsubscribe: Sequence > Prospects tab, tick the prospect, toolbar icon "Mark as Unsubscribe".
- Step 2: Prospects tab > Add to Sequence > Sequence Steps > Step 2 > Add, then Send now on the step 2 row.
- Trigger row 9 needs a second active sequence with the same unsubscribe setting.
- Make sure that the Prospects tab shows Unsubscribed. Wait 15 s, look in Salesforce. If the record is missing, wait 5 s, hard refresh, look again. The Logs tab is never opened, in any row. A record still missing after the second look goes to QA, not marked failed.
- A record a row needs first is made by hand in Salesforce with one value that differs from the prospect's.
- Triggers: every other trigger off, only "Prospect is Unsubscribed in Saleshandy" on. Keep only the activities named in the section heading, then Save.
- Extra Configuration: Create and Update a Opportunity have Closing date in Days and Opportunity Stage. Record(log) an Email Activity has Select Object. The other 7 activities have none.
- Saved Extra Configuration cannot be cleared again. Run Create a Opportunity row 3 (empty values) before any row that saves Stage and Closing date values.
- Rows use the real link unless the row says Mark as Unsubscribe.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Unsubscribed trigger off, all others off | Turn it on, pick "Create a Lead in Salesforce", Save, reload | "Configuration Updated Successfully". Toggle and chip stay | None |
| 2 | New prospect in the sequence, step 1 Sent | Open the real unsubscribe link | Prospects tab shows Unsubscribed. One Lead | None |
| 3 | New prospect in the sequence, step 1 Sent | Mark as Unsubscribe in the Prospects tab | Prospects tab shows Unsubscribed. Record whether a Lead appears (HubSpot production fired only on the link) **(proposed, unconfirmed)** | None |
| 4 | Link already opened once, Lead exists | Open the same link again | Still one Lead **(proposed, unconfirmed)** | None |
| 5 | Prospect in no sequence | Mark as Unsubscribe on the Prospects page | Prospect shows Unsubscribed. No Lead | None |
| 6 | All triggers off | Open the real link | Prospect shows Unsubscribed. No Lead | None |
| 7 | Prospect unsubscribed through the link, Lead exists | Click "Subscribe here" on the link page | Prospect returns to its earlier status. Still one Lead, unchanged **(proposed, unconfirmed)** | None |
| 8 | Prospect moved to step 2 and step 2 is Sent | After the send, open the real link in the step 2 email | Prospects tab shows Unsubscribed. One Lead **(proposed, unconfirmed)** | None |
| 9 | Prospect is in two sequences, both Sent | After both sends, open the real link in the email of the first (older) sequence | Prospects tab shows Unsubscribed. One Lead. Record in which sequence the prospect shows Unsubscribed (the developer's log says the event uses the latest sequence prospect task) **(proposed, unconfirmed)** | None |
| 10 | Prospect already replied (Mark as replied after the send) | Open the real link | Record the prospect status on the Prospects tab. One Lead **(proposed, unconfirmed)** | None |

## Create a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Siobhán O'Brien" with Phone, Job Title, Company, City | Open the real link | One Lead with the mapped values as entered. Status "Open - Not Contacted" | None |
| 2 | A Lead with the email exists with another Job Title | Open the real link | Still one Lead | None |
| 3 | A Contact with the email exists | Open the real link | No Lead created | None |

## Update a Lead in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A Lead exists with another Job Title, Phone, Company | Open the real link | One Lead. Mapped values show the prospect's | None |
| 2 | No Lead or Contact with the email | Open the real link | Nothing created | None |

## Create a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Phone, Department, City | Open the real link | One Contact with Name, Email, Business Phone, Department, Other City. No Lead | None |
| 2 | A Contact exists with another Phone | Open the real link | Still one Contact. Business Phone updated | None |

## Update a Contact in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A Contact exists with another Phone and Department | Open the real link | One Contact. Both fields show the prospect's | None |
| 2 | No Contact with the email | Open the real link | Nothing created | None |

## Create a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect "Priya Nair" with Website, City, State, Country | Open the real link | One Account named "Priya Nair" with Billing City, State, Country and Website | None |
| 2 | Account "Priya Nair" already exists | Open the real link | Still one Account | None |
| 3 | New prospect "Sean O'Brien" | Open the real link | One Account named "Sean O'Brien" | None |

## Update a Account in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An Account named like the prospect's full name exists with another Phone and City | Open the real link | One Account. Mapped values show the prospect's | None |
| 2 | No Account with the prospect's full name | Open the real link | Nothing created | None |

## Create a Opportunity in Salesforce

Extra Configuration: Stage Prospecting, Closing date 7 Days. Row 3 uses Stage and Closing date saved empty.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, prospect Deal Value 12000 | Open the real link | One Opportunity named with the prospect's email, Prospecting, Close Date today + 7, Amount 12,000.00, linked to the Contact | None |
| 2 | Closing date set to 0 Days | Open the modal and type 0 in Closing date | The field turns red. Save is disabled | AL-4168 |
| 3 | Extra Configuration saved with Stage and Closing date empty, Contact exists | Open the real link | One Opportunity with Stage Prospecting and Close Date today + 1, as seen on Email Sent 2026-10-21 **(proposed, unconfirmed)** | None |

## Update a Opportunity in Salesforce

Extra Configuration: Stage Qualification, Closing date 14 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | The Contact has 3 Opportunities with the email as name | Open the real link | Only the newest changes: Qualification, Close Date today + 14. The other two stay | None |
| 2 | Closing date set to 0 Days | Open the modal and type 0 in Closing date | The field turns red. Save is disabled | AL-4168 |

## Attach Note in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Contact + Attach Note, new prospect | Open the real link, then copy the Note text | One Contact, one Note on it. Record the title and body | None |
| 2 | Create a Lead + Attach Note, new prospect | Open the real link | One Lead, one Note **(proposed, unconfirmed)** | None |

## Record(log) an Email Activity in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact ticked + Update a Contact, Contact exists | Open the real link, then copy the Task Subject and body | One completed Email Task on the Contact. Record the description | None |
