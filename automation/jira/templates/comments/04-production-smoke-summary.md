# Production smoke summary

Post this on the workflow's tracking ticket once its Production smoke test
is done. Use one row per activity, in product UI order. Put the fixed tickets
each check covers in brackets. The Note lists the tickets that are still open
and not covered, plus any caveat that prevents a false failure.

```
**Verification:** Production testing is done. Smoke tested the <Trigger name> trigger on Production, all <N> activities:

| # | Activity | What was checked | Status |
|---|---|---|---|
| 1 | <Activity name> | <one-line check> (<AL-XXXX>). | Pass |

**Note:** <AL-XXXX (<short summary>) is still open and not covered by this verification.> <Expected-behavior caveat, if any.>
```

## Real example (AL-4012, comment 78743)

```
**Verification:** Production testing is done. Smoke tested the Prospect Outcome is updated in Saleshandy trigger on Production, all 9 activities:

| # | Activity | What was checked | Status |
| --- | --- | --- | --- |
| 1 | Create a Contact in HubSpot | Workflow Success, contact created with the mapped properties (AL-4025). | Pass |
| 2 | Update a Contact in HubSpot | Workflow Success, contact is actually updated (AL-4060). | Pass |
| 3 | Create a Deal in HubSpot | Deal created and associated to the contact; contact created with the mapped properties for a new prospect (AL-4061, AL-4107). | Pass |
| 4 | Update a Deal in HubSpot | With multiple deals, the latest created deal is updated (AL-4062, AL-4108). | Pass |
| 5 | Create a Company in HubSpot | Company created and associated; contact has the mapped properties (AL-4063, AL-4107). | Pass |
| 6 | Update a Company in HubSpot | Company updated; with two companies the latest is updated and the first is unchanged (AL-4064, AL-4109, AL-4110). | Pass |
| 7 | Create a Task in HubSpot | Task created with the configured values and no extra note; Due in 0 and an empty Task title cannot be saved (AL-4065, AL-4112, AL-4101). | Pass |
| 8 | Create a Note in HubSpot | Paired with Create a Contact and Create a Deal, the Note is created. | Pass |
| 9 | Record (log) an Email Activity in HubSpot | Paired with Update a Contact and Update a Deal, the contact and the latest created deal are updated. | Pass |

**Note:** AL-4106 (Hiring Date Picker error on Create a Contact) and AL-4111 are still open and not covered by this verification. An empty description and Unknown Contact on the logged email are expected on this trigger since no email is sent (AL-4113).
```
