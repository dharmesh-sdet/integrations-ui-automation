# Retest table

Use for several scenarios retested at once, on Staging or Production. One row
per scenario, even when there is only one row. The Note is optional; use it to
explain "working as intended" rows, edge cases, or which bugs the failures are
filed as.

```
**What I did:**
Retested on <Staging | Production>. <Trigger name> trigger, <Activity name> activity, with Extra Configuration set to <values, or "left empty">.

**Steps:**
1. <setup step>
2. <action that fires the workflow>
3. <where checked: Settings > Integrations > HubSpot > Logs, the record in HubSpot or Saleshandy>

| # | Scenario | Actual Result | Status |
|---|---|---|---|
| 1 | <precondition or variation> | <what happened, including workflow status> | Pass |
| 2 | <...> | <...> | Pass, working as intended |
| 3 | <...> | <...> | Fail, AL-XXXX |

**Note:** <optional>
```

Variant with expected results, when the scenarios come from a test matrix:

```
| # | Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
```

Use `**Remarks:**` with a numbered list instead of Note when there are
several unrelated side findings (see SH-20233 comment 77476).

## Real example (AL-4062, comment 78546, Staging)

```
**What I did:**
Retested on Staging. Prospect Outcome is updated in Saleshandy trigger, Update a deal in HubSpot activity, with Extra Configuration set to Pipeline: Sales Pipeline, Pipeline Stage: Prospecting, Deal Type: Existing Business, Deal Priority: High, Closing Date: 5 Days, Select Outcome: Meeting Booked.

**Steps:**

1. Enable the Prospect Outcome is updated in Saleshandy trigger and select the Update a deal in HubSpot activity.
2. Fill in the Extra Configuration and save.
3. Use a prospect in a sequence that is already a contact in HubSpot.
4. Change the prospect outcome.
5. Navigate to Integrations > HubSpot > Logs, check the workflow status, then check the deals in HubSpot.

| # | Scenario | Actual Result | Status |
| --- | --- | --- | --- |
| 1 | Contact has 3 deals (Proposal Sent, Proposal Sent, Prospecting), Extra Configuration saved with empty fields | Workflow Success, nothing changes in HubSpot | Pass |
| 2 | Contact has 3 deals (Proposal Sent, Proposal Sent, Prospecting), Extra Configuration filled | Log created, workflow Success, a deal gets updated | Pass |
| 3 | Contact has 4 deals created at different times | Workflow Success, the first created deal is updated instead of the latest created deal | Fail, AL-4108 |
| 4 | Contact has one deal | Workflow Success, Deal Stage, Closing Date, Deal Type and Deal Priority updated | Pass |
| 5 | Contact exists in HubSpot with no deal | Log created, workflow Success, no deal is created or updated | Pass |
| 6 | Contact does not exist in HubSpot | Log created, workflow Success, neither the contact nor a deal is created | Pass |
| 7 | Pipeline, Stage, Deal Type, Priority and Closing Date configured | All values applied on the deal | Pass |
```

## Real example of a Note (AL-4000, comment 77193)

```
**Note:** Scenarios 2, 3, and 4 match the intended design already confirmed for Mark Prospect as Replied and Mark Prospect as Finished: the sequence is only used to check existing membership, not to add the prospect. Scenarios 5 and 6 are genuine bugs, filed as AL-4047 (sub-sequence not recognized) and AL-4048 (Activity log omits the Pause Delay in Days).
```
