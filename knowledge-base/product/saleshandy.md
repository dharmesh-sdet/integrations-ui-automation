# Saleshandy product areas

One section per area: what it does, key rules, what to test. Everything here
is `[public docs]` (docs.saleshandy.com, read 2026-10-08) unless tagged
otherwise. Not yet checked on staging; check before a test depends on it.
Article links: `https://docs.saleshandy.com/en/articles/<id>`.

Areas in the docs not covered yet: Multichannel, Client Management
(agencies), Dialer, MCP, Automations, Email Deliverability/Infrastructure.

## Conflicts to settle with QA

| Topic | Public docs | Project files |
|---|---|---|
| Prospect outcomes | Interested, Not Interested, Meeting Booked, Automatic Response, Closed, Not Now, Do Not Contact, plus custom | Adds Uncategorized and Out of office, no Automatic Response (`00-overview.md` glossary) |
| Sequence statuses | Active, Inactive, Completed, Paused, Replied, Bounced, Unsubscribed; Finished not defined; Blacklisted not a status | Finished and Blacklisted are Latest Status values (`00-overview.md`) |
| HubSpot Create/Update Contact settings | Lead Status and Lifecycle required | Can be skipped (`00-overview.md`) |

Staging wins once seen there; until then, ask QA.

## Sequences

**What it does**
- Multi-step campaign. A step's day counts from the previous step's send date.
- Step types: Email, LinkedIn (manual, or automated via Aimfox/HeyReach), Call, WhatsApp, Custom tasks. Manual tasks are done in the Tasks tab.
- A/Z testing: up to 26 variants per step, prospects split equally.
- Settings: sender accounts (rotation), schedule, safety, email verification, Cc/Bcc, unsubscribe.

**Key rules**
- Activating needs a connected email account and prospects; toggle Pause to Active.
- Stop on reply is on by default; a reply finishes the prospect.
- Text Only mode (default off) disables open/click tracking and hides the Opened and Clicked tabs.
- Cc/Bcc: up to 5 addresses; their unsubscribe or click counts as the prospect's.
- Variants not on the Starter plan; a prospect's variant is not fixed across steps.
- Changing the default schedule does not change existing sequences.
- One email per prospect per day; several non-email steps allowed.
- Tasks appear about 15 minutes after a prospect reaches the step.
- Bulk pause/resume: 15 sequences at a time.
- Out of office detection pauses for 1 to 100 days (or the detected return date), then resumes; a reply during the pause makes it Replied.
- Replied and Finished prospects can be resumed; Bounced and Unsubscribed cannot be paused.
- Setting an outcome does not stop the sequence. Deleting an outcome with no replacement leaves prospects uncategorized.

**What to test**
- Stop on reply on vs off.
- Equal variant split; disabled variants not sent.
- Out of office pause, auto-resume, reply during pause; Resume from Replied/Finished.
- Text Only mode hides tracking tabs.
- Setting an outcome does not pause the prospect.

Sources: 7220800, 7055488, 7055206, 7047031, 11130890, 8535613, 10449816, 8176411

## Prospects and CRM

**What it does**
- Add prospects by CSV import, manually, Lead Finder, CRM "Add to Sequence", or the LinkedIn extension.
- Custom fields (Settings > Prospect Fields): Text or Number, optional fallback.
- Tags from the Prospects tab, a sequence, or CSV. CRM has List and Kanban views, notes, tasks.

**Key rules**
- CSV: max 120 columns, 100,000 rows, about 95 MB; no commas inside fields. An import tag applies to every row.
- Duplicates matched by email only.
- Existing prospect on import: Update Missing Fields, Overwrite, or Skip.
- Multiple-sequences setting (Admin Settings) controls whether a prospect active in another sequence can be imported; applies to future imports only.
- Adding to a sequence fails if already in it, bounced/unsubscribed elsewhere, or invalid.

**What to test**
- Each import conflict mode on the same file, field by field.
- Duplicate email skipped and listed in the skipped report.
- Wrong field type (Text vs Number) at mapping.
- Each multiple-sequences setting.

Sources: 7906963, 6970067, 7836395, 7877098, 6919058

## Email accounts

**What it does**
- Connect by Google or Microsoft OAuth, or SMTP/IMAP (single or bulk CSV).
- Per-account daily limit and ramp-up. Warm-up through TrulyInbox (API key).

**Key rules**
- Google OAuth fails unless every permission is granted.
- Soft daily limit 15. Hard limits: Gmail and Microsoft 50, GSuite and O365 150, GoDaddy 800, Yahoo 1,000, Zoho 2,000, Yandex 3,000, SendGrid and Other 4,000.
- At the limit, sending pauses until the window resets.
- Ramp-up: start value, daily % increase, optional maximum.
- TrulyInbox consent only by Owner or Admin.

**What to test**
- Limit above the hard limit is rejected.
- Sending stops at the limit and resumes next window; ramp-up never passes its maximum.
- SMTP/IMAP connection test; reconnecting a disconnected account.

Sources: 6948265, 6970059, 7906915, 10173608

## Unified Inbox

**What it does**
- Sequence replies from all accounts in one place: reply, reply all, forward, drafts, send later, set outcome, read/unread, bulk actions. Filters by client, account, outcome, owner, date.

**Key rules**
- Only the sequence owner sees replies; only replies to sequence emails appear.
- Replies go from the original sending account.
- Shows up to 90 days. Deleting a thread removes it from the inbox only, not the mailbox.
- Starter cannot reply or forward. Trial/Starter thread cap is 10 or 15 (docs disagree).

**What to test**
- Reply sent from the original account.
- Outcome change syncs with the sequence's Prospects tab.
- Non-owner cannot see replies; Starter plan gating.

Sources: 6999237, 8105392, 8176411

## Analytics and reports

**What it does**
- Sequence Report (Prospects or Emails view), Team Performance Report, Email Reports per account/domain (sends, bounces, SPF/DKIM/DMARC, blacklist). CSV export sent by email link.

**Key rules**
- Opened, Replied, Clicked are unique counts "through today", whatever the period.
- A prospect in several sequences counts once in the summary, once per sequence in the table.
- Deleting a prospect removes its report entries.
- Team Performance: Owner, Admin, Team Manager on plans with Advanced Team Management.

**What to test**
- Summary vs table counts for a prospect in two sequences.
- Totals after deleting a prospect; date filter vs "through today".
- Export email arrives.

Sources: 7237800, 12399272

## Settings

**What it does**
- Roles: Owner, Admin, Team Manager, Team Member; Teams.
- Do Not Contact lists (global or per client; emails or domains).
- Schedules, prospect fields, API keys, SSO, 2FA, billing.

**Key rules**
- An Admin cannot remove another Admin. Starter has no team management.
- DNC: manual up to 1,000 entries, CSV up to 10,000 entries and 5 MB, 30,000 total.
- A contact added to DNC after an email is scheduled does not get that email.
- Plan limits (pricing page): active prospects Starter 2,000, Pro 30,000, Scale 60,000. Integrations and webhooks from Pro.

**What to test**
- DNC entry added mid-sequence blocks the next email.
- Global vs client-specific DNC affects the right clients.
- Role permissions; plan gating (A/Z testing, teams, integrations).

Sources: 9439569, 8394748, 11325097, 7047031, 8154265

## Integrations

**Native CRMs (HubSpot, Salesforce, Pipedrive, Zoho)**
- Connect: Settings > Integrations > Connect now > CRM login (OAuth) > "Connected".
- Field mapping: top-right menu > Configure > pick CRM fields > Save. Saleshandy default fields cannot be changed; custom fields can be added.
- Triggers and activities: toggle a trigger, choose an activity; some open extra settings.
- Custom Workflow (Outreach Pro and above; HubSpot, Zoho, Pipedrive, Salesforce): triggers by API Call, Schedule (UTC cron), or Application; AND/OR conditions; chained actions. Deleting is permanent; skipped runs leave no log.
- Execution Logs tab: filter by status and date; node-level request/response; a run is Error if any node fails; failed runs cannot be re-run (except API Call triggers).

For the HubSpot integration as tested here, see
[hubspot-integration.md](hubspot-integration.md) and `00-overview.md`.

**Salesforce (next to automate)**
- Connect: Settings > Integrations > Connect now > Salesforce > Continue > log in and authorize. Bidirectional.
- Objects: Lead, Contact, Opportunity, Account. Which Saleshandy field maps to which property: not in public docs.
- Saleshandy to Salesforce triggers: Email Sent, Reply Received, Prospect Outcome Updated, Sequence Email Opened, Link Clicked, Unsubscribed, Bounced, Call Logged, Call Outcome Updated.
- Their activities: Create/Update Account, Contact, Lead, Opportunity; Attach Note; Record Email Activity; Record Call Activity.
- Salesforce to Saleshandy triggers: Contact, Lead, Opportunity, Account **Created** only (HubSpot has "Created/Properties Updated").
- Their activities: same list as HubSpot's (Add Prospect, Move to another Sequence, Mark Unsubscribed/Finished/Replied/Paused/Resumed, Assign Tag, Blacklist Domain).
- Required settings: Opportunity create needs closing date and stage; Outcome pairs need an outcome; Attach Note needs a Contact or Deal created/updated first.
- Calls: sent 90 s after the call ends as a completed Task (subtype Call); matched by email, then phone (earliest contact if several); never creates records; recordings not synced; unmatched calls skipped and logged in Settings > Integrations > Logs. The Salesforce user needs Task create/edit permission.
- Not in public docs: disconnect, rate limits, sync frequency, conflict handling.

**What to test (Salesforce)**
- Each trigger and activity pair creates or updates the right object with mapped fields.
- Attach Note fails without a prior Contact create/update and works with one.
- Saving without required settings is blocked.
- Contact/Lead Created adds or moves the prospect; an update in Salesforce does not fire.
- Calls: 90 s delay, email then phone matching, unmatched call in Logs, no record created.

**Other integrations**
- Pipedrive: Saleshandy to Pipedrive only; triggers as HubSpot plus Prospect Finished; create Lead/Deal/Person/Organization, update or delete Deal/Person/Organization.
- Zapier: API key; Saleshandy is action-only (add outcome, assign tag, blacklist domain, create/add prospect to sequence, mark finished/paused/replied/resumed).
- Webhooks (Pro and above): Settings > Webhook, up to 5 headers, events for sent, opened, clicked, reply, bounced, unsubscribed, finished, outcome, tasks. Logs kept 7 days; failed events can be resent while Active; re-enabling sends a test event.
- API: keys in Settings > API Key, shown once. Reference at developer.saleshandy.com.

Sources: 9148639, 9202976, 9203067, 9204109, 9154573, 14928967, 14929986, 8644260, 8679762, 8027076, 8861470, 9202403, 9215407, 9219786, 8154265

## Lead Finder

**What it does**
- B2B contact database with Standard, AI (Sage) and Bulk search. Revealed leads go to Saved; from there save as prospects, export, or add to a sequence step.

**Key rules**
- Bulk search: up to 100 values per parameter.
- Up to 50% of unused credits roll over on paid plans; a revealed email later marked Bad refunds its credit.
- A lead matching an existing prospect's email fills only blank fields.

**What to test**
- Add to sequence from Saved lands at the chosen step.
- Duplicate fills only blank fields; "Exclude existing prospects" filter; credit refund on Bad email.

Sources: 8778088, 7906963
