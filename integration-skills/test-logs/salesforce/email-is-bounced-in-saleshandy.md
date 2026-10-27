# Salesforce: "Email is Bounced in Saleshandy" test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295c1` (workflow_id `65f3ef5cdc17494c670fbb54`), slug `salesforce`.
- v1 = `v1-original.json` (91 nodes, 89 edges, 55 config fields), extracted verbatim from the session transcript.
- v2 = `v2-fix-all.json` (patch `patches/v2_fix_all.py`): 76 field changes in 47 nodes, ported from Unsubscribed v2 / Link Clicked v3 / Email Sent v5 (see `.lavish/sf-bounced-v2.html`).
- Trigger: custom trigger `64647656c7f3ab6e2bf5b134` "Email is Bounced". Edge: `PATCH /sequences/{seq}/emails/status {sequenceProspectTaskIds, status:"bounced"}` (`src/sequence/sequence.controller.ts:1957`) → `setEmailProspectManuallyBounced` (`src/sequence/services/sequence-email.service.ts:752`) → one `sendIntegrationEvent(EmailBounced)` per sequence prospect task (line 984). Payload (`src/settings/integration/integration.service.ts:282`): `emailBouncedAt = actionTime`, `isManuallyBounced`, `bounceReason` only when `event.note` is set, + `prospect`, `user`, `sequence`.
  - Manual bounce passes no `note` and no `isManuallyMarked` → `bounceReason` is absent (Note/Task line "Bounce Reason" blank) and `isManuallyBounced` = false. Only a real SMTP bounce fills the reason. Observation, not a workflow bug.
  - No real email send is needed: any sequence prospect task can be marked bounced. A task can be re-marked to re-trigger.
- Config field ids (from the JSON): Actions `65eee7666b6b77ca8a186199`, Select Object `67f4c2364db5f4f586155372`, Closing date (while creating) `65eeffa6ac42f28c5e52a1df`, Opp Stage (While creating) `65f27ebc912f0b34b92dee29`, Closing date (while updating) `66056f9c3fc2e06a668f42d5`, Opp Stage (While updating) `66056fb03fc2e06a668f43ef`.

## v2 → static audit
Catalog sweep on v2: 0 open findings. No hardcoded Saleshandy URL; only Saleshandy action `get_prospect_fields` (validated). Every `Actions` compare value exists in its options. All `{{node.N…}}` refs resolve.

## v2 test matrix (one bounce = one run)
| # | Actions (+ settings) | Salesforce before | Prospect | Expected |
|---|---|---|---|---|
| B1 | create-contact, create-note | none | new P1 | 5 false → 6 Create Contact (Phone, mapping) → 40 Note on contact |
| B2 | same, bounce P1 again | contact exists | P1 | re-trigger fires; 5 true → 7 Update → 41 Note; no duplicate |
| B3 | update-contact + create-lead + create-note | contact exists | P1 | 56 true → 57 Update → 58 Note; 95 true → lead branch stops |
| B4 | create-lead + create-note | none | new P2 | 95 false → 13 false → 15 Create Lead (Company, Phone) → 89 Note |
| B5 | create-lead + update-lead + create-note | lead exists | P2 | 13 true → 16 Update → 90 Note; 67 true → 68 Update → 69 Note |
| B6 | create-opportunity + create-account + create-note (closing create 7, stage Prospecting) | none | new P3 | 21 false → 22 Contact → 25 Opp (+7d, ContactId) → 36 Note; 91 name → 31 false → 33 Account → 35 Note |
| B7 | create-opportunity + create-note, contact exists | P3 contact | P3 | 21 true → 23 Update Contact (Email filled) → 24 Opp (ContactId = existing) → 37 Note |
| B8 | update-opportunity + update-account + attach-activity [Contact, Opportunity] + create-note (closing upd 14, Qualification) | B6 records | P3 | 81 newest Opp → Qualification, +14d → 82 Note; 46 Account → 47 Note; 2 Tasks (WhoId contact, WhatId opp) |
| B9 | attach-activity [Lead] | B4 lead | P2 | 1 Task WhoId = lead, subject "Email is Bounced in Saleshandy" |
| B10 | create-contact + create-account + attach-activity, Select Object `[]`, name with apostrophe | none | new P4 | no MALFORMED_QUERY, no crash, 0 errored nodes |
| B11 | update-contact + update-lead + update-opportunity + update-account | none | new P5 | every exists-rule false, nothing created, 0 errored nodes |

## v2 live pass
Setup: reuse test sequence "SF Unsubscribed test" (numeric 196018), step `lXwAo41Ba8`, not activated (no emails sent). Runner `bounce-run.sh` (config PUT → upsert prospect into step → edge `PATCH /sequences/196018/emails/status` → bounded read-only poll of executions).

| # | Run | Result | Evidence |
|---|---|---|---|
| B1 | `6ac5e6af27142f792c487ff2` (prospect 66489092, spt 98647900) | PASS | Path 5 → 6 → 40, other action rules false. SF Contact `003dL00002dX5XhQAK`: Bea SFBounceB1, Email, Phone 9999940001 (phoneNumber fix), Title QA, MobilePhone via mapping. Note "email-bounced" on the contact. Bounce Reason / Sender Email blank = manual bounce + sequence never sent (expected). |

## v3 — `v3-notes-title.json` (patch: `../../patches-shared/static_values.py`, user decision 2026-10-12)
From `v2-fix-all.json`. User rule: as few fixed values as possible — an unmapped field stays untouched, a mapped field comes from the mapping everywhere; Notes only when "Create Note" is selected, on the record the branch created/updated.
- Changed: nodes 6, 7, 22, 23, 57 → Title "" (was `{{prospect.jobTitle}}`); Note 36 ParentId → `{{node.25.body.id}}`, Note 37 → `{{node.24.body.id}}` (Opportunity, was the Contact); config `Actions` += `create-note`.
- Why `""` is safe: the connector does not send empty strings (Email Sent S3), so Title / Opportunity Name stay as they are in Salesforce unless mapped; a mapping still wins through `additional_fields` (Email Sent V3-S6/S7).
- Self-check: only these fields changed and the Actions option list; nodes/edges/other config identical. Catalog re-scan: no new findings.
- Not live-tested yet.

### v3 live test plan (2026-10-12, user go-ahead)
Live definition == v3 nodes (GET /workflow, org key). **Import did not update the Actions option list** (live Actions has no `create-note`, catalog #54 recurrence → PLATFORM); tests set Actions via the config API.
| # | Mapping | Actions | Setup | Expected |
|---|---|---|---|---|
| B1 | Job Title mapped | create-contact, create-note | Contact exists, Title "Old B1"; prospect Job Title "Mapped B1" | 5 true → 7 Update, Title = "Mapped B1" (mapping), Note 41 on Contact |
| B2 | mapped | create-opportunity, create-note (close 7, Prospecting) | new person | 22 Contact → 25 Opp → **Note 36 on the Opportunity** |
| B3 | mapped | same | Contact exists (B2 again) | 23 → 24 Opp → **Note 37 on the Opportunity** |
| B4 | mapped | create-contact only | new person | Contact, **no Note** |
| B5 | Job Title **unmapped** | create-contact | Contact exists, Title "Keep B5"; Job Title "Ignored B5" | **Title stays "Keep B5"** |

## v4 — `v4-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v3-notes-title.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.
