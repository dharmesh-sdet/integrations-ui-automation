# Email Sent from Saleshandy (Salesforce)

Readiness for scenario generation: Partial. Built from docs.saleshandy.com,
the Salesforce integration KB page (`knowledge-base/product/salesforce-integration.md`),
and observations from the Reply Received staging walkthrough (`reply-received-progress.md`).
Nothing specific to this trigger has been checked on Saleshandy staging yet.
Tags: `[docs]` public Saleshandy docs, `[Salesforce docs]`, `[staging]` seen on
the org or Saleshandy staging, `[QA]` QA decision.

Jira sub-task: AL-4132 (parent AL-4131), see `00-overview.md`.

Direction: Saleshandy to Salesforce (the trigger is an email sent by a
Saleshandy sequence; the activities create or update Salesforce records).

## What it does

When a Saleshandy sequence sends an email to a prospect, the "Email Sent from
Saleshandy" trigger runs and performs the selected Salesforce activities [docs].
The prospect must be added to an active sequence; once the email is sent, the
configured activity runs.

## Activities

Confirmed on staging (sfreplyreceived account, Triggers & Activity page,
2026-10-16). Activities are **separate Create and Update**, not combined
"Create or update" as the docs say. QA initially said combined but staging
shows separate (same pattern as HubSpot).

| # | Activity | Extra Configuration | Notes |
|---|---|---|---|
| 1 | Create a Account in Salesforce | Not explored yet | Account requires Account Name [Salesforce docs]. |
| 2 | Update a Account in Salesforce | Not explored yet | |
| 3 | Create a Contact in Salesforce | Not explored yet | Contact requires Last Name [Salesforce docs, staging New Contact form]. |
| 4 | Update a Contact in Salesforce | Not explored yet | |
| 5 | Create a Lead in Salesforce | No extra configuration modal (Reply Received walkthrough) [staging] | Lead requires Last Name, Company, Lead Status (default "Open - Not Contacted") [staging, New Lead form]. |
| 6 | Update a Lead in Salesforce | Not explored yet | |
| 7 | Create a Opportunity in Salesforce | Closing date, Opportunity Stage [docs] | Opportunity requires Name, Close Date, Stage [staging, New Opportunity form]. Account Name is NOT required in this org [staging]. |
| 8 | Update a Opportunity in Salesforce | Not explored yet | |
| 9 | Attach Note in Salesforce | None. Must be paired with Create/Update Contact or Deal [docs] | Docs say "Contact or Deal"; Salesforce has Opportunity, not Deal. |
| 10 | Record(log) an Email Activity in Salesforce | None documented | What the logged email contains is not documented. |

## Prerequisites and setup

- Environment: Saleshandy staging (pyxis.lifeisgoodforlearner.com), Salesforce
  Developer Edition org `saleshandy-dev-ed` (shared; use a unique prefix per
  run, never edit existing records) [staging].
- Account: `sfemailsent` (dedicated Saleshandy staging account, new). Email
  address not set up yet.
- Salesforce login: username + password + SMS code. Saved session needed;
  scripts cannot get past the code [staging].
- Connect Salesforce: Settings > Integrations > Connect now > Salesforce
  Integration > Continue, authorize, "Connected" [docs]. The exact path on
  staging is not checked for this account.
- Field mapping: Settings > Integrations > Salesforce > Field Mapping. Map
  Saleshandy prospect fields to Salesforce Lead, Contact, Account and
  Opportunity properties, then Save [docs]. The mapping page shows 44 Salesforce
  Lead fields [staging, reply-received walkthrough]. Default fields cannot be
  changed; custom fields can be added [docs].
- Triggers & Activity page: Settings > Integrations > Salesforce > Triggers &
  Activity. Enable the trigger, select an activity, fill extra settings, Save
  [docs, staging tabs confirmed].
- Logs: Settings > Integrations > Salesforce > Logs [staging tabs confirmed].
- A sequence that is active, so adding a prospect sends the email.
- Sender email account: check time between emails before the first send.
  Reply Received account "Salesforce Testing" was 40 to 50 s, 150/day [staging].
  If 300 to 1200 s, stop and ask QA to fix (plan rule).

## How to execute

1. Go to Settings > Integrations > Salesforce > Triggers & Activity and enable
   "Email Sent from Saleshandy" [docs].
2. Select the activity.
3. Fill Extra Configuration if the activity has one, then Save in the modal.
4. Click Save on the Triggers & Activity page.
5. In Saleshandy, go to the active sequence and add the prospect with Add
   Prospects, so the email is sent.
6. Wait for the email to be sent. Check Settings > Integrations > Salesforce >
   Logs. Refresh 15 s after the action, then every 10 s until Success
   (project rule).
7. Check the result in Salesforce (Lead, Contact, Account, Opportunity, or
   Activity timeline).

Re-triggering: add the prospect to the sequence again. If already added, use
Send now from the Emails tab (three-dot menu on the prospect's row) [from
HubSpot Email Sent context; confirm on Salesforce staging].

## Where to verify

- Saleshandy: Settings > Integrations > Salesforce > Logs (Success or Error,
  details drawer per action).
- Salesforce: the relevant object tab (Leads, Contacts, Opportunities, or the
  record's Activity timeline for Record Email Activity and Attach Note).

## Salesforce org picklists (confirmed on staging)

Confirmed by browsing the Salesforce Developer Edition org, 2026-10-16.

**Lead Status:** --None--, Open - Not Contacted (default), Working - Contacted,
Closed - Converted, Closed - Not Converted [staging].

**Opportunity Stage:** --None-- (default on form), Prospecting, Qualification,
Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis,
Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost [staging].

**Opportunity form required fields:** Opportunity Name, Close Date (format
DD/MM/YYYY), Stage. Account Name is NOT required in this org [staging].

**Opportunity form other fields:** Opportunity Owner (Chintan Sapovadiya),
Amount, Private, Next Step, Type, Probability, Lead Source, Primary Campaign
Source, Order Number, Main Competitor(s), Current Generator(s),
Delivery/Installation Status, Tracking Number, Description [staging].

## Unclear: expected functionality (proposed)

Proposed results, not facts. They go to the scenarios marked
**(proposed, unconfirmed)** until QA confirms.

1. ~~Activity list on staging:~~ **Confirmed.** 10 activities, separate Create
   and Update (see Activities table above) [staging, 2026-10-16].
2. ~~"Create or update" behavior:~~ **Confirmed separate.** Create and Update
   are separate activities, same as HubSpot [staging, 2026-10-16]. Docs say
   "Create or update" but staging shows separate. QA said "combined" but it is
   separate on staging.
3. **Record already exists logic (Lead vs Contact):** a prospect may exist as a
   Lead or a Contact (after conversion). Proposed: matching by email. If a
   Lead exists, update it; if only a Contact exists, behavior unclear.
4. **Create an Opportunity also creates the Contact/Lead:** HubSpot's Create a
   Deal also creates the Contact. Proposed: same pattern, an Opportunity
   creation also creates the associated Lead or Contact if missing.
5. **Record Email Activity contents:** not documented for Salesforce. HubSpot
   logs show From, To, "logged email by", body. Proposed: similar content on
   the Salesforce Activity timeline.
6. **Attach a Note pairing:** docs say "Contact or Deal" but Salesforce has
   Opportunity, not Deal. Proposed: must be paired with Create/Update Contact
   or Opportunity.
7. **Sync timing:** not documented. HubSpot is about 1 minute. Proposed: similar
   (~1 min, same as HubSpot per QA answer).
8. **Extra Configuration for Create/Update Lead, Contact, Account:** not
   documented for Salesforce Email Sent. HubSpot has Lead Status, Lifecycle.
   Proposed: either no extra config, or similar picklist options. Check on
   staging.
9. **Trigger fires on every sequence step:** HubSpot fires on every step of a
   multi-step sequence. Proposed: same for Salesforce.
10. **Contact not in Salesforce, Update selected:** HubSpot shows Success and
    does nothing. Proposed: same behavior.

## Open questions (ask in the stage 2 round)

- How the email send is triggered and how long until it registers in Logs.
- Which Saleshandy fields map to which Salesforce properties (Lead, Contact,
  Account, Opportunity) on the staging account.
- Whether Email Sent on Salesforce offers separate Create and Update activities,
  or combined "Create or update".
- Whether Extra Configuration exists for Lead, Contact, Account on this trigger.
- What Record Email Activity shows on the Salesforce record.
- Whether Attach a Note pairs with Opportunity (Salesforce has no "Deal").
