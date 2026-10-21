# Reply is Received in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). Account:
`sfreplyreceived`, Salesforce connected to the shared dev org
(saleshandy-dev-ed). This workflow has no Jira tickets, so Ticket is None for
every row. Scope is the trigger "Reply is Received in Saleshandy" with the
single activity "Create a Lead in Salesforce", plus 3 baseline rows. Create a
Lead has no Extra Configuration modal.

Rows marked "(proposed, unconfirmed)" (Create a Lead 4 to 11) have an Expected
that is not documented. Run them and record what really happens; a different
result is not automatically a failure. The Lead is always verified in
Salesforce itself, because a Success row in Logs does not prove the Lead
exists.

Not covered, still open: none known. Other triggers and activities are out of
scope.

## Test data setup

- Field mapping (Settings > Integrations > Salesforce > Field Mapping > Lead
  Properties) is saved before the scenarios: Last Name, First Name, Email,
  Phone Number, Job Title, Company, City to the matching Salesforce Lead
  properties (Last Name, First Name, Email, Phone, Title, Company, City).
  Nothing was mapped on this account before.
- In Settings > Integrations > Salesforce > Triggers & Activity, turn every
  other trigger off and enable only "Reply is Received in Saleshandy" with
  only "Create a Lead in Salesforce" selected. Save. The Salesforce success
  message text was not seen (HubSpot shows "Configuration Updated
  Successfully"; the same is expected, unconfirmed).
- Each row uses its own brand-new prospect (unique name and email, unique
  prefix per run), not in Salesforce, added to a launched sequence with Add
  Prospects (one at a time). Wait until step 1 shows Sent. Created data
  stays (KEEP_TEST_DATA=1) and existing Salesforce records are never edited.
  The prospect CSV does not exist yet.
- "Mark as Replied" means: Emails tab > the prospect's row > three dots >
  "Mark as replied". Not seen on this account yet (the sequence was a draft
  with no prospects), so the exact label and path are unconfirmed.
- Logs: Settings > Integrations > Salesforce > Logs. Refresh 15 s after Mark
  as Replied, then every 10 s, up to 3 min. Entries are not opened. The Logs
  row layout and workflow name for this trigger were not seen (the Logs tab
  was empty).
- Verify in Salesforce: Leads tab, find the Lead by the unique email or last
  name. Lead list columns: Name, Title, Company, Phone, Mobile, Email, Lead
  Status, Owner Alias. Required on the New Lead form: Last Name, Company,
  Lead Status.
- Lead Status picklist in the org: --None--, Open - Not Contacted, Working -
  Contacted, Closed - Converted, Closed - Not Converted. Default is Open - Not
  Contacted.
- Sender email "Salesforce Testing": 40 to 50 s between emails, daily limit
  150. No change needed.
- Run order (QA, 2026-10-16): Create a Lead 7 runs first, while the mapping is
  still empty, before Trigger behavior row 3 saves the 7 fields. Rows that
  change the Lead Properties mapping afterwards (Create a Lead 8 and 13) run
  last, so the other rows never see a half-mapped state.
- Create a Lead 4 (QA, 2026-10-16): check the not-mapped case only (Lead
  Status = "Open - Not Contacted"). The mapped-Status part is added once QA
  names the Saleshandy field.
- Create a Lead 9 and 10 (QA, 2026-10-16): run them and record what happens;
  the org duplicate rule was not read.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off, activity list unopened | Turn on "Reply is Received in Saleshandy", open activity dropdown, choose "Create a Lead in Salesforce", click the chip (do not Save) | Dropdown lists 10 activities (Create/Update Account, Contact, Lead, Opportunity, Attach Note, Record(log) Email Activity). "Create a Lead in Salesforce" appears as a chip with x. No Extra Configuration modal opens | None |
| 2 | All other triggers off, only "Create a Lead in Salesforce" selected | Turn on "Reply is Received in Saleshandy", click Save | Success message shown. After reload, toggle is on and "Create a Lead in Salesforce" chip persists | None |
| 3 | Lead Properties mapping empty (Save disabled) | Map Last Name, First Name, Email, Phone Number, Job Title, Company, City to their Salesforce counterparts, click Save, reload | 44 Saleshandy fields listed. Mapping saved and persists after reload | None |

## Create a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect (First Name, Last Name, Email, Phone, Job Title, Company, City filled), not in Salesforce | Mark as Replied | Success within 3 min. Exactly one Lead with Last Name, First Name, Email, Phone, Title, Company, City matching prospect values | None |
| 2 | Prospect has Department, Industry, Website filled (unmapped) | Mark as Replied | Success. Lead has no values for unmapped fields (Industry, Website empty) | None |
| 3 | Trigger turned off and saved | Mark as Replied | No Logs row after 3 min. No Lead in Salesforce | None |
| 4 | Lead Status unmapped; then mapped to "Working - Contacted" | Mark as Replied (each state) | (proposed, unconfirmed) Unmapped: Lead Status = "Open - Not Contacted" (Salesforce default). Mapped: Lead Status = "Working - Contacted" | None |
| 5 | New prospect, Lead created | Mark as Replied, open Lead in Salesforce | (proposed, unconfirmed) Lead Owner = connected Salesforce user | None |
| 6 | Company mapped, prospect Company empty | Mark as Replied | (proposed, unconfirmed) Logs shows Error, or a default Company is used. Record actual result | None |
| 7 | Lead Properties mapping empty, trigger on | Mark as Replied | Success. Exactly one Lead with Salesforce defaults (Lead Status "Open - Not Contacted", Company "HubSpot", Owner Alias "ChintanS") (QA, 2026-10-16) | None |
| 8 | Only Last Name and Email mapped (Company unmapped), prospect has Company | Mark as Replied | (proposed, unconfirmed) No Lead created (Company required), Logs shows Error | None |
| 9 | Same prospect as row 1 | Mark as Replied again | (proposed, unconfirmed) No duplicate Lead: still exactly one Lead for the email. Org duplicate rule unread. Record actual result | None |
| 10 | Lead with same email exists (from row 1) | Add second prospect with same email, Mark as Replied | (proposed, unconfirmed) No duplicate Lead; existing Lead updated or unchanged | None |
| 11 | Contact with same email exists (e.g. converted Lead) | Mark as Replied | (proposed, unconfirmed) No new Lead created | None |
| 12 | First name has accent, last name has apostrophe, 60-char company name | Mark as Replied | Success. Lead shows exact values. If Salesforce rejects, record Logs status and confirm no Lead exists | None |
| 13 | Row 1 passed, Job Title mapping changed from Title to Description | Mark as Replied (new prospect) | New Lead has Job Title in Description, Title empty. Row 1 Lead unchanged | None |
