# Sequence Email is Opened in Saleshandy

Readiness for scenario generation: Phase 1 scenarios approved and scripted
(37 rows, `tests/hubspot/email-opened.spec.ts`); Phase 2 not written. No
workflow context was pasted (2026-10-12); this file holds QA's description,
public docs and what was seen on staging. Dropdown values still unread for
Deal and Update a Contact (Phase 2).

Jira sub-task: AL-4013 (under AL-3984)

Direction: Saleshandy to HubSpot (same shape as Email Sent, Link Clicked,
Email Bounced: the trigger is a Saleshandy event, activities act on HubSpot).

## What it does

When a prospect in an active sequence receives an email and opens it,
Saleshandy logs it as "email opened", the workflow runs and performs the
selected HubSpot activities [QA, 2026-10-12].
Not documented yet: what is passed to HubSpot for an open.

## Setup the open depends on

- Sequence setting **Track email opens** must be on (sequence settings,
  Safety Settings). Off stops open tracking for every email in that sequence
  [QA, 2026-10-12; public docs: Sequence Settings].
- A **custom tracking domain** is required to turn Track email opens on.
  Clicking the toggle on an account with none opens "Custom Domain
  Required: To track email opens and link clicks, you'll need to set up a
  custom domain..." with "Skip Tracking for Now" and "Set Up Custom Domain"
  [staging, 2026-10-12, account emailopened]. This matches QA's description;
  the public docs tie the domain to Track Link Clicks only and are wrong or
  incomplete here. Tracking can also push the email to Promotions or Spam
  [QA, 2026-10-12; staging toggle text].
- Where: Settings > Custom Tracking Domain (`/settings/custom-domain`) >
  Add Custom Domain: pick Email Accounts, enter the domain name, add the
  shown CNAME (Host = the domain, Value = the pyxis email tracker) at the
  DNS provider, then "Verify & Save". Also selectable per email account:
  Email Accounts > account > General Settings > Custom Tracking Domain
  [staging, 2026-10-12]. The Link Clicked account uses cd1.shengage02.com
  [project: link-clicked-progress.md].
- Added `cd1.shengage02.com` on `emailopened` (QA's choice, 2026-10-12): Add
  Custom Domain > Email Account dharmesh@saleshandy.com, domain name
  cd1.shengage02.com; the form showed CNAME Host `cd1`, Value
  `pyxis-email-tracker.lifeisgoodforlearner.com`. "Verify & Save" passed with
  no DNS change on our side: the list shows a green check, "Default", and
  "4 Email Accounts" [staging, 2026-10-12]. The same domain can be used on
  more than one Saleshandy account.
- After that, the sequence toggle Track email opens asks a second question,
  "Enable Open Tracking for Emails?" (spam warning); "Enable Anyway" turns
  it on. It saves by itself (no Save button) and is still on after a reload
  [staging, 2026-10-12]. Track link clicks stays off by default.
- Text Only mode turns off open and click tracking [public docs; also
  `product/saleshandy.md`].
- A link click also counts as an open: keep every other workflow off
  [how-to-test.md, dev kit].

## Timing

- Production [dev, via QA, 2026-10-12], seconds:

  | | First | Second (after the first) |
  |---|---|---|
  | Opened | 60 | 120 |
  | Clicked | 90 | 180 |

  The first open counts only once 60 s have passed since sending; a second
  open counts only 120 s after the first. Clicks: 90 s and 180 s. Same
  numbers as the public docs' cooling periods [public docs: Decoding Email
  Open Tracking]. An open before the threshold is not counted at all.
- Staging [QA, 2026-10-12]: 10 seconds for both the first and the second
  event, for opens and for clicks. Use 10 s as the staging wait; do not use
  the production numbers in staging tests.
- Registering time after a counted open: production 1 to 3 minutes, staging
  about 10 seconds [QA, 2026-10-12].
- Public docs also say two opens within 180 s count as one and the count can
  take up to 60 s to update; the developer's figures above are the ones to use
  [public docs, differs].

## Activities

Trigger name on Settings > Integrations > HubSpot > Triggers & Activity:
"Sequence Email is Opened in Saleshandy". The activity dropdown opens after
the trigger toggle is on, and lists these 9 in this order [staging,
2026-10-12, account emailopened]:

| # | Activity | Extra Configuration (modal, nothing saved) |
|---|---|---|
| 1 | Create a Contact in Hubspot | Lead Status, Lead Lifecycle |
| 2 | Update a Contact in Hubspot | Update Lead Status, Update Lead Lifecycle |
| 3 | Create a Deal in Hubspot | Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date (Days) |
| 4 | Update a Deal in Hubspot | Same fields, labelled "when to update" / "while updating" |
| 5 | Create a Company in Hubspot | No modal |
| 6 | Update a Company in Hubspot | No modal |
| 7 | Create a Task in Hubspot | Task Title, Task Type, Task Priority, Due In (Days), Task Associated With |
| 8 | Create a Note in Hubspot | Not opened yet (none per 00-overview.md, must be paired) |
| 9 | Record(log) an Email Activity in Hubspot | Not opened yet (none per 00-overview.md, must be paired) |

The list matches Link Clicked and Email Bounced. Extra Configuration fields
are the same as the Link Clicked list, plus "Task Associated With" on Create
a Task, to compare with the Link Clicked scenarios. The Select Outcome field
of Prospect Outcome is not on this trigger. The values inside each dropdown
were not opened.

Create a Contact modal dropdown order [staging, 2026-10-13, account
emailopened; same values expected on Update a Contact]:

- Lead Status (8): New, Open, In Progress, Open Deal, Unqualified, Attempted
  to Contact, Connected, Bad Timing.
- Lead Lifecycle (8): Subscriber, Lead, Marketing Qualified Lead, Sales
  Qualified Lead, Opportunity, Customer, Evangelist, Other.
- Both are searchable lists. Escape closes the whole modal; close a list by
  clicking its header again.
- Deal and Update Contact dropdowns still to read.

## Accounts

HubSpot account is shared with the other workflows; the Saleshandy account is
a different one for this workflow [QA, 2026-10-12]. Which account: not
recorded yet.

## Gaps

- Values inside each Extra Configuration dropdown, and the Task Associated With options.
- Which setting (Track email opens, custom tracking domain) the open needs.
- Whether Opened is deployed and fixed on staging, known tickets.

## Seen on staging, 2026-10-13

- Step 2 has no row on the Emails tab until the prospect is moved to it
  (step 2 starts on Day 3). Prospects tab > tick row > "Add to Sequence" icon
  > Sequence (current) > Sequence Steps "Step 2 - Day 3" > Add. The report
  shows "Successfully Moved 1"; the prospect's step 1 row is replaced by a
  "Step 2, Scheduled" row, which Send now can then send [QA answer + staging].
- A new account's Logs page shows "No logs yet" until the first run.
- Create a Task modal: Save is disabled from the start; after touching the
  fields only Task Title and Due In turn red. Not a bug (QA).
- "Two steps ahead" on a deal means Pipeline Stage (QA, 2026-10-13).
- Update a deal 1 and 2 with Extra Configuration empty: run once, QA decides.
- Sender dharmesh@saleshandy.com: emails per day 150, inbox placement 70,
  interval 45 to 55 s (QA, 2026-10-13).
