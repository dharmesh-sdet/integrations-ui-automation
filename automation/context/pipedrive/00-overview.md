# Saleshandy to Pipedrive: overview

Platform: Pipedrive. Direction: Saleshandy event triggers Pipedrive activities (no Pipedrive-to-Saleshandy triggers in scope).
Workflow version in scope: `v2-fixes.json`.
Source files: `integration-tests/pipedrive/staging/<workflow>/` (workflow JSON).

## Sources and trust

All facts in this file and the seven workflow files come from QA's tester rules document pasted on 2026-10-23. That document was built from the workflow JSON files and from live runs on staging (Refold config 80121) on 2026-10-12 and 2026-10-13.

- Tag `[QA 2026-10-23]` means it came from that document.
- Nothing here has been seen in the Saleshandy UI yet. Do not treat any line as `[staging]` until a walkthrough confirms it.
- Where this file and `knowledge-base/product/saleshandy.md` differ, this file wins. The knowledge base lists a Prospect Finished trigger for Pipedrive and 8 rows in the release sheet; the document covers 7 workflows and has no Prospect Finished workflow (see Unclear).

## Workflows in scope

| # | Workflow (trigger name) | Activity subject in Pipedrive | Context file |
|---|---|---|---|
| 1 | Email Sent from Saleshandy | Email sent from Saleshandy | `email-sent.md` |
| 2 | Reply is Received in Saleshandy | Reply is Received in Saleshandy | `reply-received.md` |
| 3 | Link is Clicked in Saleshandy | Link is clicked in Saleshandy | `link-clicked.md` |
| 4 | Email is Opened in Saleshandy | Email Open Recorded in Saleshandy | `email-opened.md` |
| 5 | Email is Bounced in Saleshandy | Email is bounced in Saleshandy | `email-bounced.md` |
| 6 | Prospect is Unsubscribed in Saleshandy | Prospect is Unsubscribed in Saleshandy | `prospect-unsubscribed.md` |
| 7 | Prospect Outcome is updated in Saleshandy | Prospect Outcome is updated in Saleshandy | `prospect-outcome-updated.md` |

## Terms

- Event: one Saleshandy action that starts a workflow run (an email sent, a reply, a click).
- Action slot: one of the "Select ... Action 1" to "Action 11" dropdowns on the Triggers & Activity tab. Each slot holds one CRM action.
- Mapping: the field pairs on the Field Mapping tab (Saleshandy field to CRM field).
- Run: one execution of the workflow in Refold. Each run has a node log.

## Checks before testing

Most "nothing happened" reports come from a missed check, not from a workflow bug.

1. The CRM is connected in Saleshandy Settings > Integrations.
2. The workflow is ON and the configuration popup is saved. After a disconnect and reconnect, Saleshandy drops the event subscriptions: a workflow can show as enabled and never run. Fix: turn the workflow off and on, then save the popup again.
3. The live workflow is the latest version (v2). In one pass, the Unsubscribed workflow still ran the old v1 definition. The node names in the run log show the version: v1 has "Find a deal" and "Create a person"; v2 has "Find person's latest deal" and "Person - Find a person".
4. Field mappings are saved. Do not map Expected Close Date: a date conversion issue was seen on HubSpot, so QA left it out (2026-10-23). With an empty mapping the workflow sends only the fixed fields (name, email, company). That is a setup gap, not a bug.
5. Mapped values have a compatible type. One wrong type makes Pipedrive reject the whole record, so the run creates no record and no activity. Example: Organization `industry` is a picklist, Saleshandy holds free text.
6. Email is Opened: open tracking is on in the sequence settings.
7. Reply Received: Saleshandy detected the reply (the prospect shows as replied). If it did not, no event goes to the CRM.
8. Use a new prospect email for each scenario, for example `yourname+pipedrive-e1@company.com`. A reused prospect gives results from earlier runs.
9. Refold can mark a run COMPLETED before it logs the last nodes (developer note). In the UI the send is done when the Emails tab row shows Sent. Wait 15 seconds after the event shows in Saleshandy, look in Pipedrive first, open Logs only if the record is missing (QA 2026-10-23).
10. Link scanners and email previews can click links. One real click can give 2 or 3 "Link is Clicked" runs and 2 or 3 activities. That is Saleshandy event behavior, not a workflow bug.

## Known issues (already reported or decided, do not file again)

| Id | What | Status |
|---|---|---|
| Z-7 | "Meeting Booked" in the category dropdown never matches. The webui saves the key `:Meeting Booked` (with a colon) in `saleshandy-webui/src/components/settings/components/integrations/utils/helper.ts:48`; the event sends `Meeting Booked`. The category gate is false and the run does nothing. | Reported, webui bug |
| B1 | Update a Person with no person in Pipedrive: run ERRORS with `Missing required url param: id`. | Open, reported |
| B2 | Update a Deal or Delete Deal with no person in Pipedrive: run ERRORS (`GET /v1/persons/null/deals` returns 403). | Open, reported |
| (none) | `\"` shown inside HTML attributes of the activity note (double escape). QA decided on 2026-10-15 not to fix it for Pipedrive. | Decided, kept |
| (none) | Update a Deal in Prospect Outcome: the rule checks Action slot 2 twice and never checks slot 5. A deal action placed in slot 5 does not run. Same gap in v1. Found offline in review, not yet reported. | Proposed bug, unconfirmed. File once, only after QA says it is a bug. |

## Configuration the tester can set

| Setting | Values |
|---|---|
| Action slots 1 to 11 | Create a Lead, Create a Deal, Create a Person, Update a Deal, Update a Person, Delete Deal, Delete Person, Create Organization, Update Organization, Delete Organization |
| Select Pipeline (Applicable for Deals) | Pipeline list from Pipedrive |
| Select Pipeline Stage (Applicable for Deals) | Stage list from Pipedrive |
| Select Saleshandy Conversation Category | Prospect Outcome only |
| Mappings | Contact Fields (person), Deal Fields, Organisation Fields |

The workflow JSON also has an "update-lead" rule. The webui does not offer "Update a Lead", so that rule never runs. Ignore it.

## The shared person step

If Create a Lead, Create a Deal or Create a Person is selected, the workflow first runs ONE shared person step:

1. It searches Pipedrive persons by the prospect email. The match is exact and not case-sensitive.
2. If a person exists, it updates that person. If not, it creates one.
3. Person name = `First Name Last Name`. If both are empty, the name is `(No Name)`.
4. The email and the Contact Fields mapping are sent.
5. The lead, the deal and the create-person activity all use this one person.

So, like HubSpot, Create a Deal on a new prospect creates the person first and then the deal on that person. The same applies to Create a Lead. Lead + Deal + Person on a new prospect give exactly 1 person. Two persons with the same email is a bug.

## Rules per action

### Create a Person

- Runs the shared person step (create or update).
- Adds one activity on the person: type email, marked done, subject from the workflow table above.
- In Email Sent, this activity also contains the full email body.

### Update a Person

- Finds the person by email and updates name, email and the Contact Fields mapping.
- Adds one activity on the person. In Email Sent, this activity does NOT contain the email body.
- If no person exists, the workflow does not create one. The run ERRORS (known B1).

### Create a Lead

- Runs the shared person step, then creates a NEW lead on that person on every event. Duplicate leads are expected.
- Lead title = prospect email. In Reply Received, the lead title = `First Name Last Name`.
- No activity is added for a lead.

### Create a Deal

- Runs the shared person step, then creates a NEW deal on that person on every event. Duplicate deals are expected.
- Deal title = prospect email. In Reply Received, the deal title = `First Name Last Name`.
- Pipeline and Stage come from the configuration.
- Value and Expected Close Date come from the Deal Fields mapping. Pipedrive accepts the Saleshandy date `2026-11-30 00:00:00` and string values (live test E4).
- The deal is not linked to an organization. No activity is added for a deal.

### Update a Deal

- Finds the person by email, then takes that person's NEWEST deal (by add time).
- Updates only that newest deal: title = prospect email, Pipeline and Stage from the configuration, Deal Fields mapping. Older deals stay unchanged.
- In every workflow Update a Deal sets the title to the email. In Reply Received this renames a deal that the workflow created with the person name. Naming was kept by decision.
- If the person has no deal, nothing happens.
- If no person exists, the run ERRORS (known B2).

### Delete Deal

- Deletes only the NEWEST deal of the person found by email. Older deals stay.
- No person: known B2 (run errors).

### Delete Person

- Deletes the person found by email. If no person exists, nothing happens.

### Create Organization

- Creates a NEW organization on every event. Name = prospect Company, plus the Organisation Fields mapping. It does not check for an existing organization, so duplicates are expected.
- The organization is not linked to the person or the deal. QA decided not to add new links.

### Update Organization

- Searches organizations by the exact company name. The match is case-sensitive.
- Updates the first exact match with the name and the Organisation Fields mapping.
- If no organization matches, nothing happens. It does not create one.

### Delete Organization

- Same exact-name match, then deletes the organization.
- Pipedrive returns a deprecation warning for this endpoint. It is information only.

## Activities

- Activities are made only by Create a Person and Update a Person. Lead, Deal and Organization actions add no activity.
- The activity is on the person only (`deal_id` is empty).
- If both Create a Person and Update a Person are selected, the person gets 2 activities for one event.
- Reply Received uses activity type `Email` (capital E). The others use `email`. Both show as an email activity.

## Combined actions: what one event gives

| Actions selected | Prospect | Expected result |
|---|---|---|
| Create a Person | New | 1 person + 1 activity |
| Create a Person | Exists | Same person updated, 2nd activity, still 1 person |
| Create a Lead | New | 1 person + 1 lead on it, no activity |
| Create a Deal | New | 1 person + 1 deal on it in the configured pipeline and stage |
| Lead + Deal + Person | New | Exactly 1 person with 1 lead, 1 deal, 1 activity |
| Update a Deal | Person with 2 deals | Only the newer deal changes |
| Delete Deal | Person with 2 deals | Only the newer deal is deleted |
| Create Organization | Any | 1 new organization, not linked |
| Update Organization | Org with the same name exists | That org updated |
| Update a Person / Update a Deal / Delete Deal | No person in Pipedrive | Run ERRORS (known B1, B2) |

## Do not file these

| Seen in Pipedrive | Why it is not a bug |
|---|---|
| Deal or lead title is the email, not the name | By design (except Reply Received, which uses the name) |
| New deal, lead or organization on every event | By design. These actions always create. |
| Organization not linked to person or deal | Decision: no new links |
| No activity after Create a Lead or Create a Deal | Activities come only from the person actions |
| Only the newest deal changed or deleted | By design |
| Update Organization did nothing | No exact, case-sensitive name match |
| `\"` in activity notes | Known double escape, kept by decision |
| Run errors for update-person, update-deal or delete-deal with no person | Known B1 and B2, already reported |
| Delete Organization deprecation warning | Information only |
| Record rejected for a mapped field (for example `industry`) | Mapping type mismatch (check 5) |
| Category workflow did nothing | Category does not match the outcome, or the "Meeting Booked" key bug (Z-7) |

## What is a bug in Pipedrive v2

- Two persons with the same email from one event.
- A lead or deal with no person.
- An older deal changed instead of the newest one.
- A wrong pipeline or stage.
- An activity on the wrong person.

## Evidence to attach when filing a bug

- The workflow name and version (from the node names in the run log).
- The Refold execution id and the run status.
- The action slots and the configuration values used.
- The prospect email.
- The CRM record ids and the field values read back from the CRM.
- The rule in this file that the result breaks.

## Unclear: expected functionality (proposed)

Nothing below is a fact. Each point is asked in stage 2.

1. How each Saleshandy event is triggered in the UI and how long until it reaches Pipedrive: not in the document. Proposed: same as the HubSpot equivalents (`context/hubspot/`), wait 15 seconds after the event shows in Saleshandy, check the CRM first, Logs only if the record is missing.
2. Whether all 7 workflows show the same 10 actions in all 11 slots: the document lists one set. Proposed: yes, same set in each workflow.
3. The exact fields in the activity note body per workflow (sequence name, step, sender, counts): not in the document for Pipedrive. Proposed: assert only the subject, type, person and the email body where stated (Create a Person in Email Sent).
4. Update a Deal in slot 5 (Prospect Outcome): proposed expected result is that it runs like any other slot. The workflow today does not run it. Counted as a product question, not a failure, until QA confirms.
5. Prospect Finished: the knowledge base lists it as a Pipedrive trigger. The document has no such workflow. Proposed: out of scope for this round.
6. Pipeline and Stage lists, mapped field names and their types on the staging Pipedrive account: not read yet. Needed before any row asserts a mapped value.
