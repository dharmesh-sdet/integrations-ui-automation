# Intended-behavior clarification

Post this when something reported as a bug turns out to be working as
designed (confirmed by the user, a developer, or the product owner). Leave the
ticket's description as it is unless the user asks you to change it. If the
same clarification applies to several tickets, post the same text on each
one, after one confirmation that covers all of them.

```
Clarifying the intended behavior for <Activity name> (<Trigger name> trigger), based on <further retesting | <name>'s confirmation>:

* <the rule as designed>
* <case that works>
* <case that does nothing>, this is expected, not a bug.
```

## Real example (AL-4043, comment 77177)

```
Clarifying the intended behavior for Mark Prospect as Replied (Contact Created/Properties Updated in HubSpot trigger), based on further retesting:

* The sequence selected in Extra Configuration is used only to check whether the prospect is already part of that sequence, not to add the prospect to it.
* If the prospect is already part of the selected sequence, it is correctly marked as Replied.
* If the prospect is not part of the selected sequence, the activity does nothing, this is expected, not a bug.
* If the prospect does not exist in Saleshandy yet, updating or creating the contact in HubSpot creates the prospect, but the activity does not add it to the sequence or mark it as Replied afterward, this is also expected.
```
