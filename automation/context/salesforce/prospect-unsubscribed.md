# Prospect is Unsubscribed in Saleshandy (Salesforce)

Readiness for scenario generation: Not ready. Built from project files only
(HubSpot version, Salesforce KB, `00-overview.md`, the three Salesforce context
files). Nothing here has been checked on Saleshandy staging for this trigger
with Salesforce, and the account does not exist yet. Tags: `[HubSpot]` carried
over from the HubSpot workflow, not confirmed for Salesforce; `[KB]` Salesforce
KB pages; `[docs]` public Saleshandy docs; `[staging]` seen on staging; `[QA]`
QA decision. "Proposed" means a guess to confirm, not a fact.

Jira sub-task: AL-4137 (parent AL-4131), see `00-overview.md`. Planned prod
release 19 Oct 2026 (sheet; re-read it, it can be stale).

Direction: Saleshandy to Salesforce. The trigger is a Saleshandy event (the
prospect unsubscribes); the activities create or update Salesforce records.

Not the same thing: the activity "Mark as Unsubscribed" (Salesforce to
Saleshandy side, runs when a Salesforce "Created" trigger fires). The KB lists
it among the Salesforce to Saleshandy activities [KB: salesforce-integration.md
section 4, docs]. It is a different workflow. Same warning as in HubSpot, where
the activity is "Mark Prospect as Unsubscribed in Saleshandy"
[HubSpot: context/hubspot/prospect-unsubscribed.md]. No project file says
whether the Salesforce staging dropdown names it exactly that way.

## What it does

When a prospect becomes Unsubscribed in Saleshandy, the trigger "Prospect is
Unsubscribed in Saleshandy" runs the Salesforce activities saved on Settings >
Integrations > Salesforce > Triggers & Activity [docs]. The docs do not say
when it fires or what each activity does for an unsubscribe: Not documented
yet. What HubSpot did: it fires when the prospect is unsubscribed from a
sequence, by the real link or by Mark as Unsubscribe; a prospect in no sequence
that is unsubscribed by hand does not fire it, and that is valid behavior
[HubSpot, QA 2026-10-20; owner: `knowledge-base/testing/how-to-test.md`].

## Activities (10)

Listed for the Saleshandy-side triggers on `sfreplyreceived`, `sfemailsent` and
`sfoutcomeupdated` [staging, 2026-10-16 to 2026-10-20]. Every name ends in " in
Salesforce". Create and Update are separate. The dropdown on this trigger is
not opened yet, so the list is assumed identical (same list on the other three
Saleshandy-side triggers seen). Several activities can be selected on one
trigger [staging, 2026-10-20].

Extra Configuration column: values seen on other triggers are given as a hint
only. Extra Configuration is per trigger (Prospect Outcome Updated adds Select
Outcome), so each cell is "Not seen on staging yet" for this trigger.

| # | Activity | Extra Configuration on this trigger | Seen on Email Sent, for reference [staging] |
|---|---|---|---|
| 1 | Create a Account in Salesforce | Not seen on staging yet | None |
| 2 | Update a Account in Salesforce | Not seen on staging yet | None |
| 3 | Create a Contact in Salesforce | Not seen on staging yet | None (HubSpot's Create a Contact had Lead Status and Lifecycle; Salesforce's has none) |
| 4 | Update a Contact in Salesforce | Not seen on staging yet | None |
| 5 | Create a Lead in Salesforce | Not seen on staging yet | None |
| 6 | Update a Lead in Salesforce | Not seen on staging yet | None |
| 7 | Create a Opportunity in Salesforce | Not seen on staging yet | Closing date (Days, default 0) and Opportunity Stage |
| 8 | Update a Opportunity in Salesforce | Not seen on staging yet | Closing date (Days) and Opportunity Stage |
| 9 | Attach Note in Salesforce | Not seen on staging yet | None |
| 10 | Record(log) an Email Activity in Salesforce | Not seen on staging yet | "Select Object" checkboxes Lead / Opportunity / Contact, standalone |

- Attach Note pairs with Create/Update Contact, Lead, Account or Opportunity,
  created only when selected together with that entity's action [QA,
  2026-10-21]. Older line "Contact only" [staging, 2026-10-17] is superseded.
  Lead, Account, Opportunity pairing: see `email-sent.md` and its test cases
  for what was seen.
- Record(log) an Email Activity is standalone, not paired [staging, 2026-10-17].
  What the logged email holds on an unsubscribe: Not documented yet.
- Saved Extra Configuration cannot be cleared again; run the "Extra
  Configuration skipped" rows first on a new account, without saving values
  [QA, 2026-10-09; owner: `knowledge-base/testing/how-to-test.md`].

## Expected result per activity (proposed, unconfirmed)

Proposed to mirror the same activity on Email Sent from Saleshandy
(`email-sent.md`, `test-cases/salesforce/email-sent.md`, QA signed off 2026-10-22),
as QA confirmed for HubSpot Email Bounced on 2026-10-12 and as proposed for
HubSpot Unsubscribed [HubSpot]. Not confirmed for this trigger. A different
result is reported and asked about, not called a failure.

| # | Activity | Proposed result |
|---|---|---|
| 1 | Create a Account | One Account named after the prospect's Company, mapped fields set (see mapping below). |
| 2 | Update a Account | Existing Account updated. Email Sent finding: the lookup used the prospect's full name, not the Company, so nothing updated in production smoke (open, QA to decide; not filed) [staging, `email-sent-progress.md` 2026-10-22]. Expect the same here. |
| 3 | Create a Contact | One Contact with mapped fields; no Lead. |
| 4 | Update a Contact | Existing Contact (matched by email) updated; no Contact in Salesforce: Logs Success, nothing created. |
| 5 | Create a Lead | One Lead, Last Name and Company set, Lead Status "Open - Not Contacted". |
| 6 | Update a Lead | Existing Lead (matched by email) updated with mapped values, nothing created when none exists. |
| 7 | Create a Opportunity | One Opportunity named with the prospect's email, Stage from Extra Configuration (Prospecting when empty), Close Date today + Days, Amount from Deal Value, owner the connected user. |
| 8 | Update a Opportunity | Latest Opportunity changed; behavior with 0, 1 and 3 Opportunities as seen on Email Sent. |
| 9 | Attach Note | One Note on the paired record. Contents on an unsubscribe: Not documented yet. |
| 10 | Record(log) an Email Activity | Email activity on the ticked Lead / Opportunity / Contact timeline. Contents: Not documented yet. |

## How to trigger an unsubscribe [HubSpot, staging 2026-10-15]

Two ways, agreed with QA on 2026-10-14. Both seen on HubSpot staging. Not yet
tried with Salesforce.

- Real link. Sequence > Settings > Unsubscribe > "Include Unsubscribe Option in
  Emails": choose "Unsubscribe as Link", Save. The delivered email then holds
  "Unsubscribe here". The link is in the delivered email in the Mailinator
  inbox, LINKS tab, not in Preview email (href empty there). It points to
  `unsub.shengage02.com/c/...`. Opening it unsubscribes at once with no
  confirm step; the page says "You will no longer receive emails from us" and
  offers "Subscribe here" and "Report spam".
- Mark as Unsubscribe in the UI. Sequence > Prospects tab > tick the prospect >
  toolbar icon "Mark as Unsubscribe" (tooltip; ban-circle icon). No confirm
  dialog; toast "Prospect(s) status updated successfully". The Emails tab row
  menu has no unsubscribe action.

Result of both:
- Prospects tab shows the prospect as "Unsubscribed". On production wait about
  93 s after delivery before opening the link, then hard refresh the tab [QA,
  2026-10-19].
- Logs: one new row "Prospect is Unsubscribed in Saleshandy" with Success at
  the first refresh 15 s after the action (3.4 s and 2.8 s run time on HubSpot).
  Then refresh every 10 s, give up after 3 minutes [QA, 2026-10-08].
- The Emails tab row stays "Sent".
- The same link opened again fires the trigger again: one new Logs row per open.
  The effect in the CRM of a repeat is not checked.
- "Subscribe here" on the link page returns the prospect to its earlier status
  (Completed). No subscribe event or trigger exists on the trigger list. A
  subscribe produced no clearly separate Logs row.
- Mark as Resume on an unsubscribed prospect shows a success toast and changes
  nothing. Expected, not a bug [QA, 2026-10-15].
- A prospect in no sequence, unsubscribed by hand, does not fire the workflow.
  Valid behavior [QA, 2026-10-20].

Conflict between sources: on HubSpot staging both ways fired the trigger
(2026-10-15); on HubSpot production Mark as Unsubscribe did not, only the real
link did [QA, 2026-10-19; `knowledge-base/testing/how-to-test.md`]. Which holds
for Salesforce on staging is not known.

What changes for Salesforce:
- Mailinator link method and the sequence setting are the same Saleshandy side;
  only the CRM part differs. Not confirmed.
- Activities, their Extra Configuration and the checks are Salesforce's (Lead
  vs Contact, Opportunity instead of Deal, Account instead of Company, no Task
  or Deal pairing for notes).
- Salesforce login needs an SMS code, so QA logs in by hand and the session is
  reused [KB].
- Sender: first check the sender account's time between emails (300 to 1200 s
  means stop and ask QA) and give the sequence an always-on sending schedule
  [QA, 2026-10-09 and 2026-10-18; owner: how-to-test.md].

## Field mapping expectation (Saleshandy field to Salesforce field)

Source: `00-overview.md` "Field mapping values", read from `sfreplyreceived`
and applied to `sfemailsent` on 2026-10-19 [staging]. Everything else on each
tab stays "Select" (unmapped). Not yet read or set on `sfunsubscribed`. A
scenario asserts created or updated data against these pairs only.

Lead Properties:
- First Name to First Name, Last Name to Last Name, Email to Email, Company to
  Company
- Phone Number to Phone, Job Title to Title, Industry to Industry, Website to
  Website
- City to City, State to State/Province, Country to Country
- Company Revenue to Annual Revenue, Company HQ Location to Zip/Postal Code

Contact Properties:
- First Name, Last Name, Email to the same names
- Phone Number to Business Phone, Department to Department
- City to Other City, State to Other State/Province, Country to Other Country
- Company HQ Location to Other Zip/Postal Code, Profile Picture to Photo URL
- Job Title, Industry, Website, Company are not mapped (so Title and Account
  Name stay empty on a created Contact [staging, Reply Received pilot])

Opportunity Properties:
- Prospect Overview to Description, Deal Value to Amount, Closing Date to Close
  Date
- Name and Stage are not mapped: Name is the prospect's email, Stage comes from
  Extra Configuration [staging, 2026-10-21]
- Never set a Closing Date on the prospect; use the Extra Configuration Days
  only [QA, 2026-10-12]

Account Properties:
- Company to Account Name, Website to Website, Company Website to Website
- City to Billing City, State to Billing State/Province, Country to Billing
  Country, Company HQ Location to Billing Zip/Postal Code
- Company Industry to Industry, Company Size to Employees, Company Revenue to
  Annual Revenue, Company Founded Year to Year Started, Company Phone to Account
  Phone
- Both Website fields write the Account's Website; on production the personal
  site showed [staging, `email-sent-progress.md` 2026-10-22].

Required in Salesforce: Lead (Last Name, Company, Lead Status), Contact (Last
Name), Opportunity (Name, Close Date, Stage), Account (Account Name) [KB:
salesforce-field-mapping.md].

## Verification targets

Per activity: Logs row, then the Salesforce record. A Logs entry is the custom
workflow's run; Success does not prove a record was written, so check
Salesforce (all activities) [QA, 2026-10-13; KB: common-bugs #49]. Use the
"All" list views in Salesforce, not Recently Viewed [staging, 2026-10-21].
Check order [QA email-sent plan]: wait 15 s, look in Salesforce; if missing,
wait 5 s, hard refresh, look again; only then open Logs. Error in Logs is
reported to QA, not failed. Data check: unique prospect name and email per
row.

| # | Activity | Logs | Salesforce |
|---|---|---|---|
| 1 | Create a Account | One new "Prospect is Unsubscribed in Saleshandy" row, Success | Account tab: Account Name = Company, mapped Account fields |
| 2 | Update a Account | Row Success | Existing Account, mapped fields changed |
| 3 | Create a Contact | Row Success | Contact: Name, Business Phone, Email, Department, Other Address; Title and Account Name empty; no Lead |
| 4 | Update a Contact | Row Success | Existing Contact, mapped fields changed, one Contact |
| 5 | Create a Lead | Row Success | One Lead, mapped values, Lead Status "Open - Not Contacted" |
| 6 | Update a Lead | Row Success | Existing Lead, mapped values replaced, still one Lead |
| 7 | Create a Opportunity | Row Success | Opportunity named with the email, Stage, Close Date (DD/MM/YYYY, today + Days), Amount; on the Contact's Related tab under Opportunities |
| 8 | Update a Opportunity | Row Success | Stage, Close Date changed on the latest Opportunity; count of Opportunities recorded |
| 9 | Attach Note | Row Success | One Note on the paired record, title and body recorded (Reply Received note had Title "reply-received") |
| 10 | Record(log) an Email Activity | Row Success | Email on the Activity timeline of each ticked object |

"Nothing created" cases (all proposed, unconfirmed):
- Prospect not in Salesforce with an Update activity: Logs Success, nothing
  created [Email Sent proposal 10, Reply Received pilot].
- Another trigger on (for example Email Sent): its own Logs rows and records
  appear, so every other trigger stays off.
- Trigger off: no new row after 45 s (15 s, then 10 s steps) and no change in
  Salesforce.
- Prospect not in any sequence, unsubscribed by hand: no Logs row, nothing
  created [QA, 2026-10-20, HubSpot].
- Attach Note or Record(log) selected alone: saves, and Success in Logs may
  write nothing [staging, 2026-10-19, Email Sent].
- Closing date 0 Days on Opportunity: AL-4168 (fix verified on staging by QA);
  expect Save blocked or no Opportunity, per `email-sent.md`.
- Repeat link open: one new Logs row per open; extra records not checked.

## Account (planned, not created yet)

- Name: `sfunsubscribed`. One Saleshandy staging account per workflow so
  trigger settings do not collide [QA, KB]. Not in `src/config/accounts.ts`,
  no sessions, no sequence.
- QA sets up by hand: the account, the Salesforce connection (shows
  "Re-connect" now and then, check it before a run [staging, 2026-10-22]), OTP
  off, and both logins (Saleshandy, Salesforce).
- Then: Field Mapping (copy from the section above), sender email account,
  always-on sending schedule, a sequence with one step and "Unsubscribe as Link"
  saved, Mailinator-style prospect emails (`name@mailinator.com` never
  bounces).
- Salesforce org: `saleshandy-dev-ed`, shared. Unique prefix per run, never edit
  records a test did not create [KB]. Lead Status and Stage picklists as in
  `email-sent.md`.

## Open questions (suggested default each)

1. Does the staging dropdown on this trigger show the same 10 activities?
   Default: yes, confirm when the account exists.
2. Extra Configuration per activity on this trigger (Opportunity Closing date
   and Stage, Select Object, any others)? Default: as Email Sent, check each.
3. Does the unsubscribed status reach any Salesforce field (for example Email
   Opt Out)? Default: no, not documented; the field mapping lists no such field
   for Saleshandy, and no scenario asserts it. Check one record's Email Opt Out
   after the first run.
4. Does Mark as Unsubscribe in the UI fire the trigger on staging for
   Salesforce, or only the real link (as on HubSpot production)? Default: run
   both in the first baseline rows and record each.
5. Expected result per activity: accept "mirrors Email Sent" for all 10?
   Default: yes, proposed until QA confirms.
6. Update a Account looks the Account up by the prospect's full name; does QA
   call it a bug (open since 2026-10-22)? Default: expect the same here, report
   once, do not fix the data.
7. Update a Opportunity with the product-made Opportunity gave 2 Opportunities
   on Email Sent, closed by QA 2026-10-22. Default: use the same rows.
8. What do the Note and the logged email contain on an unsubscribe? Default:
   record title and body, assert only that one exists on the right record.
9. Attach Note on Lead, Account, Opportunity: pairing expectations. Default:
   copy the Email Sent rows (4 to 6).
10. Prospect already a Contact or converted Lead when Create a Lead runs?
    Default: report what happens, assert no duplicate only if QA confirms.
11. Same link opened twice: any extra record in Salesforce? Default: assert
    only the extra Logs row.
12. "Subscribe here" and Mark as Resume: any Salesforce effect? Default: none,
    check that no new Logs row appears.
13. Realistic scope: all 10 activities with how many rows each? Default: the
    Email Sent shape (2 to 6 rows each), sized after the exploration, with the
    6-minutes-per-row scope check before building [lessons.md 2026-10-18].
14. Run Phase 1 (Extra Configuration skipped) first? Default: yes, on the
    first run only, without saving values.
15. Does the Salesforce connection survive a run on a new account? Default:
    gate checks it three times, 20 s apart, as the Email Sent smoke does.
16. Production smoke for Salesforce after staging? Default: ask QA after the
    staging verdict; the HubSpot one used the real link only.

## QA answers, 2026-10-22

- QA creates the Saleshandy account for this trigger (login email and tracking domain are QA's to set). No script until it exists.
- The trigger shows the same 10 activities, with the same Extra Configuration as Email Sent, checked on staging per activity.
- Expected results are copied from Email Sent, Prospect Outcome Updated and Reply Received, marked proposed until QA confirms each on staging.
- Production smoke: only when staging is almost done; QA says when.
- Does the unsubscribe reach any Salesforce field (for example Email Opt Out)? Not known. QA asks the developer; no scenario asserts it until the answer is in.
- Unsubscribe is tested both ways: Mark as Unsubscribe in the UI, and the real Unsubscribe link in the delivered email. The real link is clicked only after the wait already used on HubSpot (`notes/production-testing/06-unsubscribed.md`).
- Account mapping (QA, 2026-10-22): Update a Account looks the Account up by the prospect's First Name + Last Name; this is intended. Company stays unmapped for the Account, so the Account is named like the prospect's full name (as in Email Sent). Same on this trigger.
- Update a Opportunity, second Opportunity: QA could not reproduce it by hand, so it is probably the script, not the product. Fix the script when the first Update a Opportunity row of any of these workflows is built; do not treat it as a bug until then.
- Closing date 0 Days (AL-4168, UI): check that the field turns red and Save is disabled on this trigger too (QA, 2026-10-22).
