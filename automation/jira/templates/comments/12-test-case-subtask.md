# Test case table (workflow tracking sub-task)

Post this on the tracking sub-task for a workflow (for example the AL-3984
sub-tasks, one per trigger). It records which activities were tested and
their results. The shape is deliberately simple so it can be imported into
QMetry later. Don't switch to a heavier template (Preconditions, Severity,
Linked Defect columns) unless the user asks.

Rules:
- One row per activity, even when there is only one activity.
- Field Mapping: "Verified correct" only for Pass rows where the user
  confirmed the mapped data for that activity. "See bug" for Fail rows.
- Status: `Pass` or `Fail, AL-XXXX`.
- Leave evidence JSON out unless the user asks for it.

```
**What I did:**
<the trigger and which activities were tested, and on which environment>

**Steps:**
1. <step>
2. <step>

| # | Activity | Actual Result | Field Mapping | Status |
|---|---|---|---|---|
| 1 | <Activity name> | <what happened> | Verified correct | Pass |
| 2 | <Activity name> | <what happened> | See bug | Fail, AL-XXXX |
```

For a workflow that isn't an integration (no field mapping), drop the Field
Mapping column and use the Retest table shape instead.
