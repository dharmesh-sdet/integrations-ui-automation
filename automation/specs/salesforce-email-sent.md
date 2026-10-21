# Email Sent from Saleshandy (Salesforce): Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com), Salesforce Developer Edition org `saleshandy-dev-ed`. Mode: Regression. Sub-task: AL-4132 (parent AL-4131). No bug tickets, every Ticket cell is "None".

Activities are tested as a real user would configure them: Lead or Contact for the person, Opportunity for the deal, and Note or Record Email Activity paired with one of those. Update activities are tested with their natural pair (a user updates an existing record, not an empty one). Each Expected checks the specific fields the user would look for on the Salesforce record.

Two phases. Phase 1: Extra Configuration empty or none. Phase 2: Extra Configuration filled. Run Phase 1 first (saved values cannot be cleared, **(proposed, unconfirmed)** for Salesforce).

Field mapping: configured before the run (Lead, Contact, Account, Opportunity properties). The Expected columns name the fields to check on the Salesforce record.

## Test data setup

- Account: `sfemailsent` (Saleshandy staging, Salesforce connected, session saved by QA).
- Sequence: 2 steps, no A/B variants, Active.
- "Send the email": Add Prospects (one at a time), then Emails tab > three dots > Send now.
- Each row uses its own unique prospect. Salesforce records (Lead, Contact, Opportunity) created in Salesforce UI where the scenario needs them.
- Triggers: only "Email Sent from Saleshandy" enabled. Each row selects the activity (or pairing) under test, then Save.
- Logs: refresh 15 s, then every 10 s until Success (~1 min).
- Verify in Salesforce itself (Leads/Contacts/Opportunities tab, record detail, Activity timeline).

## Phase 1: Extra Configuration empty or none

### Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Email Sent from Saleshandy", select Create a Lead, Save | "Configuration Updated Successfully" | None |
| 2 | Only Reply Received enabled | Send the email | No Email Sent entry in Logs, no record created | None |

### Create a Lead in Salesforce

Extra Configuration: None (no modal).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Salesforce, has First Name, Last Name, Email, Company | Send the email | Success. Lead in Salesforce: First Name, Last Name, Email, Company match the prospect. Lead Status = "Open - Not Contacted". Owner = connected user **(proposed, unconfirmed)** | None |
| 2 | Same email already exists as a Lead | Send the email | Existing Lead is updated with the new mapped values, or a new Lead is created **(proposed, unconfirmed)** | None |
| 3 | Prospect has no Company (required field) | Send the email | Error in Logs, no Lead created **(proposed, unconfirmed)** | None |

### Create a Lead in Salesforce + Attach Note

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Salesforce | Send the email | Success. Lead created. Note on the Lead shows Step 1, Variant A and Prospect Outcome **(proposed, unconfirmed)** | None |
| 2 | Step 2 sent (same prospect as row 1) | Send now on step 2 | New Note on the Lead shows Step 2, Variant A **(proposed, unconfirmed)** | None |

### Create a Contact in Salesforce: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in Salesforce, Extra Config skipped | Send the email | Success. Contact in Salesforce: First Name, Last Name, Email match the prospect. Company name, industry, country from mapped fields **(proposed, unconfirmed)** | None |
| 2 | Contact already in Salesforce, prospect details changed | Send the email | Contact shows the new values **(proposed, unconfirmed)** | None |

### Update a Contact in Salesforce + Record(log) an Email Activity

A real user pairs Update Contact with Record Email to log outreach on existing contacts.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in Salesforce, prospect details changed | Send the email | Success. Contact shows updated values. Email logged on the Contact's Activity timeline with From, To, date/time and step body **(proposed, unconfirmed)** | None |
| 2 | Contact not in Salesforce | Send the email | Success in Logs, no Contact created, no email logged **(proposed, unconfirmed)** | None |

### Create a Opportunity in Salesforce: Extra Configuration empty

Extra Configuration: Closing Date and Stage [docs]. Whether the modal can be saved empty is **(proposed, unconfirmed)**.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in Salesforce, Extra Config saved empty | Send the email | Success or Error (Stage and Close Date are required): **(proposed, unconfirmed)** | None |

### Attach Note selected alone

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Only Attach Note selected, no pairing | Send the email | Success in Logs; no Note on any record **(proposed, unconfirmed)** | None |

### Record(log) an Email Activity selected alone

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Only Record(log) selected, no pairing | Send the email | Error in Logs, nothing logged **(proposed, unconfirmed)** | None |

## Phase 2: Extra Configuration filled

### Create a Contact in Salesforce: Extra Configuration values

Extra Configuration fields **(proposed from HubSpot: Lead Status, Lifecycle; unconfirmed on Salesforce)**.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in Salesforce, Lead Status and Lifecycle set | Send the email | Success. Contact created with the configured Lead Status and Lifecycle, plus mapped fields (First Name, Last Name, Email, company) **(proposed, unconfirmed)** | None |
| 2 | Values saved before | Reopen Extra Config | Saved values show. Fields cannot be cleared **(proposed, unconfirmed)** | None |

### Create a Opportunity in Salesforce: Stage and Closing Date

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in Salesforce, no Opportunity, Stage = Prospecting, Closing Date = 0 Days | Send the email | Success. Opportunity in Salesforce: Stage = Prospecting, Close Date = today or empty (0 Days). Associated to the Contact **(proposed, unconfirmed)** | None |
| 2 | Contact not in Salesforce | Send the email | Opportunity created; Contact or Lead also created **(proposed, unconfirmed)** | None |
| 3 | Contact already has 1 Opportunity | Send the email | New Opportunity created, Contact has 2 **(proposed, unconfirmed)** | None |
| 4 | Closing Date = 1 Day | Send the email | Close Date = today + 1 **(proposed, unconfirmed)** | None |
| 5 | Prospect has Deal Value | Send the email | Opportunity Amount = Deal Value **(proposed, unconfirmed)** | None |

### Create a Opportunity + Record(log) an Email Activity

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in Salesforce, Stage and Closing Date set | Send the email | Opportunity created. Email logged on the Opportunity and on the Contact **(proposed, unconfirmed)** | None |

### Update a Opportunity in Salesforce

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 Opportunity, Stage and Closing Date set | Send the email | Opportunity shows the configured Stage and Close Date **(proposed, unconfirmed)** | None |
| 2 | Contact has 3 Opportunities | Send the email | The latest created Opportunity is updated, others unchanged **(proposed, unconfirmed)** | None |
| 3 | Contact has 0 Opportunities | Send the email | Nothing created or updated **(proposed, unconfirmed)** | None |

## Open questions for QA

1. Extra Configuration fields for Create/Update Contact, Create/Update Opportunity on this trigger (open each modal on staging).
2. Does Create a Opportunity also create the Contact or Lead when missing?
3. What does Record(log) an Email Activity show on the Salesforce Activity timeline (From, To, body, subject)?
4. Attach Note + Lead pairing: does Note appear on the Lead, or only Contact and Opportunity?
5. Lead Status on a created Lead without extra config: "Open - Not Contacted"?
