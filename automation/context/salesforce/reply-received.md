# Reply is received in Saleshandy (Salesforce)

Readiness for scenario generation: Partial. Built from the knowledge base page `knowledge-base/product/salesforce-integration.md` (online docs plus a read-only look at the dev org on 2026-10-15). Nothing here is checked on Saleshandy staging yet. Tags: `[docs]` public Saleshandy docs, `[Salesforce docs]`, `[staging]` seen on the org or Saleshandy staging, `[QA]` QA decision.

Jira sub-task: AL-4133 (parent AL-4131), see `00-overview.md`.

Direction: Saleshandy to Salesforce (the trigger is a reply in Saleshandy; the activities are Salesforce actions).

## What it does

When a prospect replies to a sequence email, the Reply Received trigger runs the Salesforce activities the user saved on Settings > Integrations > Salesforce > Triggers & Activity [docs]. The first workflow to script is **Reply Received > Create a Lead** (journey J5 in the KB page): one reply creates one Lead, and its Company value is present because Salesforce requires it [Salesforce docs].

## Activities

Documented for the Saleshandy to Salesforce direction [docs]. Which of them the Reply Received trigger offers on staging is not checked.

| # | Activity | Extra settings | Notes |
|---|---|---|---|
| 1 | Create a Lead | Mapping for Lead properties (Configure page) | First workflow to script. Required in Salesforce: Last Name, Company, Lead Status (default "Open - Not Contacted") [staging, New Lead form]. |
| 2 | Create or Update Contact / Account / Opportunity | Opportunity: closing date and stage | Not explored. Opportunity needs Name, Close Date, Stage in the dev org [staging]. |
| 3 | Attach Note | A Create or Update Contact (or Deal) activity must run first, otherwise the note fails [docs] | Not explored. |
| 4 | Record Email Activity | None documented | Not explored. What is logged for a reply is not documented. |

## Prerequisites and setup

- Environment: Saleshandy staging (pyxis.lifeisgoodforlearner.com), Salesforce Developer Edition org `saleshandy-dev-ed` (shared; it holds other people's test records; use a unique prefix per run, never edit existing records) [staging, QA 2026-10-15].
- Salesforce login is username, password, then an SMS code. QA logs in once with `npm run login:salesforce`; the session is saved and reused [staging].
- Connect: Settings > Integrations > Connect now > Salesforce Integration > Continue, authorize, "Connected" [docs]. The exact path on staging is not checked.
- Configure (top-right menu): map Saleshandy fields to Lead properties, then Save [docs]. The mapping is not documented (KB section 8).
- Account: a dedicated Saleshandy staging account for this workflow (QA, 2026-10-16). Email not given yet.
- Sender email account: check time between emails before the first send (plan rule, 300 to 1200 s means stop and fix).

## How to execute

1. Triggers & Activity: switch Reply Received on, choose Create a Lead, fill the extra settings, Save [docs].
2. Trigger a reply: not documented for Salesforce. HubSpot used a real reply or marking the email as Replied. Ask QA.
3. Check the run in Settings > Integrations > Logs. Refresh 15 s after the action, then every 10 s until Success.
4. Check the Lead in Salesforce itself (a Success row does not prove the record exists [KB, common-bugs #49]).

## Where to verify

- Saleshandy: Settings > Integrations > Logs.
- Salesforce: Leads tab, the Lead record (fields, Company, Lead Status, owner).

## Unclear: expected functionality (proposed)

Proposed results, not facts. They go to the scenarios marked **(proposed, unconfirmed)** until QA confirms.

- Same prospect replies twice, or exists already as a Lead: update the existing Lead, or create a duplicate. Proposed: no duplicate Lead. Depends on the org's duplicate rule, which is not read yet.
- Prospect already exists as a Contact (for example a converted Lead): proposed: no new Lead is created. Not documented.
- Company value when the prospect has no company: proposed: save fails or a default is used. Not documented; the Lead form needs Company.
- Lead Status on the created Lead: proposed: "Open - Not Contacted" unless the mapping sets it.
- Lead owner: proposed: the connected user (`malav@saleshandy.sandbox`). Not documented.
- Whether the Lead is created when the trigger is on but the mapping is empty.

## Open questions (ask in the stage 2 round)

- How the reply is triggered in the UI and how long until it registers.
- Which Saleshandy fields map to which Lead properties on staging.
- Whether Reply Received on Salesforce offers the same activity list as in the docs.
- Jira ticket for this workflow.

## Exploration 2026-10-20: Update a Lead, Create a Contact, Attach Note

Seen on `sfreplyreceived` (staging, MCP browser, nothing saved) [staging]:
- Reply is Received in Saleshandy is on with "Create a Lead in Salesforce" saved (Baseline 2 left it so).
- The dropdown lists 10 activities, every name ending in " in Salesforce": Create a Account, Update a Account, Create a Contact, Update a Contact, Create a Lead, Update a Lead, Create a Opportunity, Update a Opportunity, Attach Note, Record(log) an Email Activity.
- Update a Lead, Create a Contact and Attach Note each open no Extra Configuration dialog. Several activities can be selected on one trigger (4 chips shown together, not saved).
- Contact Properties mapping on this account: First Name, Last Name, Email to the same names; Phone Number to Business Phone; Department to Department; City to Other City; State to Other State/Province; Country to Other Country; Company HQ Location to Other Zip/Postal Code; Profile Picture to Photo URL. Job Title and Company are not mapped for Contacts.
- Attach Note must pair with Create a Contact or Update a Contact (no Deal in Salesforce); the pairing worked when tried by QA on 2026-10-17 [QA].

Unclear: expected functionality (proposed):
- Update a Lead matches the existing Lead by email and changes only mapped fields. With no matching Lead nothing is created. Not seen at runtime.
- Create a Contact with a Contact of the same email already present creates no second Contact (the org duplicate rule was not read). Not seen at runtime.
- A Lead with the same email does not stop a Contact being created, and the Lead stays unchanged. Not seen at runtime.
- What the Note holds on a reply is unknown. "Mark as replied" has no reply body, so the Note may hold only a title or step details.
- Attach Note selected alone saves without error (seen on Email Sent, 2026-10-19). What it does at runtime is unknown.

Observed 2026-10-20 (pilot, one reply each, staging) [staging]:
- Update a Lead matched the existing Lead by email and replaced Title, Phone, Company and Address with the prospect's mapped values; one Lead; Logs Success.
- Create a Contact created one Contact (Name, Business Phone, Email, Department, Other Address from the mapping; Title and Account Name empty) and no Lead; Logs Success.
- Create a Contact + Attach Note added one Note on the Contact: Title "reply-received", Body with sequence, step, variant, sender, thread, link and email details, no reply text, empty Latest Outcome, sequence link on my.saleshandy.com (a bug, QA 2026-10-20). Logs Success (14.2 s).
- Still unseen: Update a Lead with an empty prospect Phone, no matching Lead, Contact already existing, Lead existing when a Contact is created, both Create a Lead and Create a Contact selected, Attach Note alone.
- QA, 2026-10-20: the Note's Latest Outcome shows the prospect's outcome. Change the prospect outcome first, then Mark as replied, to fill it. With "Add Outcome" it stays empty. The sequence link on the production host is a bug (draft in `jira/drafts/`).
