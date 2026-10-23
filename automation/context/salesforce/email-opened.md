# Sequence Email is Opened in Saleshandy (Salesforce)

Readiness for scenario generation: Not ready. Built from the HubSpot version
(`context/hubspot/email-opened.md`, `email-opened-progress.md`,
`test-cases/hubspot/email-opened.md`), `00-overview.md`, the Email Sent,
Reply Received and Prospect Outcome Salesforce context files, and the KB.
Nothing here is checked on Saleshandy staging for this trigger: the account
`sfemailopened` does not exist yet. Tags: `[HubSpot]` carried over from the
HubSpot workflow, not confirmed for Salesforce; `[KB]` Salesforce KB pages;
`[docs]` public Saleshandy docs; `[staging]` seen on staging; `[QA]` QA
decision; "proposed" means unconfirmed.

Jira sub-task: AL-4135 (parent AL-4131), see `00-overview.md`.

Direction: Saleshandy to Salesforce (a prospect opens a sequence email in
Saleshandy; the activities create or update Salesforce records).

## What it does

When a prospect in an active sequence opens an email and Saleshandy counts the
open, the trigger runs the Salesforce activities saved on Settings >
Integrations > Salesforce > Triggers & Activity [HubSpot, QA 2026-10-12].
What is passed to Salesforce for an open: Not documented yet.

## Activities

Names and count seen on `sfreplyreceived` and `sfemailsent` for other
triggers [staging, 2026-10-16 to 2026-10-20]. The list under this trigger is
not seen yet. Every name ends in " in Salesforce". Create and Update are
separate. Several activities can be saved on one trigger [staging, 2026-10-20].

| # | Activity | Extra Configuration | Notes |
|---|---|---|---|
| 1 | Create a Account in Salesforce | Not seen on staging yet | Account Name is required [KB]. |
| 2 | Update a Account in Salesforce | Not seen on staging yet | |
| 3 | Create a Contact in Salesforce | None under Email Sent [staging, 2026-10-19] | HubSpot has Lead Status and Lifecycle; Salesforce does not, so HubSpot's Contact config rows do not carry over. |
| 4 | Update a Contact in Salesforce | None under Email Sent [staging, 2026-10-19] | |
| 5 | Create a Lead in Salesforce | None under Email Sent and Reply Received [staging] | Lead needs Last Name, Company, Lead Status (default "Open - Not Contacted") [KB]. |
| 6 | Update a Lead in Salesforce | None under Reply Received [staging, 2026-10-20] | |
| 7 | Create a Opportunity in Salesforce | Closing date in Days (default 0), Opportunity Stage [staging, 2026-10-19] | Opportunity needs Name, Close Date, Stage [KB]. |
| 8 | Update a Opportunity in Salesforce | Closing date in Days, Opportunity Stage [staging, 2026-10-20, Prospect Outcome] | |
| 9 | Attach Note in Salesforce | None [staging] | Pairs with Create or Update of Contact, Lead, Account or Opportunity [QA, 2026-10-21]. |
| 10 | Record(log) an Email Activity in Salesforce | Select Object checkboxes: Lead, Contact, Opportunity [staging, 2026-10-19] | Standalone, not paired. |

Rules from `00-overview.md` (not copied): Opportunity name is the prospect's
email; Stage empty gives Prospecting; Close Date is today plus the Closing date
days; Closing date 0 Days is a bug (no Jira ticket yet).

## Setup the open depends on [HubSpot]

Owned by `context/hubspot/email-opened.md`; carried over because the open
tracking is Saleshandy-side and does not depend on the CRM. Confirm once on
`sfemailopened`.
- Sequence setting Track email opens on (Safety Settings). Turning it on needs
  a custom tracking domain, then a second prompt "Enable Open Tracking for
  Emails?" > Enable Anyway. It saves by itself.
- Custom tracking domain: Settings > Custom Tracking Domain. HubSpot account
  used `cd1.shengage02.com`; the same domain can serve more than one account.
  Which domain `sfemailopened` uses: not decided.
- Text Only mode turns off open tracking [docs].
- A link click also counts as an open. Turn every other trigger off, only
  "Sequence Email is Opened in Saleshandy" on [how-to-test.md].
- Do not enable Track link clicks.

## Timing [HubSpot, QA 2026-10-12]

- Staging: 10 s for the first and the second open. Registering after a counted
  open: about 10 s. Use 10 s as the staging wait.
- Production: first open counts after 60 s from sending, second 120 s after the
  first; registering 1 to 3 minutes. For the production smoke only.
- An open before the threshold is not counted.
- Not documented yet: whether Salesforce changes any of this.

## How to execute

1. Triggers & Activity: every other trigger off, enable only "Sequence Email is
   Opened in Saleshandy", select the activity, fill Extra Configuration if any,
   click the modal's Save, then the page's Save. Wait for "Configuration
   Updated Successfully".
2. Add the prospect to the active sequence with Add Prospects, one at a time.
   Wait for "Sent" in Sequences > Emails.
3. Open the email: mailinator.com, type the prospect's address, Go, open the
   sequence email [HubSpot, how-to-test.md]. Wait 10 s on staging first.
4. Refresh Sequences > Emails until the Opened count goes up. Only then check
   Logs: Settings > Integrations > Salesforce > Logs, refresh 15 s after the
   open is counted, then every 10 s until a status shows.
5. Check the record in Salesforce.
6. Second open: open the same email again after 10 s. Step 2 needs the prospect
   moved to step 2 first (Prospects tab > Add to Sequence > Sequence Steps >
   Add), then Send now on its row [HubSpot, QA 2026-10-12 and 2026-10-13].

Emails go to `name@mailinator.com`. The sender mailbox allows 150 a day; sends
are capped by `SEND_CAP` (default 40) [project].

## What carries over and what changes

Carried over [HubSpot, confirm on Salesforce]:
- Open tracking setup, tracking domain, timing, Mailinator open, Opened count
  check before Logs, other triggers off.
- Several Logs rows can come from one open; check that all new rows are
  Success [how-to-test.md].
- Fires on every step of a multi-step sequence, each step's first open
  [HubSpot, proposed here].

Changes for Salesforce:
- 10 activities named " in Salesforce"; Lead is a separate object from Contact.
- Contact and Lead activities have no Extra Configuration; Opportunity has
  Closing date and Stage.
- Attach Note pairs with 4 entities, not only Contact.
- Verify in the Salesforce UI (Leads, Contacts, Accounts, Opportunities tabs,
  the record's Related and Activity sections), not in HubSpot.
- Salesforce login needs an SMS code, so QA saves the session by hand [staging].

## Field mapping expectation

Applies to a Create or Update, so scenarios can assert created data. Values
from `00-overview.md` "Field mapping values" (Saleshandy field to Salesforce
field). Everything else stays "Select" (unmapped). `sfemailopened` has no
mapping yet; QA copies it from `sfemailsent`.

- Lead: First Name, Last Name, Email, Company to the same names; Phone Number
  to Phone; Job Title to Title; Industry to Industry; Website to Website; City
  to City; State to State/Province; Country to Country; Company Revenue to
  Annual Revenue; Company HQ Location to Zip/Postal Code.
- Contact: First Name, Last Name, Email to the same names; Phone Number to
  Business Phone; Department to Department; City to Other City; State to Other
  State/Province; Country to Other Country; Company HQ Location to Other
  Zip/Postal Code; Profile Picture to Photo URL. Job Title, Industry, Website
  and Company are not mapped.
- Opportunity: Prospect Overview to Description; Deal Value to Amount; Closing
  Date to Close Date.
- Account: Website to Website; City to Billing City; State to Billing
  State/Province; Country to Billing Country; Company to Account Name; Company
  Website to Website; Company Industry to Industry; Company Size to Employees;
  Company Revenue to Annual Revenue; Company Founded Year to Year Started;
  Company Phone to Account Phone; Company HQ Location to Billing Zip/Postal
  Code.

## Verification targets per activity

For every row: Logs shows the trigger name with status Success, then the
Salesforce record is checked (a Success row alone is not a pass [KB, how-to-test.md]).

| Activity | Logs | Salesforce |
|---|---|---|
| Create a Lead | Success | One Lead for the prospect's email; fields per Lead mapping; Status "Open - Not Contacted" unless set; owner the connected user (proposed). |
| Update a Lead | Success | Existing Lead matched by email; mapped fields replaced [staging, Reply Received 2026-10-20]. |
| Create a Contact | Success | One Contact; fields per Contact mapping; no Lead created [staging, Reply Received 2026-10-20]. |
| Update a Contact | Success | Existing Contact matched by email; mapped fields changed (proposed). |
| Create a Account | Success | One Account named from Company; fields per Account mapping (proposed). |
| Update a Account | Success | Existing Account changed (proposed). How the Account is matched: Not documented yet. |
| Create a Opportunity | Success | One Opportunity named with the prospect's email; Stage from Extra Configuration; Close Date today plus Days; Amount from Deal Value; shows under the Contact's Related > Opportunities [staging, Email Sent 2026-10-21]. |
| Update a Opportunity | Success | Existing Opportunity changed: Stage and Close Date per Extra Configuration (proposed). |
| Attach Note | Success | One Note on the paired entity. Note content for an open: Not documented yet. On Reply Received the Note held sequence, step, sender and email details [staging, 2026-10-20]. |
| Record(log) an Email Activity | Success | An email log on each ticked object. Content: Not documented yet. Unconfirmed whether the log comes from this activity [00-overview.md]. |

Nothing-created cases (all proposed, unconfirmed; record the Logs status):
- Update a Lead, Contact, Account or Opportunity with no matching record:
  nothing created. HubSpot shows Success and does nothing.
- Attach Note alone: saves without error [staging, Email Sent 2026-10-19];
  runtime result unknown, proposed no Note.
- Record(log) with no object ticked: saves with a toast [staging]; proposed no
  log.
- Create a Opportunity with Closing date 0 Days: Logs Error and no Opportunity
  [staging, 2026-10-21]; a bug per QA.
- Open before the threshold, or a repeat open inside the cooling period: not
  counted, no new Logs row (proposed).
- Trigger off: an open creates nothing.

## Account

Planned account `sfemailopened`, not created yet. QA sets up the Saleshandy
account, the Salesforce connection, OTP off and both logins by hand (Saleshandy
and Salesforce). Then Claude adds it to `accounts.ts` and `.mcp.json`
(entries load after a restart). Needs: a sender email account with its
interval checked (300 to 1200 s means stop and fix), an active 2-step
sequence with Track email opens on, a custom tracking domain, the field
mapping above, all triggers off at start.

## Open questions

Each has a suggested default; the default is used if QA does not answer.

1. Does Salesforce open tracking behave like HubSpot (10 s staging wait, 60 s and
   120 s production)? Default: yes, confirm on the first walkthrough.
2. Which custom tracking domain for `sfemailopened`? Default: `cd1.shengage02.com`.
3. Does the activity list under this trigger have the same 10 activities?
   Default: yes.
4. Extra Configuration of Create and Update Account, and of Update Contact and
   Update Lead under this trigger. Default: none, read it on staging.
5. How an existing record is matched: by email for Lead and Contact, and for
   Account (by Company or website)? Default: email for Lead and Contact; Account
   Not documented yet, ask the developer.
6. Update with no matching record: Success and nothing created, or Error?
   Default: Success, nothing created.
7. Create when the record already exists (Lead for a Contact, duplicate
   email): update, skip or duplicate? Default: no duplicate, record what happens.
8. What the Note holds for an open, and what Record(log) logs. Default: record
   what staging shows, mark proposed.
9. Does Attach Note pair with Lead, Account and Opportunity here (QA 2026-10-21
   says yes)? Default: yes, one row each.
10. Does a second open of the same email create a second record or a second
    Logs row? Default: second Logs row, no second record.
11. Do open events on step 2 and later steps fire? Default: yes.
12. Does an open from a bot or mail-scanner count as an open, and is it a
    concern here? Default: out of scope.
13. Is a Jira ticket for Salesforce-side open bugs expected (HubSpot's AL-4105
    to AL-4128 may not apply)? Default: none known.
14. Record(log) without any object ticked: expected result. Default: no log,
    Logs Success.
15. Which Salesforce Account does a Contact or Opportunity get attached to, if
    any? Default: none (Account Name is not required in this org [staging]).

## Conflicts between sources

- Attach Note pairing: `00-overview.md` (2026-10-17) says only Contact works;
  QA 2026-10-21 says Contact, Lead, Account and Opportunity. `email-sent.md`
  still says "Contact or Deal". This file follows QA 2026-10-21.
- Email Sent's Extra Configuration for Contact and Lead is "none" on staging;
  the HubSpot Opened file lists Lead Status and Lifecycle. This file follows
  staging.
- Timing: public docs say two opens inside 180 s count as one; the developer
  figures (via QA) are used [HubSpot].

## QA answers, 2026-10-22

- QA creates the Saleshandy account for this trigger (login email and tracking domain are QA's to set). No script until it exists.
- The trigger shows the same 10 activities, with the same Extra Configuration as Email Sent, checked on staging per activity.
- Expected results are copied from Email Sent, Prospect Outcome Updated and Reply Received, marked proposed until QA confirms each on staging.
- Production smoke: only when staging is almost done; QA says when.
- Account mapping (QA, 2026-10-22): Update a Account looks the Account up by the prospect's First Name + Last Name; this is intended. Company stays unmapped for the Account, so the Account is named like the prospect's full name (as in Email Sent). Same on this trigger.
- Update a Opportunity, second Opportunity: QA could not reproduce it by hand, so it is probably the script, not the product. Fix the script when the first Update a Opportunity row of any of these workflows is built; do not treat it as a bug until then.
- Closing date 0 Days (AL-4168, UI): check that the field turns red and Save is disabled on this trigger too (QA, 2026-10-22).
