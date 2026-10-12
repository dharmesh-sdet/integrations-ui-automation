# Test scenario generation template (Saleshandy and HubSpot integration)

Use this to generate test scenarios for one workflow (trigger) of the
Saleshandy and HubSpot integration. It is self-contained: it does not
depend on any project files.

It combines two sources of how this integration was actually tested:

- **Production smoke testing** set the writing style: short, executable,
  one action and one confirmation per check. These were enough to run the
  tests without extra explanation.
- **Staging regression testing** set the coverage: the variations that were
  explored for each activity (record exists or not, single or multiple
  associations, Extra Configuration filled or empty, and so on).

Generated scenarios follow the production style, with staging-level
coverage in Regression mode.

## 1. Inputs

The user provides the workflow context manually in the chat, one workflow
at a time. Do not generate anything before it is provided. A workflow
context usually contains:

- What the workflow does and its direction (a HubSpot event triggers
  Saleshandy activities, or a Saleshandy event triggers HubSpot activities).
- The activities, in product UI order, with each one's Extra Configuration.
- Prerequisites and setup, how to execute, and where to verify.
- Intended-behavior notes, and sometimes the related Jira tickets.

The user may also paste existing test notes or ticket details. Those notes
can be written quickly, with grammar and spelling slips.

Work on one workflow per request. If the context is missing something the
scenarios need (see section 3), ask for it.

## 2. Product basics

- Triggers & Activities page: Settings > Integrations > HubSpot > Triggers & Activities.
  Enable a trigger, select an activity, fill its Extra Configuration modal,
  then Save.
- Logs: Settings > Integrations > HubSpot > Logs. Each workflow run creates
  a log entry with a Success or Error status.
- Field mapping between Saleshandy and HubSpot must be configured, otherwise
  data may not be created on either side.
- HubSpot-side triggers: Contact Created/Properties Updated, Contact Updated,
  Deal Created/Properties Updated, Company Created/Properties Updated. Their
  activities act on Saleshandy prospects (Add Prospect, Move Prospect to
  Another sequence, Mark Prospect as Unsubscribed/Finished/Replied/Paused/
  Resume, Assign a tag, Blacklist a domain).
- Saleshandy-side triggers: Email Sent, Reply is received, Prospect Outcome
  is updated, Link Clicked. Their activities act on HubSpot records (Create/
  Update a Contact, Create/Update a Deal, Create/Update a Company, Create a
  Task, Create a Note, Record (log) an email activity).

These are background only. The context the user provides wins over this
list.

## 3. Rules

- **Never invent behavior.** Every Expected must come from the provided
  context, a ticket the user shares, or the user's answer. If an Expected is
  not documented, do not guess: ask.
- **Ask all open questions in one round,** before generating (use the
  AskUserQuestion tool if available). Cover missing Expected results,
  unclear setup, and conflicting statements together, and offer what the
  context suggests as the default answer.
- **Rewrite notes into clear English, keep the meaning.** Fix grammar and
  spelling, shorten long sentences, but never change what happened or what
  was expected. If a note is ambiguous, ask instead of picking a meaning.
- **Short wins.** One short phrase per cell. No restating ticket text.
- **Ticket in its own column:** the fixed ticket that covers the check, for
  example AL-4108, or "None". Mark a check derived from a ticket summary
  alone with "(from summary)".
- **Exclude open or undeployed tickets** and say so in the intro: "Do not
  treat these as failures."
- **Keep a caveat only when it prevents a false failure,** for example
  AL-4113 (empty description on the logged email is expected on the Prospect
  Outcome trigger, since no email is sent).
- **No em-dashes.** Use commas, periods, or parentheses. Use " > " for UI
  paths, with full paths as in section 2.
- **Confirmation gate.** Show the full draft and get an explicit "looks
  good" before saving or posting it anywhere.

## 4. Process

1. Read the context the user provided.
2. Confirm the mode (section 5) if the user did not say it.
3. List the activities in product UI order.
4. Go through the coverage checklist (section 7) and find every gap. Ask
   them all in one round.
5. Generate the scenarios in the shape in section 6.
6. Show the full draft and wait for an explicit "looks good".

## 5. Modes

| | Smoke (production) | Regression (staging) |
|---|---|---|
| Goal | Confirm the fixes hold after deploy | Cover every relevant variation of each activity |
| Rows per activity | 1 to 3 | As many as the coverage checklist needs |
| Built from | Fixed tickets for the workflow | Coverage checklist, existing notes, fixed tickets |
| Ends with | Post-deploy monitoring | Open questions (only if the user leaves any open) |

## 6. Output shape

```
# <Trigger name>: <Smoke | Regression> scenarios

<Intro, up to 3 short paragraphs: environment, the workflow ticket and the
fixes it confirms, which activities it covers. Then: "Not covered, still
open: AL-XXXX (<short summary>). Do not treat these as failures.">

## Test data setup

- <Existing HubSpot or Saleshandy records to reuse, e.g. a contact with 3 or
  more deals.>
- <When a brand-new prospect or contact is needed.>
- <Trigger to enable, field mapping, Extra Configuration values to use.>

## Trigger behavior (baseline)

(Only when the trigger itself had fixes, e.g. deal property updates firing
the workflow, or Select Outcome blocking non-matching outcomes.)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|

## <Activity name, exactly as in the product>

Extra Configuration: <values used, or "None">.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | <precondition / variation> | <one action> | <one observable result> | <AL-XXXX or None> |

(Repeat for each activity, in product UI order.)

## Post-deploy monitoring   (Smoke only)

- Watch Settings > Integrations > HubSpot > Logs for a short window after
  the smoke test, and confirm no new errors appear for this trigger.
```

Column meaning:

- **Scenario:** the precondition or variation that makes this row different
  (e.g. "Contact not in HubSpot", "Contact has 3+ deals").
- **Do:** the single action that fires the workflow (e.g. "Change outcome
  to Meeting Booked", "Update a deal property").
- **Expected:** what to confirm. Include the workflow status in Logs only
  when it matters (e.g. "Success, nothing created").
- **Ticket:** the fixed ticket covering the row.

**Recording results:** do not add a Result column or blank placeholders.
When the user reports a result, append it to the end of the Expected cell:
" - Pass", or " - Fail, AL-XXXX" with the bug key.

## 7. Coverage checklist (Regression mode)

Go through every dimension for each activity. Add a row only when the
dimension applies to the activity and changes the expected result.

**HubSpot event triggers a Saleshandy activity** (Contact, Deal, Company
triggers):

- Path: Created vs Properties Updated (both, when the trigger has both).
- Prospect already in Saleshandy vs not in Saleshandy.
- Single vs multiple associated contacts (Deal, Company triggers).
- Prospect in the Extra Configuration sequence vs in another sequence vs
  not in any sequence.
- Prospect Latest Status before the run (Active, Paused, Replied, Finished,
  Unsubscribed), for the Mark Prospect activities.
- Extra Configuration filled vs left empty, and changed after the first save.
- Reopening the Extra Configuration modal shows the saved values.
- Field mapping, including custom fields and their types.
- Number of log entries per run (HubSpot fires one event per changed
  property, so several entries can be expected, AL-4039).

**Saleshandy event triggers a HubSpot activity** (Email Sent, Reply
Received, Prospect Outcome, Link Clicked triggers):

- Contact in HubSpot vs not in HubSpot.
- Contact with 0, 1, or multiple deals.
- Contact with 0, 1, or multiple companies.
- Extra Configuration filled vs skipped, and invalid values blocked.
- Prospect Outcome: new outcome matches Select Outcome vs does not match.
- Same prospect in a second sequence.
- Create a Note and Record (log) an email activity: always paired with
  Create/Update a Contact or Create/Update a Deal; one row per pairing.
- Deal values: Deal Value to Amount, Closing Date in Days (0, 1, larger).
- Custom field types (e.g. Hiring Date Picker).
- Multi-step sequences and A/B variants, where the activity records the step
  or variant.

**Always:** where to verify (Logs entry and status, the Saleshandy prospect
or sequence, the HubSpot record), as given in the workflow context.

## 8. Worked examples

Both examples come from real testing of the Prospect Outcome is updated in
Saleshandy workflow, rewritten into this shape.

### Smoke example

```
## Update a Deal in HubSpot

Extra Configuration: Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 3 or more deals | Change outcome to Meeting Booked | Success, the latest created deal is updated, not an older one - Pass | AL-4062, AL-4108 |
```

### Regression example

```
## Create a Deal in HubSpot

Extra Configuration: Pipeline = Sales Pipeline, Pipeline Stage = Follow-up,
Deal Type = New Business, Deal Priority = Medium, Closing Date = 0 Days,
Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal | Change outcome to Meeting Booked | Success, deal created and associated to the contact | AL-4061 |
| 2 | Extra Configuration saved with empty fields | Change outcome to Meeting Booked | Success, nothing created in HubSpot | None |
| 3 | Contact not in HubSpot | Change outcome to Meeting Booked | Contact (with mapped properties) and deal created and associated | AL-4107 |
| 4 | Contact already has deals | Change outcome to Meeting Booked | New deal created, existing deals unchanged | None |
| 5 | Prospect has Deal Value, Closing Date = 0 Days | Change outcome to Meeting Booked | Deal Amount = Deal Value, close date empty | None |
| 6 | Prospect has Deal Value, Closing Date = 1 Day | Change outcome to Meeting Booked | Deal Amount = Deal Value, close date is the next day | None |
| 7 | New outcome is not Meeting Booked | Change outcome to Interested | Success, nothing created or updated | AL-4105 |
```
