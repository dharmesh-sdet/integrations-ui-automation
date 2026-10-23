# Link is Clicked in Saleshandy (Salesforce)

Readiness for scenario generation: Not ready. Built from the HubSpot version
(`context/hubspot/link-clicked.md`, `link-clicked-progress.md`), the Salesforce
Email Sent, Prospect Outcome Updated and Reply Received context files,
`00-overview.md` and the KB. Nothing here has been checked on Saleshandy staging
for this trigger, and the account does not exist yet. Tags: `[HubSpot]` carried
over from the HubSpot workflow, not confirmed for Salesforce; `[KB]` knowledge
base; `[docs]` public Saleshandy docs; `[staging]` seen on staging or the org;
`[QA]` QA decision; `(proposed)` not in any source, to be confirmed.

Jira sub-task: AL-4136 (parent AL-4131), see `00-overview.md`. Planned Prod
release in the sheet: 19 Oct 2026.

Naming: "Link Clicked in Saleshandy" is the name used in testing; "Link is
Clicked in Saleshandy" is the name in Jira. On HubSpot staging the Triggers &
Activity page and Logs both show "Link is Clicked in Saleshandy"
[HubSpot, staging 2026-10-09]. The Salesforce Triggers & Activity list also
says "Link is Clicked in Saleshandy" [staging, 2026-10-16, `00-overview.md`].
The Salesforce Logs name is not seen yet.

Direction: Saleshandy to Salesforce (trigger: a prospect clicks a tracked link
in a sequence email; the selected activities create or update Salesforce
records).

## What it does

- When a prospect in an active sequence clicks a tracked link in a sequence
  email, the trigger runs the selected Salesforce activities [HubSpot, docs].
- Multiple links in one email: a click on a second link fires the trigger again.
  Expected: a new Logs entry, and the clicked count in Sequences > Emails goes
  from 1 to 2 [HubSpot]. Not seen on Salesforce.
- Activity behavior (proposed): every activity behaves as on Salesforce Email
  Sent; only the trigger event differs. HubSpot's QA confirmed this idea for
  its 9 activities. For Salesforce it is carried over, not confirmed. Link to
  the owner: `email-sent.md` (activities, required fields, proposed results).
- What each activity does in Salesforce:
  - Create Lead, Contact, Account or Opportunity: creates the record from the
    mapped prospect fields (mapping below).
  - Update Lead, Contact, Account or Opportunity: changes an existing record
    with the mapped prospect fields. Matching rule is not documented
    (proposed: by email; see Open questions).
  - Attach Note: adds a Note to the record of the paired action.
  - Record(log) an Email Activity: logs an email activity against the
    checked objects (Lead, Opportunity, Contact).
- Create a Lead with an existing Lead, and similar duplicate cases: Not
  documented yet for this trigger.

## Activities

Names as on staging, each ending in " in Salesforce"; Create and Update are
separate activities [staging, 2026-10-16, `00-overview.md`]. Only the Extra
Configuration already recorded in project files is listed. Everything else is
"Not seen on staging yet" for this trigger. On other Salesforce triggers the
Extra Configuration differs (Reply Received has no dialog for Create a Lead,
Outcome Updated has Select Outcome), so each trigger needs its own check.

| # | Activity | Extra Configuration | Notes |
|---|---|---|---|
| 1 | Create a Account in Salesforce | Not seen on staging yet | Requires Account Name [Salesforce docs]. |
| 2 | Update a Account in Salesforce | Not seen on staging yet | |
| 3 | Create a Contact in Salesforce | Not seen on staging yet | Requires Last Name [Salesforce docs]. |
| 4 | Update a Contact in Salesforce | Not seen on staging yet | |
| 5 | Create a Lead in Salesforce | Not seen on staging yet (no dialog on Reply Received [staging]) | Requires Last Name, Company, Lead Status (default "Open - Not Contacted") [staging]. |
| 6 | Update a Lead in Salesforce | Not seen on staging yet (no dialog on Reply Received [staging]) | |
| 7 | Create a Opportunity in Salesforce | Closing date (while creating) in Days, Opportunity Stage [staging, Email Sent and Outcome Updated]. Seen on this trigger: Not seen on staging yet | Needs Name, Close Date, Stage. Seen on Email Sent: named with the prospect's email; Stage empty gives Prospecting; Close Date is today + Closing date days; Amount from Deal Value; owner is the connected user. Closing date 0 Days saves but Logs shows Error and no Opportunity is created (QA 2026-10-21: a bug, no ticket yet) [staging, `00-overview.md`]. |
| 8 | Update a Opportunity in Salesforce | Closing date (while updating) in Days, Opportunity Stage (while updating) [staging, Outcome Updated]. Seen on this trigger: Not seen on staging yet | |
| 9 | Attach Note in Salesforce | None recorded | Pairs with Create or Update Contact, Lead, Account or Opportunity (QA 2026-10-21). The 2026-10-17 note "only Contact" is older. Only Contact seen on staging; Lead, Account, Opportunity not yet. |
| 10 | Record(log) an Email Activity in Salesforce | Lead / Opportunity / Contact checkboxes, standalone, not paired [staging, 2026-10-17] | What the logged email shows for a click is Not documented yet. |

## Prerequisites and setup

- Environment: Saleshandy staging (pyxis.lifeisgoodforlearner.com) with a
  Salesforce Developer Edition org (shared org `saleshandy-dev-ed`, unique
  prefix per run, never edit existing records) [staging, `email-sent.md`].
  Per-workflow org and account per QA 2026-10-19 (`context/project.md`).
- Salesforce connected, Field Mapping set (values below). Without mapping, data
  may not be created [project].
- Custom tracking domain set up on the account [HubSpot]. The HubSpot account
  used cd1.shengage02.com. Public docs: a custom tracking domain is offered
  next to Track Link Clicks.
- Active sequence with Sequence Settings > Safety Settings > Track Link Clicks
  on (confirm dialog "Enable Link Tracking in Emails?" > Enable Anyway)
  [HubSpot, docs]. Step email has a link in the body; use 2 links in a step to
  test a second click. Send emails as text only off [HubSpot].
- Other Saleshandy-side triggers off, only Link is Clicked on: a click also
  counts as an open, so Email Opened and any other enabled trigger would run
  too [KB how-to-test, HubSpot].
- Prospects use Mailinator addresses [HubSpot]. Realistic names, no renamed test
  data (QA rule).
- Sender account: check time between emails before the first send; 300 to 1200
  s means stop and ask QA. Sends are capped per day (SEND_CAP, project memory).
- Test data per activity: a prospect whose Salesforce record exists and one
  whose record does not; for Update Opportunity, a record with an Opportunity.
  Exact preconditions: Not documented yet for Salesforce (HubSpot analogues are
  in `test-cases/hubspot/link-clicked.md`).

## How to execute

1. Settings > Integrations > Salesforce > Triggers & Activity: turn on "Link is
   Clicked in Saleshandy", select the activity, fill Extra Configuration if it
   opens, Save in the modal, then Save on the page. Wait for "Configuration
   Updated Successfully" [HubSpot].
2. Add one prospect to the active sequence (Prospects > Search & Add > Create
   New Prospect > Create & Add to sequence) [HubSpot]. Step 1 is sent by
   Saleshandy; Send now (Emails tab > row three dots) only if needed [HubSpot].
3. Open mailinator.com, enter the prospect's email, open the sequence email and
   click the link. Click right away once the email is open [HubSpot, QA
   2026-10-08].
4. Wait for the click to show in Saleshandy. Check the clicked count in
   Sequences > Emails and the purple clicked icon in the sequence > Prospects
   (current step stats column).
5. Check Settings > Integrations > Salesforce > Logs. Refresh 15 s after the
   action, then every 10 s until a status shows (project rule). Check Logs only
   after the click shows in Saleshandy [HubSpot].
6. Check the result in Salesforce (record fields, Note, Activity timeline).
7. Second click (second link in the same email): wait for the cooling time
   (below), click link 2, check a new Logs entry and the clicked count 1 to 2.

## Click delay and timing

- A click takes time to register in Saleshandy: maximum 1 to 1.5 min, confirmed
  by the developer for HubSpot testing (QA 2026-10-08). Keep waiting until the
  count goes up [HubSpot].
- Cooling times (developer, via QA, 2026-10-12): production 90 s before the
  first click counts and 180 s before the second; staging 10 s for both
  [HubSpot]. A production click made about 1 min after sending did not count
  (HubSpot production smoke, 2026-10-15).
- Conflict: the 1 to 1.5 min figure and the 10 s staging figure come from
  different sources. Treat 1 to 1.5 min as the wait ceiling and 10 s as the
  minimum gap on staging until QA confirms for Salesforce.

## Field mapping expectation

Source: `00-overview.md` "Field mapping values" (set on sfreplyreceived,
applied to sfemailsent). Scenarios assert created data against these pairs.
Every other field on each tab is unmapped ("Select"). Confirm the tabs on the
new account before the first run.

- Lead Properties: First Name > First Name, Last Name > Last Name, Email >
  Email, Company > Company, Phone Number > Phone, Job Title > Title, Industry
  > Industry, Website > Website, City > City, State > State/Province, Country
  > Country, Company Revenue > Annual Revenue, Company HQ Location >
  Zip/Postal Code.
- Contact Properties: First Name > First Name, Last Name > Last Name, Email >
  Email, Phone Number > Business Phone, Department > Department, City > Other
  City, State > Other State/Province, Country > Other Country, Company HQ
  Location > Other Zip/Postal Code, Profile Picture > Photo URL. Job Title,
  Industry, Website, Company are not mapped.
- Opportunity Properties: Prospect Overview > Description, Deal Value >
  Amount, Closing Date > Close Date.
- Account Properties: Website > Website, City > Billing City, State > Billing
  State/Province, Country > Billing Country, Company > Account Name, Company
  Website > Website, Company Industry > Industry, Company Size > Employees,
  Company Revenue > Annual Revenue, Company Founded Year > Year Started,
  Company Phone > Account Phone, Company HQ Location > Billing Zip/Postal Code.
  Website and Company Website both point to Website; which wins is Not
  documented yet.

## Verification targets (proposed, per activity)

All are proposed for this trigger. They copy the Email Sent expectations in
`email-sent.md` and the Salesforce results seen on Reply Received and Email
Sent. Each row also needs: Logs entry for "Link is Clicked in Saleshandy" with
Success (a Success row does not prove the record exists [KB, common-bugs
#49]), so the Salesforce record is always checked.

| Activity | Logs | Salesforce |
|---|---|---|
| Create a Lead | Success | One Lead with the Lead mapping above; Lead Status "Open - Not Contacted" unless set; owner is the connected user (proposed). |
| Update a Lead | Success | Existing Lead (matched by email, proposed) shows the mapped values; no second Lead. |
| Create a Contact | Success | One Contact with the Contact mapping above, no Lead [Reply Received pilot, 2026-10-20]. |
| Update a Contact | Success | Existing Contact shows changed mapped values. |
| Create a Account | Success | One Account with the Account mapping above. |
| Update a Account | Success | Existing Account shows changed mapped values. |
| Create a Opportunity | Success | Opportunity named with the prospect's email, Stage from Extra Configuration, Close Date today + days, Amount from Deal Value, owner is the connected user; visible in the Contact's Related tab [Email Sent, staging 2026-10-21]. |
| Update a Opportunity | Success | Existing Opportunity updated; which Opportunity is updated when several exist is Not documented yet (HubSpot updates the latest, AL-4103). |
| Attach Note (with Create/Update Contact, Lead, Account or Opportunity) | Success | One Note on that record. On Reply Received the Note had Title "reply-received", sequence, step, variant, sender details and links. For a click the title, Link URL and click count content is Not documented yet (HubSpot note had an empty Click Count, AL-4120, fixed). |
| Record(log) an Email Activity | Success | Email activity on each checked object (Lead, Opportunity, Contact). Content Not documented yet. |

Nothing created or changed (proposed, copied from Email Sent and HubSpot):
- Update with no matching record: Logs Success, nothing created [HubSpot].
- Attach Note selected alone: Logs Success, no Note anywhere [HubSpot, QA
  2026-10-13]. On Salesforce, Attach Note alone saves without error [Email
  Sent, 2026-10-19]; the runtime result is not seen.
- Record(log) with no checkbox ticked: Not documented yet.
- Trigger off, or Link is Clicked on with another trigger also on: only the
  selected trigger's activities run (the click's open event must not run other
  workflows).
- Click on a link when Track Link Clicks is off: no click registers (proposed).

## What changes for Salesforce (versus HubSpot)

- 10 activities, not 9. Lead, Contact, Account, Opportunity replace Contact,
  Deal, Company. Task is not offered. Record(log) is standalone with
  checkboxes, not paired.
- Attach Note pairs with any of the four entities (QA 2026-10-21).
- Four mapping tabs (Lead, Contact, Opportunity, Account).
- Required Salesforce fields (Company on Lead, Stage and Close Date on
  Opportunity) can fail a create; HubSpot has no equivalent.
- Dedicated Salesforce org per workflow (QA 2026-10-19); Salesforce login uses
  an SMS code, so the session is saved by hand.
- HubSpot tickets (AL-4103, AL-4104, AL-4120 to AL-4123, AL-4127, AL-4130) do
  not apply until a Salesforce run shows the same issue.

## Account

- Planned account: `sflinkclicked`. Not created yet. Email address not given
  (pattern from other Salesforce accounts: `dharmesh+salesforce+<workflow>@saleshandy.com`,
  proposed).
- QA does by hand: create the Saleshandy account, turn off OTP in Settings,
  connect Salesforce, set up the custom tracking domain, and save both logins
  (`npm run login:saleshandy -- sflinkclicked`, `npm run login:salesforce --
  sflinkclicked`) [project.md, QA 2026-10-19].
- Claude adds the account to `accounts.ts` and the two MCP entries after QA
  gives the details. Until then there is no staging access.

## Open questions

Each has a suggested default.

1. Account email and custom tracking domain for `sflinkclicked`. Default:
   `dharmesh+salesforce+linkclicked@saleshandy.com`; domain set up by QA.
2. Do all 10 activities behave as on Salesforce Email Sent, with the same Extra
   Configuration? Default: yes (HubSpot rule), checked per activity on staging.
3. Does Create a Lead, Update a Lead or Create a Contact open an Extra
   Configuration dialog on this trigger? Default: same as Email Sent and Reply
   Received (none for Lead; Contact and Account to be checked).
4. Wait time for a click on staging: 10 s or up to 1.5 min? Default: poll up to
   3 min, as HubSpot.
5. Production cooling times (90 s, 180 s) apply to Salesforce too? Default:
   yes.
6. How an existing record is matched for Update and Create (by email?), and
   Lead vs Contact when both exist. Default: by email; scenarios marked
   proposed.
7. Update a Opportunity with several Opportunities: which one is updated?
   Default: the latest created, as HubSpot (AL-4103).
8. What the Attach Note body holds for a click (title, Link URL, click count)
   and whether Notes land on Lead, Account, Opportunity. Default: same as Reply
   Received Note plus the clicked URL; check each entity on staging.
9. What Record(log) an Email Activity shows for a click, and which checkbox
   combinations are valid. Default: logs an email against each checked object;
   none checked shows Success and logs nothing.
10. Closing date 0 Days on Create a Opportunity: still a bug on this trigger?
    Default: yes, no new ticket until the existing one is filed.
11. Second click on a different link: counts 1 to 2 (links) or unique links
    only? Default: 1 to 2 as in HubSpot.
12. Salesforce Logs name for this trigger. Default: "Link is Clicked in
    Saleshandy" as on the Triggers page.
13. Salesforce org per workflow: new Developer Edition org or the shared
    `saleshandy-dev-ed`? Default: the org QA connects to `sflinkclicked`.
14. Is the Salesforce version in scope for a production smoke later? Default:
    not now; ask after staging.

## Sources

- `context/hubspot/link-clicked.md`, `link-clicked-progress.md`,
  `test-cases/hubspot/link-clicked.md`.
- `context/salesforce/00-overview.md`, `email-sent.md`,
  `prospect-outcome-updated.md`, `reply-received.md`.
- `knowledge-base/product/salesforce-integration.md`,
  `knowledge-base/product/salesforce-field-mapping.md`,
  `knowledge-base/testing/how-to-test.md`.

## QA answers, 2026-10-22

- QA creates the Saleshandy account for this trigger (login email and tracking domain are QA's to set). No script until it exists.
- The trigger shows the same 10 activities, with the same Extra Configuration as Email Sent, checked on staging per activity.
- Expected results are copied from Email Sent, Prospect Outcome Updated and Reply Received, marked proposed until QA confirms each on staging.
- Production smoke: only when staging is almost done; QA says when.
- Account mapping (QA, 2026-10-22): Update a Account looks the Account up by the prospect's First Name + Last Name; this is intended. Company stays unmapped for the Account, so the Account is named like the prospect's full name (as in Email Sent). Same on this trigger.
- Update a Opportunity, second Opportunity: QA could not reproduce it by hand, so it is probably the script, not the product. Fix the script when the first Update a Opportunity row of any of these workflows is built; do not treat it as a bug until then.
- Closing date 0 Days (AL-4168, UI): check that the field turns red and Save is disabled on this trigger too (QA, 2026-10-22).
