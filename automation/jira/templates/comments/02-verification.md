# Verification

The default short comment: a fix is confirmed. One or two sentences: the
environment, trigger then activity, the scenario, and the result now. Add
"Pass." at the end if the user wants it.

```
**Verification:** Retested on <Staging | Production> after the fix. <Trigger name> trigger, <Activity name> activity: <scenario>, <what now happens>.
```

## Variant: sign-off for the whole ticket

```
**Verification:**
All scenarios reported on this ticket (<what they were>) have been retested on <Staging | Production> and pass.
```

Add "Moving this ticket to Done." only if the user is moving it.

## Variant: after the developer says "not a bug"

```
**Verification:** Understood from <name>'s comment. Tested <what> on <environment>:

- <case that shows the feature works>. Pass.
- <case from the ticket>: <what happens>. This is expected, since <reason the developer gave>.
```

## Real examples

AL-4108, comment 78602:
```
**Verification:** Retested on Staging after the fix. Prospect Outcome is updated in Saleshandy trigger, Update a deal in HubSpot activity: for a contact with 4 associated deals created at different times, changing the prospect outcome to Meeting Booked now updates the latest created deal, and the older deals are unchanged.
```

AL-4018, comment 77261 (sign-off):
```
**Verification:**
All scenarios reported on this ticket (the original field mapping bug, and the follow-up custom field mapping scenarios covered in the comments above) have been retested on Staging and pass. Moving this ticket to Done.
```

SH-20233, comment 77530 (Production, non-integration ticket):
```
**Verification:**
Retested the steps to reproduce above on Production. After migrating the prospect from Step 1 to Step 3, the old step's unified email record is deleted along with its task and email records, and the Unified Inbox opens without the permissions error. Also covered all the scenarios from the Staging retest above on Production. All pass.
```

AL-4113, comment 78610 (after "not a bug"):
```
**Verification:** Understood from Rudra's comment. Tested both on Staging with Record (log) an email activity paired with Update a contact and Update a deal:

* Email sent from Saleshandy trigger: after the email is sent, the logged email activity in HubSpot has the description (email body) populated and a known From. Pass.
* Prospect Outcome is updated in Saleshandy trigger: the description is empty and From shows Unknown Contact, as in the ticket. This is expected, since no email is sent when only the outcome changes.
```
