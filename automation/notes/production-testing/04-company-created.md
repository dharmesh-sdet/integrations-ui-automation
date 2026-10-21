# Company Created/Properties Updated in HubSpot

DRAFT for QA review (2026-10-15, scope answered by QA the same day). Smoke
test checklist, confirms production behavior for AL-4009 (Company Created
path). Covers all 9 activities under this trigger. Built from the staging
regression (`test-cases/hubspot/company-created.md`, 19 of 19 passing) in the
style of 01 to 03.

Not covered, still open: AL-4059 (updating company properties does not
trigger the workflow). The Properties Updated path is left out. Do not treat
it as a failure. A company created with no contact is not a valid scenario
(QA, 2026-10-15) and is not checked.

## Test data setup

- Account `emailopenedprod` (production), shared with the other smoke runs:
  never run them at the same time. Cloudflare blocks headless login, so QA
  logs in headed first (`npm run login:saleshandy -- emailopenedprod`,
  `npm run login:hubspot`). No email is sent by this workflow, so the
  sender's daily limit is not used.
- The production HubSpot "Create company" form has the Contact field
  (Associate Company with > Contact; QA, 2026-10-15). Contacts must already
  exist in HubSpot: create each one through the HubSpot create contact form
  first, with a Mailinator address, one at a time.
- Each check creates a NEW company (a domain nobody used before; HubSpot
  disables the Contact field when the exact domain already exists) and picks
  the contacts in the form.
- One production sequence named after the workflow, "HubSpot Company Created
  Smoke" (QA, 2026-10-15), created by
  `tests/setup/company-created-smoke-sequence.spec.ts` (one email step, not
  activated: this workflow sends no email, so nothing must go out to the
  Mailinator prospects). Its setting "Stop sending follow-ups when a reply is
  received" must be on for the Replied check; check it before the run.
- Settings > Integrations > HubSpot > Triggers & Activity: leave the other
  workflows' triggers as they are (QA, 2026-10-15; the account is shared),
  enable "Company Created/Properties Updated in HubSpot", select only the
  check's activity (activities add up: remove the previous one with
  its X), fill its Extra Configuration, Save in the dialog, then Save on the
  page. Extra Configuration cannot be cleared once saved.
- Field mapping saved on the account.
- No wait on the Logs entry (QA, 2026-10-15): check the prospect straight
  away in Saleshandy (CRM > All Prospects, search by email) and refresh until
  it shows the expected state, up to 10 minutes. The activities act on
  Saleshandy prospects, so the result is read there.
- Run in this order (later checks use the prospects the earlier ones
  created): Add Prospect, Move, Assign a tag, Paused, Resume, Replied,
  Finished, Unsubscribed, Blacklist a domain.

## Baseline: Add Prospect in Saleshandy

- Select only Add Prospect. Create the company with 2 contacts (C1, C2)
  selected in the form.
- Confirm both contacts exist in the Prospects list (AL-4009).

## Move Prospect to another Sequence in Saleshandy

- Select this activity, Extra Configuration: "HubSpot Company Created Smoke", Step 1. Create a
  company with C1, C2 and C4 (the same 3 prospects Add Prospect or an earlier
  check made; C4 is only used by the last check).
- Confirm each prospect's "HubSpot Company Created Smoke"ssociated reads "HubSpot Company Created Smoke".

## Assign a tag to Prospect in Saleshandy

- Select this activity, Extra Configuration: create and select the tag
  `TagA` (no spaces in tag names). Create a company with C1.
- Confirm C1's Prospect Tags include TagA.

## Mark Prospect as Paused in Saleshandy

- Select this activity, Extra Configuration: "HubSpot Company Created Smoke", Due in 1 day. Create
  a company with C1 (in "HubSpot Company Created Smoke").
- Confirm C1's Latest Status reads Paused.

## Mark prospect as Resume (Un-pause) in Saleshandy

- Select this activity, Extra Configuration: "HubSpot Company Created Smoke". Create a company
  with C1 (Paused).
- Confirm C1's Latest Status is no longer Paused.

## Mark prospect as Replied in Saleshandy

- Select this activity, Extra Configuration: "HubSpot Company Created Smoke". Create a company
  with C2 (in "HubSpot Company Created Smoke").
- Confirm C2's Latest Status reads Finished (the sequence stops
  follow-ups on a reply; QA, 2026-10-15).

## Mark prospect as Finished in Saleshandy

- Select this activity, Extra Configuration: "HubSpot Company Created Smoke". Create a company
  with C1 (in "HubSpot Company Created Smoke").
- Confirm C1's Latest Status reads Finished.

## Mark Prospect as Unsubscribed in Saleshandy

- Select this activity. Create a company with a new contact C3.
- Confirm C3's Latest Status reads Unsubscribed.

## Blacklist a domain in Saleshandy

- Select this activity. Create a company with C4 (in "HubSpot Company Created Smoke", Inactive;
  domain mailinator.com).
- Confirm C4's Latest Status reads Blacklisted and mailinator.com is
  on the Global Do Not Contact list.
- Then remove mailinator.com from Settings > Do Not Contact List > Global
  (Action icon, Delete Entry). The account is shared, so do not leave it
  there (QA, 2026-10-15).

## Decisions (QA, 2026-10-15)

- Workflow: Company Created (AL-4009), Properties Updated not covered.
- Scope: baseline plus one check per activity. Blacklist a domain is
  included, on mailinator.com, and the entry is removed from the Global Do
  Not Contact list afterwards.
- Account: `emailopenedprod`, with the Contact field on the production create
  company form.

## Open for QA review (my defaults, not confirmed)

- Pause delay 1 day and tag name `TagA`, as on staging.
- Add Prospect uses 2 contacts so "all associated contacts" is touched, Move
  uses 3 (C1, C2, C4: C2 is needed in the sequence for Replied, C4 for the
  Blacklist check); the other checks use 1.
- The setup spec creates the sequence with one email step and leaves it not
  activated (nothing is sent); tell me if it should be Active.
