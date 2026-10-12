# Additional observation

Post this on the original bug when the same root cause also shows up in other
activities or workflows. Keep a single comment and edit it to add bullets as
more cases are confirmed (the edit goes through the confirmation gate too).
Instead of repeating results, each bullet points to the ticket that holds
them.

```
**Additional observation:**
The same <behavior> was also seen with <N> other activities on this trigger (<Trigger name>), not only with <original activity>:

* <Activity name>: <what happened, where it was seen> during <Staging | Production> retesting. See AL-XXXX for the related test results.

Also confirmed on the <other trigger> trigger:

* <Activity name>: <what happened>. See AL-XXXX for the related test results.
```

## Real example (AL-4039, comment 77157, shortened to 3 of 7 bullets)

```
**Additional observation:**
The same duplicate-workflow-execution behavior was also seen with six other activities on this trigger (Contact Created/Properties Updated in HubSpot), not only with Add Prospect in Saleshandy:

* Move Prospect to another sequence in Saleshandy: a single contact creation in HubSpot produced 8 log entries in Settings > Integrations > HubSpot > Logs during Staging retesting. See AL-3999 for the related test results.
* Mark Prospect as Unsubscribed in Saleshandy: a single contact creation in HubSpot produced 8 "marked as unsubscribed" entries in the prospect's Activities section (instead of 1) during Staging retesting. See AL-4000 for the related test results.

Also confirmed on the Deal Created/Properties Updated in HubSpot trigger:

* Mark Prospect as Unsubscribed in Saleshandy: a single deal creation with an associated contact produced multiple "marked as Unsubscribed" entries in the prospect's Activities section, 8 times when the contact was already a Saleshandy prospect, 10 times when it was not, instead of once. See AL-4066 for the related test results.
```
