# Email is Bounced in Saleshandy (Salesforce)

Readiness for scenario generation: Not ready. Written 2026-10-22 from project
files only: the HubSpot version (`context/hubspot/email-bounced.md`,
`email-bounced-progress.md`, `test-cases/hubspot/email-bounced.md`), the
Salesforce Email Sent context, `00-overview.md` and the KB. Nothing here has
been seen on Saleshandy staging for this trigger: the account is not created
yet. Tags: `[HubSpot]` carried over from the HubSpot workflow, not confirmed for
Salesforce; `[KB]` Salesforce KB pages; `[docs]` public Saleshandy docs;
`[Salesforce docs]`; `[staging]` seen on staging, with the file that records it;
`[QA]` QA decision; "proposed" means unconfirmed until QA says so.

Jira sub-task: AL-4138 (parent AL-4131), see `00-overview.md`. Planned prod
release 19 Oct 2026 (sheet, can be stale).

Direction: Saleshandy to Salesforce (the trigger is a Saleshandy event; the
activities create or update Salesforce records).

Naming: the trigger row reads "Email is Bounced in Saleshandy" on Settings >
Integrations > Salesforce > Triggers & Activity [staging, `00-overview.md`].

## What it does

When an email sent by a Saleshandy sequence bounces for a prospect, the trigger
runs the Salesforce activities saved for it [docs, HubSpot]. Not documented
yet: what is passed to Salesforce for a bounce, and whether any bounce field is
updated. Salesforce has Lead fields "Email Bounced Reason" and "Email Bounced
Date" [KB: `salesforce-field-mapping.md`]; whether the workflow fills them is
not documented. Neither is in the mapping on the test accounts
(`00-overview.md`).

## Activities

10 activities, every name ending in " in Salesforce", Create and Update
separate [staging, `00-overview.md`, `email-sent.md`]. The trigger toggle must
be on before the dropdown opens [HubSpot]. That this trigger offers the same
10 is not seen yet (proposed; the other Saleshandy-side triggers do).

| # | Activity | Extra Configuration | Notes |
|---|---|---|---|
| 1 | Create a Account in Salesforce | Not seen on staging yet | Account needs Account Name [Salesforce docs]. |
| 2 | Update a Account in Salesforce | Not seen on staging yet | |
| 3 | Create a Contact in Salesforce | Not seen on staging yet. No dialog on Reply Received [staging, `reply-received.md`] | Contact needs Last Name [KB]. |
| 4 | Update a Contact in Salesforce | Not seen on staging yet. No dialog on Reply Received [staging] | |
| 5 | Create a Lead in Salesforce | Not seen on staging yet. No dialog on Reply Received and Email Sent [staging] | Lead needs Last Name, Company, Lead Status (default "Open - Not Contacted") [staging, `email-sent.md`]. |
| 6 | Update a Lead in Salesforce | Not seen on staging yet. No dialog on Reply Received [staging] | |
| 7 | Create a Opportunity in Salesforce | Closing date (in Days), Opportunity Stage [staging, Email Sent and Prospect Outcome Updated files] | Name, Close Date, Stage required; Account Name not required in this org [staging]. |
| 8 | Update a Opportunity in Salesforce | Closing date (in Days), Opportunity Stage [staging, `prospect-outcome-updated.md`, 2026-10-20] | `email-sent.md` still says "Not explored yet" for this row: stale. |
| 9 | Attach Note in Salesforce | None [staging, 2026-10-17] | Pairs with Create/Update Contact, Lead, Account or Opportunity [QA, 2026-10-21]. See Conflicts. |
| 10 | Record(log) an Email Activity in Salesforce | Lead / Opportunity / Contact checkboxes, standalone, not paired [staging, 2026-10-17] | What the log holds for a bounce is not documented. |

Several activities can be selected on one trigger [staging, `reply-received.md`].

## Expected results (proposed)

Mirror Salesforce Email Sent for the same activity. QA confirmed this rule for
HubSpot Email Bounced on 2026-10-12 [HubSpot]. For Salesforce it is proposed
until QA confirms. The Email Sent expectations are in
`test-cases/salesforce/email-sent.md` (own that file; not copied here).

Facts already seen on staging for Email Sent, reused as the proposed baseline:
- Create a Opportunity: named with the prospect's email; Stage from Extra
  Configuration, Prospecting when empty; Close Date today + Closing date days
  (today + 1 when empty); Amount from Deal Value; owner is the connected
  Salesforce user [staging, `00-overview.md`, 2026-10-21].
- Update a Lead matched the existing Lead by email and replaced the mapped
  values; no second Lead [staging, Reply Received pilot, 2026-10-20].
- Create a Contact created one Contact, no Lead [staging, same pilot].
- Create a Contact + Attach Note added one Note on the Contact [staging, same
  pilot]. What the Note holds on a bounce: Not documented yet.

## How to trigger a bounce [HubSpot]

- Manual: Sequence > Emails tab > the prospect's row > Actions > "Mark as
  bounced". Toast "Email has been marked as bounced"; the row reads "Hard
  Bounced"; the prospect's status becomes Bounced [HubSpot staging, 2026-10-12].
  Needs a row in the Emails tab. Works from an Active sequence and from a
  sequence that was Active and then paused, with emails delivered or scheduled.
  Send now is not needed.
- Step 2: a prospect that is in step 2 can be marked as bounced without sending
  the step 2 email.
- Real: send to an address that bounces; Saleshandy sets the status to Bounced
  [docs]. Plain `name@mailinator.com` does NOT bounce. QA proposed
  `name@<company>.mailinator.com`; it bounced by itself within about 1 minute on
  HubSpot staging, and Logs showed two trigger entries (one Error; QA bug call
  pending in HubSpot) [HubSpot progress file].
- Real bounces count against the real sender accounts. Limit them to a few
  rows; every other row is manual. HubSpot's cap was 3 for the whole plan [QA,
  2026-10-14]. Salesforce cap: proposed, see Open questions.
- A prospect can be marked as bounced once, so each row needs its own prospect.
- Bounced prospects cannot be paused, and adding a bounced prospect to another
  sequence fails [docs, `product/saleshandy.md`]. A prospect bounced on step 1
  cannot move to step 2 [QA, 2026-10-13, HubSpot].
- Triggers: every other trigger off, only "Email is Bounced in Saleshandy" on.

## Save buttons [HubSpot, QA 2026-10-12]

- An activity with an Extra Configuration modal: the modal's Save saves the
  Extra Configuration and the whole workflow.
- An activity with no modal: the page's Save; wait for "Configuration Updated
  Successfully".
- Create a Task has no Salesforce equivalent; the HubSpot Create a Task modal
  rule does not carry over.
- Once values are saved in an Extra Configuration they cannot be emptied again
  (`00-overview.md`), so run rows with Extra Configuration empty first.

## Test data rules

- Closing Date on the prospect: HubSpot never sets it because of a date
  conversion bug, so the CSV Closing Date column stays empty and rows use the
  Extra Configuration Days only [HubSpot, QA 2026-10-12]. Whether the Salesforce
  Opportunity has the same bug is not known; Salesforce Close Date showed
  today + Days on Email Sent [staging]. Proposed: keep the HubSpot rule.
- Deal Value may be set; it becomes Opportunity Amount [staging, Email Sent].
- Closing date 0 Days: Save is accepted, Logs shows Error, no Opportunity is
  created. QA 2026-10-21: a bug, probably UI. Filed as AL-4168 (Email Sent,
  Create a Opportunity) [staging, `email-sent-progress.md`]. Not yet seen on
  this trigger. Proposed: same result.
- Start with one prospect, then add the rest (HubSpot practice).
- Realistic data, unique names per prospect; the Salesforce org is shared
  (`saleshandy-dev-ed`), never edit records a test did not create [KB, plan
  rule 8].
- Salesforce side setup (a Lead, Contact or Opportunity that already exists) is
  made by hand in the Salesforce UI with the prospect's own email, because
  Saleshandy accepts an email once per account [staging, `email-sent-progress.md`].

## Field mapping expectation

Saleshandy to Salesforce pairs set on the workflow accounts; everything else is
"Select" (unmapped). Source: `00-overview.md` "Field mapping values". The
account must carry this mapping before any scenario asserts it.

| Tab | Pairs (Saleshandy to Salesforce) |
|---|---|
| Lead | First Name, Last Name, Email, Company to the same names. Phone Number to Phone. Job Title to Title. Industry to Industry. Website to Website. City to City. State to State/Province. Country to Country. Company Revenue to Annual Revenue. Company HQ Location to Zip/Postal Code. |
| Contact | First Name, Last Name, Email to the same names. Phone Number to Business Phone. Department to Department. City to Other City. State to Other State/Province. Country to Other Country. Company HQ Location to Other Zip/Postal Code. Profile Picture to Photo URL. Job Title, Industry, Website, Company not mapped. |
| Opportunity | Prospect Overview to Description. Deal Value to Amount. Closing Date to Close Date. |
| Account | Website to Website. City to Billing City. State to Billing State/Province. Country to Billing Country. Company to Account Name. Company Website to Website. Company Industry to Industry. Company Size to Employees. Company Revenue to Annual Revenue. Company Founded Year to Year Started. Company Phone to Account Phone. Company HQ Location to Billing Zip/Postal Code. |

Account tab: Website and Company Website both map to Website. Which wins is not
documented.

## Verification targets (proposed)

A Logs Success row does not prove the record exists; always check Salesforce
[KB, common-bugs #49]. Logs: refresh 15 s after the bounce, then every 10 s
until the final status, max 3 min [`how-to-test.md`]. HubSpot's team waited 90 s
for the record (8 min for Update a Deal); Salesforce timing: Not documented
yet. CRM-first rule: wait 15 s, look in Salesforce, open Logs only if the record
is missing.

| Activity | Logs row | Salesforce check |
|---|---|---|
| Create a Account | Success | Account tab: one Account, Account Name = Company; mapped Account fields per the table. |
| Update a Account | Success | Existing Account shows the changed mapped values. |
| Create a Contact | Success | Contacts: one Contact; mapped Contact fields; no Lead created. |
| Update a Contact | Success | Existing Contact shows the changed mapped values. |
| Create a Lead | Success | Leads: one Lead with mapped fields; Lead Status "Open - Not Contacted" unless set. |
| Update a Lead | Success | Existing Lead matched by email shows the changed mapped values; no second Lead. |
| Create a Opportunity | Success | Opportunities: named with the prospect's email; Stage, Close Date, Amount, owner as above; listed under the Contact's Opportunities. |
| Update a Opportunity | Success | Existing Opportunity changed per Extra Configuration. Email Sent showed a new Opportunity when the existing one was made by the product, and an update of only the last one when three existed [staging, `email-sent-progress.md`]; QA decision pending. |
| Attach Note | Success | One Note on the paired entity; Title and Body content on a bounce: Not documented yet. |
| Record(log) an Email Activity | Success | Email log on the ticked object(s) (Lead, Opportunity, Contact). Whether this is the integration's log or Salesforce's own capture is unconfirmed (`00-overview.md`). |

"Nothing created" cases (proposed, same as Email Sent and HubSpot):
- Update a Account / Contact / Lead / Opportunity with no matching Salesforce
  record: Logs row allowed (HubSpot showed Success), nothing created.
- Attach Note selected alone: saves without error [staging, Email Sent
  2026-10-19]; proposed: no Note and no record created.
- Record(log) an Email Activity selected alone: saves; proposed: nothing logged.
- Another trigger on (Email Sent), none for Bounced, then Mark as bounced: no
  record created [HubSpot].
- Create a Opportunity with Closing date 0 Days: Error, no Opportunity (known
  bug area, AL-4168).
- Trigger off or no activity saved: nothing created.

## Account and setup

- Planned account: `sfemailbounced`. Not created yet. QA creates the Saleshandy
  staging account, connects Salesforce, turns OTP off, and saves both logins
  (Saleshandy and Salesforce) by hand with the login scripts. Then it goes in
  `src/config/accounts.ts` and `.mcp.json`.
- Needed on the account: sender email account (check time between emails and
  daily limit first; if 300 to 1200 s, ask QA to fix, plan rule), the Field
  Mapping above, a new Active sequence with 2 steps and no A/B variants so the
  prospect gets an Emails tab row, and all other triggers off.
- Salesforce org: `saleshandy-dev-ed`, shared, SMS code at login so a saved
  session is needed [staging].
- Real sends are capped by `SEND_CAP` (default 40 a day of the 150 the mailbox
  allows) [`cap-real-email-sends` memory]; manual bounce rows send nothing.

## Conflicts between sources

- Attach Note pairing: `00-overview.md` (2026-10-17) and
  `prospect-outcome-updated.md` say Contact only; QA 2026-10-21 says Contact,
  Lead, Account or Opportunity. QA's later statement is used here.
- Update a Opportunity Extra Configuration: seen on `sfoutcomeupdated`
  (Closing date, Stage) but `email-sent.md` says "Not explored yet". This file
  uses the seen value.
- Docs say "Create or update" and "Contact or Deal"; staging shows separate
  Create and Update and no Deal. Staging wins.

## Open questions (each with a suggested default)

1. Does Mark as bounced fire the Salesforce trigger the same way as on HubSpot?
   Default: yes, verify in the first walkthrough on `sfemailbounced`.
2. Do expected results mirror Salesforce Email Sent for each activity? Default:
   yes (proposed).
3. Does this trigger offer the same 10 activities? Default: yes, check when the
   account exists.
4. Extra Configuration of Create/Update Account, Contact, Lead on this trigger.
   Default: none, read-only look on staging first.
5. Closing date 0 Days on Create a Opportunity: expect Error and no Opportunity
   (AL-4168)? Default: yes, run once and log, QA decides.
6. Update a Opportunity: product-made Opportunity gives a second Opportunity,
   three hand-made gives one update. Which is right? Default: ask QA, run once.
7. Does a bounce fill Lead fields Email Bounced Reason or Email Bounced Date?
   Default: no, not mapped, assert nothing.
8. What do the Note and the logged email contain for a bounce? Default: only
   check one Note or one log exists on the right record.
9. Sync time to Salesforce. Default: Logs by the 15 s then 10 s rule, record
   check within 90 s.
10. Real-bounce address and cap for Salesforce. Default: `name@<company>.mailinator.com`,
    max 3 rows, all others manual.
11. Real bounce fired two Logs entries, one Error, on HubSpot. Expected on
    Salesforce too? Default: log it, do not fail the row on it, QA decides.
12. Keep the "no Closing Date on the prospect" rule for Salesforce? Default:
    yes, until QA says the Salesforce Opportunity has no date bug.
13. Update with no matching record: Success row, or Error? Default: nothing
    created is the check; the Logs result is only recorded.
14. Create a Contact when a Lead with the same email exists, and Create a Lead
    when a Contact exists. Default: no second record of the other kind, observe
    once and ask QA.
15. Record(log) an Email Activity alone: tooltip text and result. Default: look
    at the tooltip on staging, page Save, expect nothing logged.
16. Is a Create/Update Opportunity with Attach Note a valid scenario row (Note
    on Opportunity)? Default: yes, per QA 2026-10-21, mark unseen until run.
17. Account name for the account and the Saleshandy login email. Default:
    `sfemailbounced`, address pattern `dharmesh+salesforce+emailbounced@saleshandy.com`
    (guess, QA to confirm).
18. Existing Salesforce records for Update rows: made by hand with the
    prospect's own email. Default: yes, same as Email Sent.

## QA answers, 2026-10-22

- QA creates the Saleshandy account for this trigger (login email and tracking domain are QA's to set). No script until it exists.
- The trigger shows the same 10 activities, with the same Extra Configuration as Email Sent, checked on staging per activity.
- Expected results are copied from Email Sent, Prospect Outcome Updated and Reply Received, marked proposed until QA confirms each on staging.
- Production smoke: only when staging is almost done; QA says when.
- Bounce is tested both ways: Mark as bounced, and a real bounce. For the real bounce QA does not want a real bounce-domain address; one real email address is used for the verification. Which address: asked.
- Account mapping (QA, 2026-10-22): Update a Account looks the Account up by the prospect's First Name + Last Name; this is intended. Company stays unmapped for the Account, so the Account is named like the prospect's full name (as in Email Sent). Same on this trigger.
- Update a Opportunity, second Opportunity: QA could not reproduce it by hand, so it is probably the script, not the product. Fix the script when the first Update a Opportunity row of any of these workflows is built; do not treat it as a bug until then.
- Closing date 0 Days (AL-4168, UI): check that the field turns red and Save is disabled on this trigger too (QA, 2026-10-22).
- Real bounce: any real bounce address works, QA's own email is used, so the number of real bounces is limited (QA, 2026-10-22). Cap: asked.
