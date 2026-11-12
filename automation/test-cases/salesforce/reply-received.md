# Reply is Received in Saleshandy (Salesforce): Regression scenarios

Environment: staging (pyxis.lifeisgoodforlearner.com), account `sfreplyreceived`, Salesforce org `saleshandy-dev-ed`. Workflow ticket AL-4133 (parent AL-4131). This workflow has no sub-bugs, so Ticket is None for every row. QA approved this file on 2026-11-04 (37 rows, all 10 activities).

Expected results come from the developer log (`integration-skills/test-logs/salesforce/reply-received-in-saleshandy.md`, Refold v3 signed off) and the dev kit (`knowledge-base/product/workflow-behaviour-dev-kit.md`). A row marked (proposed, unconfirmed) has no source. Run it, record what happens, and report it. A different result is not an automatic failure. A row marked (accepted) shows behavior the developer accepted, so it is not filed as a bug.

Not covered, still open: the Note holds no reply text (accepted) and the Note sequence link uses the production host (draft in `jira/drafts`). Do not treat these as failures.

This file replaces the earlier drafts `reply-received-all-activities.md` and `reply-received-other-activities-proposal.md`, which stay as reference only.

## Test data setup

- Each row has its own new prospect with a unique name and email, added to the launched sequence. Wait for step 1 to show Sent in the Emails tab. Then Mark as replied. Use Emails tab > row > three dots. Or use Sequence > Prospects > tick the prospect > Mark as Replied icon.
- A record a row needs first (Lead, Contact, Account, Opportunity) is created by hand in Salesforce with the prospect's email. At least one value differs from the prospect's.
- Update a Account finds the Account by the prospect's full name, not by Company. Update a Opportunity finds the newest Opportunity whose Name is the prospect's email.
- After Mark as replied, wait 15 s and look in Salesforce. If the record is missing, wait 5 s, hard refresh and look again, then open Logs. A Logs Error is reported to QA, not failed.
- Every other trigger is off. Per section, select only the activities in its heading, then Save. Check the activity chips again after each save, because the Extra Configuration popup rewrites them.
- Mapping saved on the account: Lead (7 fields) and Contact. Account: Company to Account Name, plus Website, City, State, Country, Industry, Size, Revenue, Founded Year, Company Phone and HQ Location. Opportunity: Prospect Overview to Description, Deal Value to Amount, Closing Date to Close Date.
- Unmap Closing Date on the Opportunity mapping before the Opportunity rows. Restore it after.
- The live Refold version on staging is not known. Read it from the run steps of the first row. Rows that depend on v5 or later (an unmapped field stays untouched) are Update a Lead 2 and Create a Contact 1.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New tester opens Triggers & Activity for the first time. Reply Received is on, no activity picked yet | Open the activity dropdown and pick "Create a Lead in Salesforce". Do not Save | Dropdown lists 10 activities. A chip with x shows the pick. No Extra Configuration opens | None |
| 2 | Only "Create a Lead in Salesforce" is selected and every other trigger is off | Click Save, then reload the page | Success message shows. The toggle is on and the chip is still there after reload | None |
| 3 | Lead Properties mapping is empty and Save is disabled | Map the 7 fields, Save, reload | The mapping is saved and still there after reload | None |
| 4 | The sales manager switched Reply Received off and saved. A prospect, Marcus Oyelaran, has step 1 Sent | Mark as replied | No Logs entry after 3 min. No record in Salesforce | None |

## Create a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect José Peña-O'Brien, Revenue Operations Manager at Brightline Logistics, with email, phone and city filled. Not in Salesforce | Mark as replied | Success within 3 min. Exactly one Lead with the 7 mapped values as entered, accents and apostrophe included | None |
| 2 | Prospect Amelia Kowalski was imported from a CSV with no Company | Mark as replied | Logs shows Error and no Lead is created (Company is required, accepted). Report the Logs text to QA | None |
| 3 | Lead mapping is empty. Prospect Tobias Lindqvist, Company Northgate Freight | Mark as replied | Success. One Lead. Lead Status "Open - Not Contacted" and Owner Alias "ChintanS" (QA, 2026-10-16). Company is the prospect's own Company, Northgate Freight (QA, 2026-11-04: the "HubSpot" seen on 2026-10-16 was that prospect's Company, not a default) | None |
| 4 | A rep already saved prospect Fatima Rahman as a Contact after a call | Mark as replied | Success. No Lead is created. The Contact is unchanged | None |
| 5 | A rep already created a Lead for prospect Daniel Okafor, with Job Title "Office Manager". The prospect now has Job Title "Head of Operations" | Mark as replied | Still exactly one Lead for the email. Job Title shows "Head of Operations" (proposed, unconfirmed) | None |

## Update a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead for Chloe Bergmann exists with an old Job Title, Phone and Company. The prospect has new values for all three | Mark as replied | Success within 3 min. Still one Lead. The mapped fields show the prospect's values | None |
| 2 | Lead for Ravi Menon is at Lead Status "Working - Contacted". The prospect has a new Job Title | Mark as replied | Success. Title is updated. Lead Status stays "Working - Contacted" because it is not mapped | None |
| 3 | Prospect Hannah Whitcombe replies. Nobody created a Lead or Contact for her email | Mark as replied | Logs Success. No Lead is created (accepted) | None |

## Create a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect Sofia Marchetti, Procurement Lead at Alder & Finch Textiles, with phone, department and city filled. Not in Salesforce | Mark as replied | Success. One Contact with Name, Email, Business Phone, Department and Other Address. Title and Account Name stay empty (not mapped). No Lead | None |
| 2 | A Contact for Elijah Brandt already exists with an old Phone. The prospect has a new Phone | Mark as replied | Success. Still one Contact. Business Phone shows the new value (found by email, so it is updated) | None |
| 3 | A Lead for Naomi Castellano exists from a trade show. No Contact | Mark as replied | Logs Error DUPLICATES_DETECTED. No Contact is created. The Lead is unchanged (accepted: the Salesforce duplicate rule matches a Contact with a Lead) | None |

## Update a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact for Liam Ashworth exists with an old Phone and Department. The prospect has new values. The Contact has a Title | Mark as replied | Success. One Contact. Business Phone and Department show the new values. Title is unchanged | None |
| 2 | Prospect Zainab Hakimi replies. No Contact exists for her email | Mark as replied | Logs Success. No Contact is created (accepted) | None |

## Create a Account in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect Dana Whitfield, Company Harbourline Marine Supplies, with phone and city. No such Account | Mark as replied | Success. One Account with the mapped Company, phone and city. Record its Name (Company or "Dana Whitfield") for QA, because the developer log and the dev kit differ | None |
| 2 | An Account named like the new prospect's Company, Pinecrest Dental Group, already exists | Mark as replied | Record whether a second Account appears (proposed, unconfirmed) | None |
| 3 | Prospect Oskar Nilsson has no Company | Mark as replied | Record the Logs status. No Account without a name (proposed, unconfirmed) | None |

## Update a Account in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An Account named "Priya Venkataraman" (the prospect's full name) exists with an old Phone and City. The prospect has new values | Mark as replied | Success. One Account. Mapped values show the prospect's | None |
| 2 | An Account named after the prospect's Company, Redstone Packaging, exists. No Account has the prospect's full name | Mark as replied | Logs Success. The Account is unchanged and none is created (accepted, it matches by full name) | None |
| 3 | Prospect Gareth Lloyd replies. No Account matches him | Mark as replied | Logs Success. No Account is created | None |

## Create a Opportunity in Salesforce

Extra Configuration: Closing date 7 days, stage "Prospecting". Closing Date is unmapped first.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect Isabella Moreau, Deal Value 12000. Nothing in Salesforce | Mark as replied | Success. One Contact and one Opportunity linked to it. Close Date 7 days out, Stage "Prospecting", Amount 12000 | None |
| 2 | Isabella Moreau already replied once and her first Opportunity exists | Mark as replied again on the same step 1 email | A second Opportunity is created and none is updated (by design) | None |
| 3 | A tester opens the Extra Configuration and leaves Opportunity Stage empty | Click Save in the dialog | Save is blocked or a message names the missing stage. Record which (proposed, unconfirmed) | None |

## Update a Opportunity in Salesforce

Extra Configuration: Closing date 14 days, stage "Negotiation/Review" ("while updating").

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect Mateo Fernandez has two Opportunities named with his email: a stale one from last quarter and a new one. Both are in "Qualification" | Mark as replied | Only the newest changes: Stage "Negotiation/Review", Close Date 14 days out. The older one is unchanged | None |
| 2 | Prospect Yuki Tanaka has one Opportunity named with her email, Stage "Qualification" | Mark as replied | Success. Stage and Close Date change. Still one Opportunity | None |
| 3 | Prospect Connor Reilly replies. No Opportunity has his email as Name | Mark as replied | Logs Success. No Opportunity is created (accepted) | None |

## Attach Note in Salesforce (with Create a Contact)

Extra Configuration: None. Check Logs first, then the Note on the Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect Leila Haddad, outcome "Add Outcome". Create a Contact and Attach Note are selected | Mark as replied | Success. One Contact and one Note. Title "reply-received", Body with sequence, step, sender and email details. No reply text (accepted). Latest Outcome empty | None |
| 2 | Same setup, but a Contact for Henrik Solberg already exists | Mark as replied | Success. Still one Contact, updated. A new Note on it | None |
| 3 | The rep sets prospect Amara Obi's outcome to "Interested" before she replies | Change the outcome, then Mark as replied | The Note Body shows Latest Outcome "Interested" (QA, 2026-10-20) | None |

## Record(log) an Email Activity in Salesforce

Extra Configuration: Select Object. Check the Task in Salesforce.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Select Object "Contact". Contact for Wei Zhang exists | Mark as replied | Success. One completed Email Task linked to the Contact. Description can be empty, because Mark as replied has no reply text. "Email body:" can be empty (accepted) | None |
| 2 | Select Object "Lead". Lead for Patrick Doyle exists | Mark as replied | Success. One Task linked to the Lead | None |
| 3 | Select Object "Opportunity". Two Opportunities are named with Sienna Ward's email | Mark as replied | Success. One Task, linked to the newest Opportunity only | None |
| 4 | Select Object is left empty. Contact for Omar Haddad exists | Mark as replied | Logs Success. No Task and no crash | None |

## Combined activities

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A rep selects Create a Account and Create a Contact together. New prospect Julian Okoro, Company Silverbrook Hardware | Mark as replied | One Account and one Contact. Record whether the Contact is linked to the Account (proposed, unconfirmed) | None |

## Regression set (every release)

Only rows with a confirmed Expected can fail. These rows run every release: Baseline 1 to 4. Create a Lead 1, 3 and 4. Update a Lead 1 and 3. Create a Contact 1 and 3. Update a Opportunity 1. Attach Note 1. Record(log) 4. If something changes or QA asks, the other rows run too.

Rows total: 4 baseline + 32 activity + 1 combined = 37.
