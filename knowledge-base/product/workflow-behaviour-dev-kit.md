# Integration workflows: what the developer API tests found

Read this before testing a workflow. It says how each workflow is fired, what a
correct result looks like, what is accepted behaviour (not a bug), and which
bugs are already known, so a test starts from what is known instead of
finding it again.

All facts are `[dev kit]` unless tagged otherwise: found by the developer's
API-only test runs on staging (no UI). The full log of each workflow is in
`../../integration-skills/test-logs/<crm>/<workflow>.md`; brackets give
`file:line` in that log. Check a fact on staging before a UI test depends on
it. Written 2026-10-27.

## 1. How it works underneath

- Saleshandy-side event (send, open, click, reply, bounce, unsubscribe,
  outcome, call): edge publishes it only if the account has a
  `user_event_subscription` row for that event. Turning a trigger on and
  Saving on Triggers & Activity writes the row (`POST
  /integration/event-subscribe`). Disconnect removes every row, and
  Re-connect does not bring them back. Symptom: trigger on, Refold workflow
  enabled, no Logs row ever. Fix: turn the trigger off and on, Save.
  (salesforce/reply-received-in-saleshandy.md:60-65)
- Refold (the workflow engine) runs the workflow as the account's "linked
  account", with the CRM token stored when the account connected the CRM.
- "Re-connect" on the Salesforce card means Refold reports
  `reauth_required` (saleshandy-webui `crm-view.tsx:83`). Every Salesforce
  workflow of that account fails with `invalid_grant` until it is
  reconnected. (salesforce/email-sent-from-saleshandy.md:137-139)
- Every Saleshandy test account connects the same Salesforce org
  (`saleshandy-dev-ed`) [project]. Salesforce keeps about 5 refresh tokens
  per user and connected app [Salesforce docs], so many connected accounts
  may cause the drops. Not proven: run `SELECT AppName, User.Username,
  CreatedDate, LastUsedDate FROM OauthToken` as an org admin to check.
- A Logs row is one run of the whole workflow, not one activity's result
  [project, lessons.md]. Success can mean "nothing matched, nothing done".
  The step details of the run show what each step did.
- Refold puts each `{{value}}` into a request body JSON-escaped once. Code
  that escapes again leaves a literal `\"` in the CRM (HubSpot AL-4129).
- Salesforce-side workflows ("... is created in Salesforce") are not
  webhooks. They run on a cron every 3 hours (`0 */3 * * *`, UTC). Use
  `npm run sf:run-now` to run one at once.
- Production can run an older workflow version than staging. On 2026-10-22,
  production Salesforce "Email Sent" and "Prospect Outcome Updated" were
  still version 1; the fixed versions were prepared for production but the
  import was the developer's call. Ask which version is live before calling a
  production result a new bug.

## 2. Before you test any workflow

1. The CRM card shows Connected (not Re-connect). Tests now reconnect by
   themselves on staging; see `testing/reusable-building-blocks.md`.
2. Field Mapping for every object the activities write is set and saved on
   this account. Unsaved mapping makes the mapping step return nothing and
   the record gets only email and name. (hubspot/prospect-outcome-updated-in-saleshandy.md:66;
   salesforce/lead-created-in-salesforce.md:174)
3. The trigger is on and Saved after any disconnect (section 1).
4. Saving the trigger's Extra Configuration popup rewrites its Actions;
   check the activities after each save. (salesforce/reply-received-in-saleshandy.md:54, :66)
5. Other workflows that would fire on the same action are off, or the test
   accepts their extra records (section 5).
6. The test email is new to the account: Saleshandy accepts an email once per
   account (400, code 1001) [project].

## 3. Salesforce

### Saleshandy side to Salesforce (7 email workflows)

Email Sent, Reply Received, Sequence Email Opened, Link Clicked, Email
Bounced, Prospect Unsubscribed and Prospect Outcome Updated are one graph
with a different trigger and note text. Shared rules:

- Contact: found by email only. Found: Update; not found: Create. (email-sent-from-saleshandy.md:91, :137)
- Lead: Create a Lead first looks for a Contact with the email; a Contact
  exists: no Lead. Else the Lead is updated or created. (email-sent-from-saleshandy.md:14, :151)
- Account: found by the prospect's full name "First Last", not by Company.
  Create a Account names the new Account after the Company, so Update a
  Account does not find it. Accepted by the developer, QA decides bug or not
  [project, email-sent-progress.md]. (email-sent-from-saleshandy.md:16, :187)
- Opportunity: Create makes a new one on every event, linked to the Contact,
  no Account (by design). Update changes only the newest Opportunity whose
  Name is the prospect's email. (email-sent-from-saleshandy.md:15, :187, :192; reply-received-in-saleshandy.md:126)
- Attach Note: on the record the activity created or updated.
- Record(log) an Email Activity: one completed Email Task per object ticked
  in Select Object, linked to the Contact or Lead and the newest
  Opportunity. No Account option. (email-sent-from-saleshandy.md:21, :156, :193)
- Update activities do nothing when no record matches; Logs still Success.
  (email-is-bounced-in-saleshandy.md:27; prospect-is-unsubscribed-in-saleshandy.md:53)
- Accepted, not bugs: Create a Contact together with Create a Lead or Create a
  Opportunity can fail with DUPLICATES_DETECTED (Salesforce duplicate rules;
  customers must not combine them, developer decision). Missing Last Name or
  Company gives REQUIRED_FIELD_MISSING. Closing Date mapping format error.
  (email-sent-from-saleshandy.md:80, :93, :128-129)
- Known open: Record(log) an Email Activity can miss a record created in the
  same run (F-2). (prospect-is-unsubscribed-in-saleshandy.md:61)

| Workflow | How the test fires it | Notes | Latest version that passed |
|---|---|---|---|
| Email Sent | A sequence email is really sent (Send now) | Fires for every send of every test on the account | v6 (email-sent:200-215) |
| Reply Received | Send, then a real reply or Mark as replied | A real reply was once not detected by Saleshandy; the Task's "Email body:" is empty (no body in the reply event) | v3, 12 of 12 (reply-received:118-122) |
| Sequence Email Opened | Send with open tracking on, then open | Every open (re-opens too) is one run, 10-40 s later; stray opens of other emails also run | v4 (sequence-email-is-opened:38, :65, :100) |
| Link Clicked | Send with link tracking on, then click | A click also counts as an open: turn Opened off | v4 (link-is-clicked:52, :84) |
| Email Bounced | Mark the email bounced (edge `PATCH .../emails/status`) or a real bounce | Manual bounce has no bounce reason; one run per sequence task | v2, only B1 run (email-is-bounced:6-7, :34) |
| Prospect Unsubscribed | Unsubscribe a prospect that is in a sequence | No sequence: no event. "Manually Unsubscribed?" line is always blank (edge F-1) | v2 (prospect-is-unsubscribed:6-7, :41-60) |
| Prospect Outcome Updated | Send first, then change the outcome on the sequence | No sent email: no event. Open API outcome change does not fire (SH-20244). Each activity has its own outcome filter; empty filter = every outcome | v6 (prospect-outcome-updated:10-17, :168-175) |
| Call Logged / Call Outcome Updated | Log a call; change its outcome | Record found by email, else phone (last 10 digits); one Call Task per object, updated on repeat. A call with no prospect sends an empty prospect. Known: orphan Task when no record matches (B1) | Call Outcome T1-T4 live; newest files not live-tested (call-outcome-updated:69-79) |

### Salesforce side to Saleshandy (4 workflows)

Lead, Contact, Account and Opportunity "is created in Salesforce".

- Cron every 3 hours; `npm run sf:run-now -- <account> "<name>"` runs one
  now and prints each step. (contact-created-in-salesforce.md:4, :77)
- Contact, Account and Opportunity do not apply their 3-hour window: each run
  reads up to 200 records of the whole org (kept on purpose). Lead keeps a
  cursor and reads only Leads newer than its last run. (contact-created-in-salesforce.md:84, :109; lead-created-in-salesforce.md:4, :106)
- People: Contact = the Contact; Account = its Contacts; Opportunity = all
  contact roles, primary first; Lead = the Lead. No email: skipped.
- Each person is upserted as a prospect with the object's Field Mapping, then
  the chosen actions run: add to sequence step, tag, status, unsubscribe,
  blacklist domain. Blacklist runs once for all domains and skips every
  other action. Nothing is written to Salesforce.
- Test rules: check only your own prospect; never select blacklist or
  unsubscribe while others test (they would hit saleshandy.com, gmail.com and
  other tests' people); turn the trigger off afterwards so the 3-hourly run
  does not repeat your actions. (contact-created-in-salesforce.md:27-30, :122-123; lead-created-in-salesforce.md:73, :163)
- Salesforce duplicate rules can reject a test Lead that looks like an
  earlier one. (lead-created-in-salesforce.md:159)
- Latest passing: Account v3, Contact v6 (field check pending), Opportunity
  v3, Lead v3; Lead v5 (mapping fix) not tested.

## 4. HubSpot, Zoho, Pipedrive

Same pattern in all three:

- Contact or person found by email; exists: update, else create.
- Update deal = the newest deal linked to that contact (version 1 searched
  deals by name; that was the main bug everywhere).
- Notes and logged emails go on the contact and the deal or company.
- Dates: Saleshandy sends `YYYY-MM-DD HH:MM:SS`. HubSpot rejects it in a date
  property (400 INVALID_LONG, bug D3-1, also in production) and Zoho rejects
  it; Pipedrive accepts it. (hubspot/reply-received-in-saleshandy.md:125; zoho/email-sent-from-saleshandy.md:86)

HubSpot (QA's own context: `../../automation/context/hubspot/`):

- A logged email is attached to every deal of the contact (HubSpot
  behaviour, AL-4130, closed). (hubspot/link-is-clicked-in-saleshandy.md:107-110)
- One click gave 4 runs; create deal, company and task run on every click
  and make duplicates. (hubspot/link-is-clicked-in-saleshandy.md:71, :106)
- Opened renames the deal to "FirstLast" (no space) on every open; Closing
  Date 0 is skipped. (hubspot/sequence-email-is-opened-in-saleshandy.md:34, :62)
- New contact: create contact and create company race; HubSpot accepts it.
  (hubspot/reply-received-in-saleshandy.md:118)

Zoho (7 workflows, latest `v5-account-link` for all):

- One shared contact step, newest linked deal, Account from the contact's
  Account Name. (zoho/email-sent-from-saleshandy.md:92, :114, :130-132)
- Known, kept by decision: one badly typed mapped value fails the whole record
  (Z-1); a deal's plain-text Account Name auto-creates a blank Account (Z-5);
  the Bounced/Unsubscribed tag replaces the contact's other tags (Z-6, data
  loss); Deal layout is hidden so Pipeline and Stage cannot be set (Q3);
  Conversation Category "Meeting Booked" never matches (Z-7).
  (zoho/email-sent-from-saleshandy.md:67-95, :137; zoho/conversation-category-updated-in-saleshandy.md:45)
- Link scanners can fire 3 clicks in 15 s: 3 runs, 3 notes. (zoho/link-is-clicked-in-saleshandy.md:42)

Pipedrive (7 workflows, latest `v2-fixes` for all; only Email Sent run live):

- One shared person step; update and delete deal use the person's latest
  deal; create deal and create lead make a new one every event; the
  organization is not linked to the person (decision).
  (pipedrive/email-is-bounced-in-saleshandy.md:11, :30-32; pipedrive/email-sent-from-saleshandy.md:156)
- Known open: update person or update deal with no person gives 500 or 403
  (B1, B2). (pipedrive/email-sent-from-saleshandy.md:151, :154)

## 5. Workflows that affect each other

- On one Saleshandy account, every test that sends an email fires Email Sent
  (Reply, Opened, Clicked, Bounced, Unsubscribed, Outcome all send first). An
  Outcome test's send changed the Opportunity through Email Sent.
  (salesforce/prospect-outcome-updated-in-saleshandy.md:78; salesforce/reply-received-in-saleshandy.md:101)
- A click also counts as an open: with Opened on, a Link Clicked test also ran
  Opened, which made a Lead and broke the test with DUPLICATES_DETECTED.
  (salesforce/link-is-clicked-in-saleshandy.md:52)
- Two workflows matching an Account by person name update each other's
  Account. (salesforce/prospect-is-unsubscribed-in-saleshandy.md:52)
- A reply also fires Conversation Category / Outcome workflows. (zoho/reply-received-in-saleshandy.md:54)
- HubSpot-side triggers react to records any test makes in the shared portal:
  "Import Prospects from Hubspot" imported and emailed a contact a Link
  Clicked test made. (hubspot/link-is-clicked-in-saleshandy.md:105)
- Salesforce-side workflows read every record other tests make in the org
  (section 3).
- Call Logged and Call Outcome Updated can both make a Task for one call.
  (salesforce/call-outcome-updated-in-saleshandy.md:28, :73-79)
- `npm run parallel` prints these clashes for the workflows chosen and asks
  before it starts.
