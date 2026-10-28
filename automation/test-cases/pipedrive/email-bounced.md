# Email is Bounced in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging, workflow version v2. The workflow ticket is AL-4183. No sub-bugs are known, so every Ticket cell is None. Expected results come from the action rules in `context/pipedrive/00-overview.md`. Rows marked (proposed, unconfirmed) have an Expected result that is not documented and not yet seen. A different result there is not automatically a failure.

No bounce-specific rule is documented for Pipedrive. A bounce does not tag or flag the person. Only the actions in the slots run.

Not covered, still open: B1 (Update a Person with no person) and B2 (Update a Deal or Delete Deal with no person) are already reported. Rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped and not tested.

## Test data setup

- Account: `gpipedrive`. Email Sent is turned OFF while these rows run, and the Email Sent session is told before any trigger is saved.
- Sequence: a new sequence with 2 steps, Active, so each prospect has a row in the Emails tab.
- Each row has its own new prospect, for example `yourname+pipedrive-b1@mailinator.com`, added with Add Prospects.
- Bounce the email (manual): Emails tab > the prospect's row > Actions > Mark as bounced. Send now is not needed. A prospect can be marked as bounced only once.
- Real bounce: one row only (cap 1, QA 2026-10-27). The prospect email is `name@<company>.mailinator.com`.
- After the bounce, wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Triggers: every other trigger off, only "Email is Bounced in Saleshandy" on. Each section selects only the actions in its heading, then Save and wait for "Configuration Updated Successfully".
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive with an old value, so a change proves the update.
- Mapping saved for Contact, Deal and Organisation fields. Deal Fields maps Value only. Organization is not mapped to Company. Pipeline = Pipeline, Stage = Qualified (Contact Made for Update a Deal).
- Before the first row, read the node names in one run log. v2 shows `Find person's latest deal` and `Person - Find a person`. A v1 result is a setup gap, not a v2 bug.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Email is Bounced in Saleshandy", select Create a Person, click Save | "Configuration Updated Successfully" | None |
| 2 | Create a Person selected, prospect not in Pipedrive, sequence Active | Mark the step 1 email as bounced | Person created. One activity: type email, done, subject "Email is bounced in Saleshandy" | None |
| 3 | Create a Person selected, sequence paused after being Active | Mark the step 1 email as bounced | Same as row 2 (proposed, unconfirmed) | None |
| 4 | Only "Reply is Received in Saleshandy" enabled | Mark the step 1 email as bounced | No person created in Pipedrive | None |
| 5 | Create a Person selected, real-bounce address, prospect not in Pipedrive | Send the step 1 email, wait for Saleshandy to set Bounced | Emails tab shows Bounced. Person and one activity created, same as row 2 (proposed, unconfirmed) | None |

## Create a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the step 1 email as bounced | 1 person named First Last, with the mapped fields. One activity: email, done, subject "Email is bounced in Saleshandy" | None |
| 2 | Person exists with an old value in a mapped field | Mark the step 1 email as bounced | Person updated, still 1 person. A further activity is added | None |
| 3 | Person exists, email stored in a different letter case | Mark the step 1 email as bounced | The same person is updated. No second person | None |
| 4 | Prospect has no first name and no last name | Mark the step 1 email as bounced | Person created with the name "(No Name)" | None |

## Update a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Mark the step 1 email as bounced | Mapped fields updated. One activity added | None |
| 2 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Run ends in Error (known B1). No person is created | None |

## Create a Lead

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Person created. One lead on it, titled with the prospect email. No activity | None |
| 2 | Person exists | Mark the step 1 email as bounced | Person updated, still 1 person. New lead on it | None |
| 3 | Person already has a lead | Mark the step 1 email as bounced | A second lead is added. The first lead is unchanged | None |

## Create a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Person created. Deal on it titled with the prospect email, in Pipeline / Qualified, Value from the prospect. No activity, no organization link | None |
| 2 | Person has 1 deal | Mark the step 1 email as bounced | New deal added. The existing deal is unchanged | None |
| 3 | Extra Configuration saved with Stage = Proposal Made | Mark the step 1 email as bounced | New deal is in Pipeline / Proposal Made | None |

## Update a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark the step 1 email as bounced | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made, mapped Value. The older deal is unchanged | None |
| 2 | Person exists with no deal | Mark the step 1 email as bounced | Nothing is created or changed | None |
| 3 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Run ends in Error (known B2). No person is created | None |

## Delete Deal

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark the step 1 email as bounced | Only the newest deal is deleted. The older deal stays | None |
| 2 | Person exists with no deal | Mark the step 1 email as bounced | Nothing is deleted | None |
| 3 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Run ends in Error (known B2). No person is created | None |

## Delete Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Mark the step 1 email as bounced | Person is deleted | None |
| 2 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Nothing happens | None |

## Create Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Mark the step 1 email as bounced | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 2 | An organization with that name already exists | Mark the step 1 email as bounced | A second organization with the same name is created (by design) | None |

## Update Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Mark the step 1 email as bounced | First exact match updated with the name and mapped fields | None |
| 2 | An organization exists with the same name in a different letter case | Mark the step 1 email as bounced | Nothing is created or updated (match is case-sensitive) | None |

## Delete Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Mark the step 1 email as bounced | Organization is deleted. The Pipedrive deprecation warning is information only | None |

## Combined actions

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Mark the step 1 email as bounced | Exactly 1 person with 1 lead, 1 deal and 1 activity | None |
| 2 | Create a Person and Update a Person both selected, person exists | Mark the step 1 email as bounced | Still 1 person, 2 activities for the one event | None |
| 3 | Create a Person and Create Organization selected, prospect has a company | Mark the step 1 email as bounced | 1 person and 1 organization. The organization is not linked to the person | None |

## Trigger screen (UI only)

No prospect is bounced.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger "Email is Bounced in Saleshandy" switched on | Open an action slot dropdown | Lists 10 actions. Lead: Create a Lead. Deal: Create a Deal, Update a Deal, Delete Deal. Person: Create a Person, Update a Person, Delete Person. Organization: Create, Update, Delete Organization | None |
| 2 | Create a Deal added | Open its Extra Configuration | Pipeline lists "Pipeline". Stage lists Qualified, Contact Made, Demo Scheduled, Proposal Made, Negotiations Started | None |
| 3 | Create a Deal saved with Stage = Proposal Made | Close and reopen the Extra Configuration | Saved Pipeline and Stage are shown (proposed, unconfirmed) | None |
| 4 | Create a Deal Extra Configuration with Pipeline and Stage empty | Look at the modal, try Save | Save is disabled (proposed, unconfirmed) | None |
