# Saleshandy to Zoho CRM: overview

Platform: Zoho CRM (US data center, `crm.zoho.com`). Direction: a Saleshandy event triggers Zoho activities. Zoho-to-Saleshandy triggers are out of scope.
Workflow version in scope: `v5-account-link` for all 7 workflows (developer runs, 2026-10-12 and 2026-10-13).

## Sources and trust

| Tag | Source |
|---|---|
| `[dev kit]` | Developer API test logs in `integration-skills/test-logs/zoho/` (7 files) and `knowledge-base/product/workflow-behaviour-dev-kit.md` section 4. Found through API calls and workflow JSON, not the UI. Zoho org 941113438, Refold config 80121, staging. |
| `[public docs]` | docs.saleshandy.com Zoho articles. Details and links: `research.md`. |
| `[QA]` | Told by QA in chat, with the date. |
| `[project]` | Project file. |

- No one saw anything here in the Saleshandy UI. Do not treat a line as `[staging]` until a walkthrough confirms it.
- Bug status comes from the logs of 2026-10-12 and 2026-10-13. Recheck it before you file or skip a bug.
- Where `[public docs]` and `[dev kit]` differ, this file says so under "Differences".

## Workflows in scope

| # | Workflow (trigger name) | Note title in Zoho | Context file |
|---|---|---|---|
| 1 | Email Sent from Saleshandy | not recorded | `email-sent.md` |
| 2 | Reply is Received in Saleshandy | not recorded | `reply-received.md` |
| 3 | Link is Clicked in Saleshandy | not recorded | `link-clicked.md` |
| 4 | Sequence Email is Opened in Saleshandy | not recorded | `email-opened.md` |
| 5 | Email is Bounced in Saleshandy | "Saleshandy Email is Bounced" | `email-bounced.md` |
| 6 | Prospect is Unsubscribed in Saleshandy | not recorded | `prospect-unsubscribed.md` |
| 7 | Conversation Category (Prospect Outcome) is updated in Saleshandy | not recorded | `conversation-category-updated.md` |

`[public docs]` also lists a "When a Prospect is Finished" trigger. The developer logs have no workflow for it. Same gap as Pipedrive.

## Terms

- Event: one Saleshandy action that starts a run (an email sent, a reply, a click).
- Action slot: one of the "Select ... Action 1" to "Action 11" dropdowns on the Triggers & Activity tab. The names say "Pipedrive" because the Zoho workflows were copied from Pipedrive. Do not rename them. Saved configurations use them. `[dev kit]`
- Mapping: the field pairs on the Field Mapping tab (Saleshandy field to Zoho field).
- Upsert: if the record exists, update it. If not, create it.
- Run: one execution of the workflow in Refold. It has a node log.

## What the workflow does

All 7 workflows have the same shape. `[dev kit]`

1. Start. For the Conversation Category workflow, a category gate runs first (see `conversation-category-updated.md`).
2. Five OR-rules read the action slots: Account, Contact, Lead, Deal, Task.
3. Each action reads the prospect fields, applies the mapping, then upserts the record.
4. A note is created on every record the run creates or updates. Each label is on its own line.

Actions the webui offers: `create-account`, `create- contact` (with a space), `create-lead`, `create-deal`, `create-task`. Each one is an upsert, so there is no separate update action. `[dev kit]`

## Action rules (v5)

- **Contact (shared step).** When you select Contact or Task, one shared step upserts the contact with the Contact Fields mapping. Contact, Task and Deal all use this one contact. Task alone also upserts the contact. `[dev kit]`
- **Lead.** Upsert with the Lead Fields mapping. Company comes from the prospect company. When the prospect has no company, the workflow leaves Company out. It does not send a blank. A second event updates the same lead and does not create a duplicate. `[dev kit]`
- **Account.** When the contact has an account, the workflow updates that account with the mapped fields and keeps its name. When it has none, the workflow upserts the account and links it to the contact. With no contact, it upserts only. `[dev kit]`
- **Deal.** The workflow finds the contact by email, then the contact's newest linked deal. When a deal exists, the workflow updates it by id. It sends the mapped fields, Closing Date, Pipeline and Stage, and drops empty values. Stage that a user changed by hand is kept. When none exists, the workflow creates a deal linked to the contact. With no Zoho contact, the deal is created unlinked, and a later event links it. `[dev kit]`
- **Closing Date.** The "Deal Closing date" setting is a number of days from today. Empty means no closing date and no error. `[dev kit]`
- **Task.** Fields: Subject, Status, Priority, Due In (days). The task is linked to the shared contact. Empty Subject skips the task and its note, and the run still completes. `[dev kit]`
- **Notes.** One note per record, with one label per line. The workflow skips a note when it did not create the parent record. `[dev kit]`
- **Tags (Bounced and Unsubscribed only).** The contact gets a tag (see Known issues, Z-6). `[dev kit]`
- **Phone.** The fixed Phone value is empty, so an existing Zoho phone is never cleared. Phone comes from the mapping only. For Bounced the dev log says Phone is the real phone. `[dev kit]`

## Checks before testing

Most "nothing happened" reports come from a missed step.

1. Zoho is connected in Saleshandy, under Settings > Integration. Only the Outreach Pro plan has it. `[public docs]`
2. The workflow is ON and the popup is saved. If connect fails or fields are missing, disconnect and reconnect. `[public docs]`
3. The Zoho mappings are saved. In the first dev run all four Zoho mappings were empty, so the workflow sent no mapped fields. That was a setup gap, not a bug. `[dev kit]`
4. Mapped values have a compatible type (see Z-1). One mistyped value fails the whole record.
5. Email Opened: open tracking is on in the sequence options. `[dev kit]`
6. Reply Received: Saleshandy detected the reply. If not, no event goes to Zoho. `[dev kit]`
7. Use a new prospect email for each scenario. Developers used `rudra+zoho-*@saleshandy.com`. Those belong to other people. Use your own, for example `dharmesh+zoho-e1@saleshandy.com`. `[project]`
8. Wait for the Emails tab row to show Sent, then 15 seconds. Look in Zoho first. If the record is missing, open Logs. `[QA, Pipedrive rule, assumed to apply]`
9. Link scanners and previews can click links. One real click can give up to 3 runs and 3 notes (Z-10).
10. Developers waited 20 seconds before they read the node log. Reading earlier misses the last nodes.

## Workflows that affect each other `[dev kit]`

- Every test that sends an email also fires Email Sent on the same Saleshandy account. Turn Email Sent off for sibling workflows.
- A click also counts as an open. With Opened on, a Link Clicked test also runs Opened.
- A reply also fires the Conversation Category workflow. The category gate decides whether anything runs.
- Two workflows that run on one prospect upsert the same contact. Use one prospect per scenario.

## Known issues (decided or reported, do not file again) `[dev kit]`

| Id | What | Status |
|---|---|---|
| Z-1 | One mistyped mapped value makes Zoho reject the whole record (400 INVALID_DATA). Seen with Company Size "11-50" into an integer, a Twitter URL into a handle, and a date with a time into a date field. Numeric strings like "25" are accepted. Unknown picklist values are accepted. | Customer-side mapping choice. Document only. |
| Z-5 | A deal's plain-text Account Name makes Zoho create a blank Account on its own. With Account and Deal together this gives two accounts. | Kept by decision. |
| Z-6 | The Bounced or Unsubscribed tag replaces the contact's other tags (for example VIP). Data loss. | Kept by decision. |
| Z-7 | Category "Meeting Booked" never matches. The webui saves the key `:Meeting Booked` with a colon. The event sends `Meeting Booked`. The gate is false and nothing runs. | Reported, webui bug. |
| Z-8 | The Conversation link in the note has no id after someone changes the outcome outside a conversation. | Low, cosmetic. |
| Z-9 | The Email Body in the note is raw HTML inside a plain-text note. | Low, cosmetic. |
| Z-10 | A link scanner gives 3 Link Clicked events in 15 seconds, so 3 runs and 3 notes on the lead and the deal. | Saleshandy event behavior. |
| Q3 | The webui hides "Select Layout" for Deal, so Pipeline and Stage cannot be set from the UI. The layout and pipeline deal variants cannot be reached. | Reported webui bug. |

Fixed in later versions: Z-2 (deal upsert reset Stage and Closing Date, and updated the oldest deal) in v3. Z-3 (a search with no match counted as found, so a task had no contact) in v3. Z-4 (a note under a skipped parent errored the run) in v3. Z-11 (two parallel branches created two contacts) in v4.

## Configuration the tester can set

| Setting | Values |
|---|---|
| Action slots 1 to 11 | Create Account, Create Contact, Create Lead, Create Deal, Create Task |
| Deal | Deal Closing date (days from today), Pipeline and Stage (hidden in the UI, Q3) |
| Task | Subject, Status (Not Started, Deferred, In Progress, Completed, Waiting on someone else), Priority (High, Highest, Low, Lowest, Normal), Due In (days) |
| Conversation Category | Conversation Category workflow only |
| Mappings | Contact Fields, Lead Fields, Account Fields, Deal Fields. Saleshandy has 15 default fields that cannot change (First Name, Last Name, Email, Phone Number, Job Title, Industry, Company, Company Domain, Linkedin, Twitter, Facebook, Website, City, State, Country). Custom prospect fields can be mapped. `[public docs]` |

Mappings that the developers saved on staging (2026-10-12): Contact: phoneNumber to Phone, jobTitle to Title, department to Department, city to Mailing_City, country to Mailing_Country, twitter to Twitter. Lead: phoneNumber to Phone, jobTitle to Designation, industry to Industry, website to Website, city to City, companySize to No_of_Employees, companyRevenue to Annual_Revenue. These were probes, not a QA decision. Choose the real QA mapping before the first test. `[dev kit]`

## Differences between sources

- `[public docs]` says bounced and unsubscribed contacts get the tag "Unsubscribed-Saleshandy". The dev log shows "Bounced-Saleshandy" for bounce and "Unsubscribed-Saleshandy" for unsubscribe. Make sure that staging shows which one is right.
- `[public docs]` lists "Create/Update" for Lead, Deal, Contact and Account. The webui offers only create options, and each one is an upsert.
- `[public docs]` lists 9 triggers with Sequence Email Opened twice. The dev logs cover 7 workflows.

## Unclear (ask QA or look on staging)

1. How the Zoho connect and disconnect screens look, and what OAuth scopes they ask for.
2. Whether the Updated and Created records match Zoho duplicate rules (Salesforce had `DUPLICATES_DETECTED`).
3. Whether the bugs Z-1 to Z-6 still behave the same on current staging.
4. Which Zoho edition and modules the test org has. Developers used org 941113438.
5. The note title for each workflow.
6. Whether "Prospect is Finished" has a workflow.
7. The release dates. The "Integration wfs" sheet listed Zoho as 8 rows, 23 to 26 Oct, and has not been re-read.

## Jira

No Zoho workflow tickets exist yet. AL-3990 (Other CRM Connectors - Exploration, To Do) and the epic AL-3982 mention Zoho. Checked 2026-10-28.
