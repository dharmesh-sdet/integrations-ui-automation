# Prospect is Unsubscribed in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com), account `unsubscribed`,
HubSpot shared portal. The workflow ticket is AL-4015 (under AL-3984). No
sub-bugs are known, so every Ticket cell is "None". The trigger is done two
ways: the real "Unsubscribe here" link in the delivered email (rows say
"Unsubscribe (link)") and the "Mark as Unsubscribe" action on the Prospects
tab (rows say "Unsubscribe (UI)"). Both were seen on staging on 2026-10-15
with Create a Contact: the Prospects tab shows "Unsubscribed" and Logs show
one "Prospect is Unsubscribed in Saleshandy" row Success at the first 15 s
refresh (`context/hubspot/prospect-unsubscribed.md`).

Every HubSpot result below mirrors the same activity on Email Sent from
Saleshandy and is **(proposed, unconfirmed)**: QA has not confirmed it for
this trigger. Wait for QA before treating a difference as a product bug.

The scenarios run in two phases. Phase 1 has the rows where the Extra
Configuration is left empty or the activity has none. Phase 2 has the rows
with Extra Configuration values. Run Phase 1 before Phase 2: once values are
saved they cannot be emptied again (`00-overview.md`). Walk Create a Contact
1 (Extra Configuration skipped) first on this account.

Not covered, still open: none known tickets. See Open questions at the end.

## Test data setup

- Account: `unsubscribed` (OTP off, shared HubSpot portal connected, login saved).
- Sequence "HubSpot Prospect Unsubscribed QA" (id 196738): one step, no A/B variants, Active, sender `dharmesh+unodost@saleshandy.com`. Sequence Settings > Unsubscribe > "Unsubscribe as Link" saved (needed for the link rows).
- Add the prospect: Sequence > Prospects > Search & Add > Create New Prospect with the CSV row (`test-data/hubspot/unsubscribed.csv`), one at a time. Step 1 shows Sent within about 6 s. Unsubscribe only after Sent.
- Unsubscribe (UI): Prospects tab > tick the prospect > toolbar icon "Mark as Unsubscribe" (no confirm dialog).
- Unsubscribe (link): open the prospect's public Mailinator inbox, LINKS tab, open the `unsub.shengage02.com/c/...` link. The page says "You will no longer receive emails from us".
- "Check Logs Success": Settings > Integrations > HubSpot > Logs. Refresh 15 s after the action, then every 10 s until the row "Prospect is Unsubscribed in Saleshandy" is Success (max 3 min). Do not open log entries. Then check the HubSpot record (up to 10 min for Update a deal, not known for this trigger).
- Every row also shows "Unsubscribed" on the Prospects tab; the Emails tab row stays "Sent".
- Triggers: every other trigger off, only "Prospect is Unsubscribed in Saleshandy" on. Email Sent must stay off, or it also creates records at step 1.
- Save buttons: for an activity with an Extra Configuration modal, click the modal's Save (it saves the whole workflow). For an activity with no modal, click the page's Save and wait for "Configuration Updated Successfully".
- HubSpot Setup (contact, deals from `unsubscribed-deals.csv`, companies from `unsubscribed-companies.csv`) is created by hand in HubSpot before the unsubscribe. HubSpot setting "Create and associate companies with contacts" stays off.
- No Closing Date on the prospect, ever (known date conversion bug). Deal Value may be set from the CSV.
- Every row has its own prospect (CSV row); row 4 opens its link a second time.
- `beatriz.valente@mailinator.com` (CSV Trigger behavior (baseline) > 2) and `balazs.farkas@mailinator.com` (CSV Create a Contact in HubSpot > 1) were used by hand on 2026-10-15; those two CSV rows get new prospects before the run.
- Field mapping as in `00-overview.md`.

## Phase 1: Extra Configuration skipped or none

### Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Prospect is Unsubscribed in Saleshandy", select Create a Contact (Extra Configuration skipped), click Save | "Configuration Updated Successfully" | None |
| 2 | Unsubscribe (UI), Create a Contact, contact not in HubSpot | Add prospect (new CSV row, not beatriz), Unsubscribe (UI) | Prospects tab shows Unsubscribed. Logs: one Success row at first refresh. Contact created with prospect's data (proposed, unconfirmed) | None |
| 3 | Unsubscribe (link), Create a Contact, contact not in HubSpot | Add prospect (new CSV row), open Mailinator inbox > LINKS tab, open unsub link | Page says "You will no longer receive emails from us" with "Subscribe here" and "Report spam". Prospects tab Unsubscribed, Logs one Success row. Contact created with prospect's data, same as row 2 (proposed, unconfirmed) | None |
| 4 | Prospect unsubscribed by link, same link opened a second time | Open unsubscribe link, then open the same link again | Second Success row in Logs. No second contact in HubSpot (proposed, unconfirmed) | None |
| 5 | Prospect unsubscribed by link | On the unsubscribe page click "Subscribe here" | Page says "You have successfully subscribed and added to our list for future communication". Prospects tab shows previous status (Completed) | None |
| 6 | Prospect unsubscribed by Unsubscribe (UI) | Prospects tab > tick the prospect > Mark as Resume > Apply changes | Prospect stays Unsubscribed (QA, 2026-10-15: unsubscribed prospect cannot be resumed). Toast "Prospect(s) status updated successfully" | None |

### Create a Contact in HubSpot

Extra Configuration: skipped (modal Cancel, then Save).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration skipped, contact not in HubSpot | Add prospect (new row, not balazs), Unsubscribe (UI) | Check Logs Success. Contact created with mapped fields (company name, industry, country); Lifecycle Stage and Lead Status set by HubSpot (proposed, unconfirmed) | None |
| 3 | Contact in HubSpot, prospect details changed | Change Job Title, City, State on the prospect, Unsubscribe (UI) | Check Logs Success. Contact shows new mapped values (proposed, unconfirmed) | None |
| 5 | Extra Configuration skipped, contact not in HubSpot, real link | Add prospect, Unsubscribe (link) | Prospects tab Unsubscribed, Check Logs Success. Contact created with mapped data, same as row 1 (proposed, unconfirmed) | None |

### Update a Contact in HubSpot

Extra Configuration: skipped (modal Cancel, then Save).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration skipped, contact in HubSpot, details changed | Change Job Title, City on the prospect, Unsubscribe (UI) | Check Logs Success. Contact shows new mapped values (proposed, unconfirmed) | None |
| 2 | Contact in HubSpot, details unchanged | Unsubscribe (UI) | Check Logs Success. Contact not updated (proposed, unconfirmed) | None |
| 3 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. No contact created (proposed, unconfirmed) | None |
| 5 | Contact in HubSpot, details changed, real link | Change Job Title, City on the prospect, Unsubscribe (link) | Check Logs Success. Contact shows new mapped values, same as row 1 (proposed, unconfirmed) | None |

### Create a deal in HubSpot

Extra Configuration: skipped (modal Cancel, then Save).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration skipped, contact in HubSpot, no deal | Unsubscribe (UI) | Check Logs Success. Deal created and associated; Pipeline, Stage, Type, Priority set by HubSpot; Amount and close date empty (proposed, unconfirmed) | None |
| 2 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and deal created and associated, same values as row 1 (proposed, unconfirmed) | None |
| 3 | Contact has 1 deal | Unsubscribe (UI) | Check Logs Success. New deal created, contact now has 2 deals (proposed, unconfirmed) | None |
| 4 | Prospect has Deal Value 15800 | Unsubscribe (UI) | Check Logs Success. Deal Amount = Deal Value, close date empty (proposed, unconfirmed) | None |
| 6 | Extra Configuration skipped, contact in HubSpot, no deal, real link | Unsubscribe (link) | Check Logs Success. Deal created and associated, same as row 1 (proposed, unconfirmed) | None |

### Update a deal in HubSpot

Extra Configuration: skipped (modal Cancel, then Save).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration skipped, contact has 1 deal | Unsubscribe (UI) | Check Logs Success. Deal updated (QA, 2026-10-15: with one deal, updates regardless of Extra Configuration) | None |
| 2 | Contact has 3 deals | Unsubscribe (UI) | Check Logs Success. Latest created deal updated, other two unchanged (QA, 2026-10-15) | None |
| 5 | Contact in HubSpot, 0 deals | Unsubscribe (UI) | Check Logs Success. Nothing created or updated (proposed, unconfirmed) | None |
| 6 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Nothing created or updated (proposed, unconfirmed) | None |
| 7 | Contact has 1 deal, real link | Unsubscribe (link) | Check Logs Success. Deal updated, same as row 1 (QA, 2026-10-15) | None |

### Create a company in HubSpot

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Unsubscribe (UI) | Check Logs Success. Company created and associated (proposed, unconfirmed) | None |
| 2 | Company with same domain exists | Unsubscribe (UI) | Check Logs Success. New company created and associated (not the existing one) (proposed, unconfirmed) | None |
| 3 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and company created and associated (proposed, unconfirmed) | None |
| 4 | Prospect has only company domain, other company details empty | Unsubscribe (UI) | Check Logs Success. Company created from company domain (proposed, unconfirmed) | None |
| 5 | Contact in HubSpot, real link | Unsubscribe (link) | Check Logs Success. Company created and associated, same as row 1 (proposed, unconfirmed) | None |

### Update a company in HubSpot

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company, details changed | Change City and State on the prospect, Unsubscribe (UI) | Check Logs Success. Company shows new values (proposed, unconfirmed) | None |
| 2 | Contact has 2 associated companies | Change City and State on the prospect, Unsubscribe (UI) | Check Logs Success. Latest associated company updated, other unchanged (proposed, unconfirmed) | None |
| 3 | Contact in HubSpot, no associated company | Unsubscribe (UI) | Check Logs Success. Nothing created or updated (proposed, unconfirmed) | None |
| 4 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Nothing created or updated (proposed, unconfirmed) | None |
| 5 | Contact has 1 associated company, details changed, real link | Change City and State on the prospect, Unsubscribe (link) | Check Logs Success. Company shows new values, same as row 1 (proposed, unconfirmed) | None |

### Create a Task in HubSpot

Extra Configuration: Rows 3 and 4 open the modal and never save it.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Modal never saved, Task Title empty (UI only) | Open Extra Configuration, fill Type Call, Priority Medium, Due In 3, leave Task Title empty | Save cannot be clicked (proposed, unconfirmed) | None |
| 4 | Due In 0 (UI only) | Fill Task Title, Type, Priority, leave Due In at 0 | Save cannot be clicked (proposed, unconfirmed) | None |

### Create a Note in HubSpot

Extra Configuration: None (paired with the activity named in each row).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact (skipped), contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact created, note shows Step 1, Variant A, Prospect Outcome (proposed, unconfirmed) | None |
| 2 | Paired with Update a Contact (skipped), contact in HubSpot | Unsubscribe (UI) | Check Logs Success. Note on the contact (proposed, unconfirmed) | None |
| 6 | Create a Note selected alone | Unsubscribe (UI) | Check Logs Success. No contact or note created (proposed, unconfirmed) | None |
| 7 | Paired with Create a Contact (skipped), real link | Unsubscribe (link) | Check Logs Success. Contact created, note same as row 1 (proposed, unconfirmed) | None |

### Record (log) an email activity in HubSpot

Extra Configuration: None (paired with the activity named in each row).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Tooltip (UI only) | Hover the activity | Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." (proposed, unconfirmed) | None |
| 2 | Only this activity selected (UI only) | Click Save | "Configuration Updated Successfully" (proposed, unconfirmed) | None |
| 3 | Paired with Create a Contact, contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Email logged on contact with From, To, "logged email by", date/time, step body (proposed, unconfirmed) | None |
| 4 | Paired with Update a Contact, contact in HubSpot, Deal Value 27800 | Unsubscribe (UI) | Check Logs Success. Email logged on the contact (proposed, unconfirmed) | None |
| 8 | Paired with Create a Contact, real link | Unsubscribe (link) | Check Logs Success. Contact created, email logged on it, same as row 3 (proposed, unconfirmed) | None |

## Phase 2: Extra Configuration values

### Create a Contact in HubSpot

Extra Configuration: Lead Status = Open, Lead Lifecycle = Marketing Qualified Lead.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 2 | Lead Status Open, Lifecycle MQL, contact not in HubSpot | Save values, add prospect, Unsubscribe (UI) | Check Logs Success. Contact created with Lead Status Open, Lifecycle Stage Marketing Qualified Lead, mapped fields (proposed, unconfirmed) | None |
| 4 | Contact at later Lifecycle Stage (Customer, set by hand) | Add prospect, Unsubscribe (UI) | Check Logs Success. Lifecycle Stage stays Customer (proposed, unconfirmed) | None |
| 6 | Values saved, contact in HubSpot, details changed | Change Job Title, City, State on the prospect, Unsubscribe (UI) | Check Logs Success. Contact shows new mapped values, Lead Status Open, Lifecycle Stage Marketing Qualified Lead (proposed, unconfirmed) | None |
| 7 | Values saved, reopen Extra Configuration (UI only) | Reopen Extra Configuration, try to clear both values | No empty option; picking the same value keeps it (proposed, unconfirmed) | None |

### Update a Contact in HubSpot

Extra Configuration: Update Lead Status = Connected, Update Lead Lifecycle = Sales Qualified Lead.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Update Lead Status Connected, Update Lead Lifecycle Sales Qualified Lead, contact at Lifecycle Stage Lead | Save the values, Unsubscribe (UI) | Check Logs Success. Lead Status Connected, Lifecycle Stage Sales Qualified Lead (proposed, unconfirmed) | None |

### Create a deal in HubSpot

Extra Configuration: Pipeline = Sales Pipeline, Pipeline Stage = Initial Contact, Deal Type = New Business, Deal Priority = High, Closing Date = 0 Days (rows 7 and 8 set Closing Date 1 Day and 51 Days).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Sales Pipeline, Initial Contact, New Business, High, Closing Date 0 Days, contact not in HubSpot | Save values, Unsubscribe (UI) | Check Logs Success. Contact and deal created and associated with configured values; close date empty (proposed, unconfirmed) | None |
| 7 | Prospect has Deal Value, Closing Date 1 Day | Set Closing Date 1 Day, Unsubscribe (UI) | Check Logs Success. Amount = Deal Value, close date = today + 1 (proposed, unconfirmed) | None |
| 8 | Closing Date 51 Days | Set Closing Date 51 Days, Unsubscribe (UI) | Check Logs Success. Close date = today + 51 (proposed, unconfirmed) | None |

### Update a deal in HubSpot

Extra Configuration: Pipeline = Sales Pipeline, Pipeline Stage = Follow-Up, Deal Type = New Business, Deal Priority = High (row 4 sets Closing Date 51 Days).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Sales Pipeline, Follow-Up, New Business, High, contact has 1 deal at Prospecting | Save values, Unsubscribe (UI) | Check Logs Success. Deal Stage Follow-Up, other values set (proposed, unconfirmed) | None |
| 4 | Closing Date 51 Days, contact has 1 deal | Set Closing Date 51 Days, Unsubscribe (UI) | Check Logs Success. Close date = today + 51 (proposed, unconfirmed) | None |

### Create a Task in HubSpot

Extra Configuration: Task Title = "Follow up from the workflow", Task Type = Call, Task Priority = Medium, Due In = 3 days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Title "Follow up from the workflow", Call, Medium, due in 3 days, contact in HubSpot | Save values, Unsubscribe (UI) | Check Logs Success. Task on the contact: title, type, priority, due today + 3 (proposed, unconfirmed) | None |
| 2 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and task created (proposed, unconfirmed) | None |
| 5 | Contact in HubSpot, real link | Unsubscribe (link), new CSV row | Check Logs Success. Task on the contact, same as row 1 (proposed, unconfirmed) | None |

### Create a Note in HubSpot

Extra Configuration: None (paired with the activity named in each row, with its Extra Configuration values).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Paired with Create a deal (values), contact not in HubSpot, Deal Value 25500 | Unsubscribe (UI) | Check Logs Success. Contact and deal created, note on the contact and on the deal (proposed, unconfirmed) | None |
| 4 | Paired with Update a deal (1 deal) | Unsubscribe (UI) | Check Logs Success. Note on the contact and on the deal (proposed, unconfirmed) | None |
| 5 | Paired with Update a Contact (values saved), contact in HubSpot | Unsubscribe (UI) | Check Logs Success. Note on the contact; contact has Lead Status Connected, Lifecycle Stage Sales Qualified Lead (proposed, unconfirmed) | None |

### Record (log) an email activity in HubSpot

Extra Configuration: None (paired with the activity named in each row, with its Extra Configuration values).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Paired with Create a deal, contact not in HubSpot, Deal Value 28200 | Unsubscribe (UI) | Check Logs Success. Email logged on the contact and on the deal (proposed, unconfirmed) | None |
| 6 | Paired with Update a deal, contact has 3 deals | Unsubscribe (UI) | Check Logs Success. Email logged on the contact and on the latest created deal (proposed, unconfirmed) | None |
| 7 | Paired with Update a Contact (values saved), contact in HubSpot, Deal Value 27800 | Unsubscribe (UI) | Check Logs Success. Email logged on the contact; contact has the saved values (proposed, unconfirmed) | None |

## Open questions

1. Expected HubSpot result of each activity for an unsubscribe (proposed: same as Email Sent).
2. Does the UI action fire the trigger exactly like the real link? The same Success log was seen; the HubSpot result of the UI action is not checked yet.
3. (Closed 2026-10-15, QA) Update a deal with Extra Configuration skipped: with one deal it is updated; with 3 deals the latest created deal is updated.
4. HubSpot result of a link opened twice (row 4): not checked, proposed "no second contact".
5. Is an unsubscribe-specific HubSpot property written? Not documented, no rows.
6. A prospect unsubscribed before any email is sent: not seen, no rows.
7. Not covered: Unsubscribe as Text (reply "Stop"), "Include Unsubscribe in Email Header", multi-step sequences (the sequence has one step, so no Step 2 note or email rows).
