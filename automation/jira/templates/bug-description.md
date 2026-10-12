# Bug description template

Send this as the `description` (markdown). Include only the sections you have
facts for. Note is optional.

```
**Prerequisites:**
- <setup or state needed before reproducing: integration connected, trigger
  enabled with which activity, Extra Configuration values, record state>

**Steps to Reproduce:**
1. <one action per line>
2. <...>
3. <where to check: Settings > Integrations > HubSpot > Logs, the record in
   HubSpot, the prospect in Saleshandy>

**Actual Result:**
- <what happened, including the status shown in Logs>
- <second symptom from the same workflow, if any>
- <evidence link, or "A screenshot will be attached to the ticket manually.">

**Expected Result:**
- <what should happen instead, from the user's notes or answer>

**Note:**
- <caveats only: secrets left out, workaround, related open bug>
```

## Field table to show at the confirmation gate

```
| Field | Value |
|---|---|
| Summary | <summary> |
| Project / Type | AL / Bug |
| Priority | Medium |
| Environment | Staging or Production |
| Epic Link | AL-xxxx |
| Assignee | Darshan |
| QA | Dharmesh Patel |
| Linked Work Items | Relates to AL-xxxx, AL-yyyy |
```

## Real example (AL-4107)

Summary: Prospect Outcome is updated in Saleshandy: Create a Deal in HubSpot
activity creates the contact without the mapped contact properties

Staging, Medium, Epic AL-3982, Relates to AL-4012 and AL-3984, Assignee
Darshan, QA Dharmesh Patel.

```
**Prerequisites:**
- Prospect Outcome is updated in Saleshandy trigger enabled with the "Create a deal in HubSpot" activity only.
- Extra Configuration:
  - Pipeline: Sales Pipeline
  - Pipeline Stage: Follow-up
  - Deal Type: New Business
  - Deal Priority: Medium
  - Closing Date: 0 Days
  - Select Outcome: Uncategorized
- Prospect exists in Saleshandy and is not a contact in HubSpot.
- Field mapping between Saleshandy and HubSpot contact properties is configured and verified.

**Steps to Reproduce:**
1. Open a prospect in Saleshandy that is not in HubSpot.
2. Add Company Revenue, Company HQ Location and Deal Value on the prospect and save.
3. Change the prospect outcome from Add Outcome to Uncategorized.
4. Open HubSpot and check the created contact and deal.
5. Change the Deal Value on the prospect in Saleshandy and change the outcome again.
6. Check the contact in HubSpot again.

**Actual Result:**
- The workflow triggers, the contact is created in HubSpot, and the deal is created.
- None of these contact properties are populated: Annual Revenue, Country/Region Code, City, Company Name, Country/Region, Employment Seniority, Job Title, Phone Number, State, Company Size and LinkedIn URL, even though the field mapping is configured correctly.
- After changing the Deal Value on the prospect and changing the outcome again, the deal is created with the updated deal amount, but the contact properties are still not populated.
- Retrying the same steps gives the same result.

**Expected Result:**
- When the contact is created by the Create a deal in HubSpot activity, the mapped contact properties from the prospect should be populated in HubSpot.
```

## Real example (AL-4060, "shows Success but" shape)

```
**Prerequisites:**
1. Have an active sequence running in Saleshandy with at least one prospect already enrolled.
2. The prospect's matching contact already exists in HubSpot.
3. Set up a trigger on "Prospect Outcome is updated in Saleshandy" with the activity "Update a Contact in HubSpot".
4. Have a HubSpot account connected to Saleshandy.

**Steps to Reproduce:**
1. Go to Triggers and Activities and set up the trigger "Prospect Outcome is updated in Saleshandy".
2. Select the activity "Update a Contact in HubSpot".
3. Open the Extra Configuration modal and select appropriate values for Lead Status and Lead Lifecycle.
4. Click Save on the Extra Configuration modal, then click Save on the Triggers and Activities page.
5. Navigate to Sequences, open the active sequence with the prospect already enrolled, go to Prospects.
6. On the Prospect Details page, update fields such as City, Job Title, State, and Country.
7. Change the prospect outcome to "Interested".
8. Check the activity logs (Integrations > HubSpot > Logs) and verify the contact in HubSpot.

**Actual Result:**
- The activity log shows the workflow status as Success, but the contact in HubSpot is not updated at all.
- Lead Status and Lead Lifecycle are not updated.
- Other fields updated on the prospect prior to changing the outcome (City, Job Title, State, Country) also do not get updated on the HubSpot contact, even though the workflow shows Success.

**Expected Result:**
- When the prospect outcome is changed to "Interested", the Update a Contact in HubSpot activity should update the existing HubSpot contact with the current field values (including Lead Status, Lead Lifecycle, City, Job Title, State, Country), matching the Success status shown in the logs.
```
