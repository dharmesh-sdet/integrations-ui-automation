# HubSpot: "Prospect Outcome is updated in Saleshandy" test log

- Direction **SH → CRM**. Trigger: Saleshandy custom trigger `6464782cc7f3ab6e2bf5b1b2` (Prospect Outcome Updated), export_id `681368981acc0cbcd16295b0`, slug `hubspot`, env test (staging).
- Trigger route: edge `PATCH /sequences/{numericSeqId}/outcome {prospectId, outcomeId}` (`src/sequence/sequence.controller.ts:2628`). The event only fires when the prospect has a sent sequence task. The Open API outcome route does not reach Refold (SH-20244).
- Scope (user, 2026-10-06): **only AL-4107, AL-4109, AL-4110**, plus regression of the paths the fix touched.

## v1 → audit
Done in `integration-enhance` (report `.lavish/al-4107-4109-4110-prospect-outcome-hubspot.html`). Ticket root causes:
- AL-4107: fallback `create_contact` 117 (create-deal) / 123 (create-company) has no `additional_fields`, no Contact Properties mapping.
- AL-4109 / AL-4110: update-company node 9 searches companies by `name EQ prospect.company` (the value being written) → 0 results → rule 12 false → silent Success.
- Out of scope, report only: Log Email rules compare `create-note`; outcome gates #52 / node 98 `eq null`; node 68 `deal_id` = contact id; node 91 wrong outcome paths; 45/46 `prospect.phone`; date-only close/due dates; update-deal oldest by name; fallback creates have no note/log; 59/60 notes without contact; 80/81 read node 10 (not upstream).

## v2 — `v2-al4107-al4109-fix.json` (patch: `patches/apply_prospect_outcome_al4107_al4109.py`)
- +135 Mapping Function (Contact Properties, shFields node 113) → 117 `additional_fields: {{node.135.body}}`; 116 false → 135.
- +136 Mapping Function (Contact Properties, shFields node 119) → 123 `additional_fields: {{node.136.body}}`; 122 false → 136.
- +137 search_contacts by email, +138 rule exists AND email eq (copies of Email Sent 153/154); 15 true → 137 → 138 → 9.
- 9 body = companies search `associations.contact EQ {{node.137.body.results.0.id}}`, createdate DESC, limit 1 (copy of Email Sent 155). 52 = `{"companyID": allOrganisation.results[0].id}` over `{{node.9.body}}` (Email Sent 156).
- Self-checks passed: 109 nodes / 108 edges, top-level keys identical, only 116/117/122/123/15/9/52 changed in the listed keys.

## Scenario matrix (v2, one action group per run)
| # | Ticket | Actions / gate | Setup in HubSpot | Expected |
|---|---|---|---|---|
| T1 | AL-4107 | create-deal, deal gate = Uncategorized | contact does NOT exist | 116 false → 135 → 117 contact has every mapped contact property; 118 deal created + associated |
| T2 | AL-4107 (comment) | create-company, company gate = Interested | contact does NOT exist | 122 false → 136 → 123 contact has mapped properties; 124 company created + associated |
| T3 | AL-4109 | update-company, gate = Meeting Booked | contact exists, 1 associated company with no name | 137 → 138 true → 9 finds the company → 52 → 12 true → 10 updates name/domain/mapped props |
| T4 | AL-4110 | update-company, gate = Meeting Booked | contact exists, Company 1 created first, Company 2 created later, both associated | Company 2 updated, Company 1 unchanged |
| R1 | regression 116 | create-deal | contact exists | 116 true → 3 deal created + note (unchanged path) |
| R2 | regression 138 | update-company | contact does NOT exist | 138 false → branch stops, nothing updated, no error |

## v3 — `v3-gate-task-notes.json` (patch: `patches/v3_gate_task_notes.py`, on top of v2)
Bug (user report, 2026-10-06): selecting create-task always creates a note on the contact. Root cause (pre-existing in v1): notes 91/94 are wired directly after create_task 90/93 with no "create-note" rule; every other branch gates its note behind a create-note rule (57/62/66/70/74/78/82). Same shape in Email Sent / Link Clicked HubSpot workflows (not changed).
- +139 rule (copy of rule 57) between 90 → 91; +140 rule (copy of rule 57) between 93 → 94. Edges 90→91 / 93→94 retargeted (ids kept), new 139→91 / 140→94 (true).
- 91 `hs_note_body`: `sequence.previousOutcome` → `oldOutcome`, `sequence.isManuallyChanged` → `isManuallyChanged` (now identical to node 94).
- Self-checks passed: 111 nodes / 110 edges; only 90/91/93/94 changed (wiring + 91 note body); 139/140 identical to rule 57 except id/name/wiring/position; top-level keys identical.

### Added scenarios
| # | Actions | Setup | Expected |
|---|---|---|---|
| T5 | create-task only | contact exists | task created on contact, **no note** (139 false) |
| T6 | create-task + create-note | contact exists | task + one note on contact, note shows Previous Outcome + Manually changed |

## v4 — `v4-note-log-like-email-sent.json` (patch: `patches/v4_note_log_like_email_sent.py`, on top of v3)
User: "note and log flow must be the same as Email Sent from Saleshandy". Reference `integration-jsons/email-sent-from-saleshandy-latest-assoc-fixed.json`: after every created/updated record → rule `create-note` → note, and rule `record-email-activity` → email log, attached to every record the branch has.
- Log Email rules 58/63/67/71/75/79/83: `create-note` → `record-email-activity` (webui offers it for this trigger: `saleshandy-webui/.../triggers-and-activity/utils/helper.ts:13,170`).
- 59/60 + `contact_id {{node.115.body.results.0.id}}`; 72/73 + `contact_id {{node.121.body.results.0.id}}`; 68 `deal_id` "" (was contact id); 80/81 `contact_id {{node.46.body.id}}`, `company_id` "" (was node 10, never runs there).
- New after 118 (create-deal, new contact): 141 note rule → 143 note, 142 log rule → 144 log (contact 117 + deal 118, time node 61).
- New after 124 (create-company, new contact): 145 date transform (copy of 103) → 146 → 148 note, 147 → 149 log (contact 123 + company 124).
- Log nodes keep the connector `log_email` action (escapes HTML), not Email Sent's raw `POST /crm/v3/objects/emails`.
- Not changed: update-deal 84/85 deal only (branch has no contact lookup); update-company 76/77 company only (same as Email Sent 79/80); task notes 91/94 (v3).
- Self-checks passed: 120 nodes / 119 edges, all original edges unchanged, top-level keys identical, only listed nodes/fields changed, no node reads a node that isn't upstream (80/81 → 10 gone).

### Added scenarios
| # | Actions | Setup | Expected |
|---|---|---|---|
| N1 | create-deal + create-note | contact new | deal + note on contact AND deal (143), no email log |
| N2 | create-deal + record-email-activity | contact exists | deal + email log on contact AND deal (60), no note |
| N3 | create-contact + create-note | contact new | note on contact only (68), no deal link error |
| N4 | update-contact + create-note + record-email-activity | contact exists | note + log on the contact (80/81) |
| N5 | create-company + create-note | contact new | company + note on contact AND company (148) |

## Live run on v4 (staging, account 80121, portal 247320744). Scope (user): AL-4107, AL-4109, AL-4110 only
Setup: sequence 195954 (`eMPkeLDGzQ`), step `eMPk2WLdwQ`, settings in `~/.config/sh-integration-testing/wf-hubspot-prospect-outcome.env`. HubSpot token read from `refold-qa-automation/.env` (`HUBSPOT_ACCESS_TOKEN`, emails scope 403).

| # | Run | Result | Evidence |
|---|---|---|---|
| T1 | 6ac4df54a2ad7db18e6afc1c | Path PASS: 41 true → 2 → … → 116 false → **135** → 117 (`additional_fields` present) → 118 deal 353141258972 linked to contact 564781246190. Mapping not verifiable: **setup gap** — `fieldMapping` absent in both 135 and the untouched 114 (`{{application.fields.Contact/Deal Properties}}` not saved for HubSpot on 80121, catalog #31), so both returned `{}` | `runs/20261006T114359-T1-nodes-…json`, `runs/T1-hubspot-contact.json` |

## v5 — `v5-email-sent-parity.json` (= `integration-jsons/prospect-outcome-updated-hubspot-v3.json`; patches `patches/v5a_email_sent_parity.py` + `patches/v5b_email_sent_parity_logs.py`, on top of v4 = the user's 2026-10-07 paste, nodes identical)
User (2026-10-07): create-company with a missing contact never creates the contact; update paths act on the earliest record; make everything work like Email Sent from Saleshandy.
- v5a: removed merge transforms 125/126 (unquoted `{{mapping}}` inside `$merge`); +150/152 build deal body, +153/155 build company body (Email Sent 147/148, Email Opened 122/126) → 3/118/7/124 body `{{node.<build>.body.result}}`; +151/154/156/157/158 strip `hs_email_domain` before 117/123/5/45/92 (Email Sent 126/129/134); 92 lifecycle/lead status from config (was literal `""`); update-deal +159 search contact, +160 rule, 22 = deals search `associations.contact` DESC limit 1, 51 `allDeals.results[0].id` (Email Sent 110–113); 56/108/95 dates `T12:00:00.000Z`; gate 98 `eq null` → `is_null`. 129 nodes / 128 edges.
- v5b: 9 email logs (60 65 69 73 77 81 85 144 149) connector `log_email` → `POST /crm/v3/objects/emails` with Email Sent properties/headers + associations (contact 198, company 186, deal 210, same records as before); note 84 + contact 159; notes 59/84/143 `optional_fields: [contact_id]`; 45/46 drop `phone` (#48); tasks 90/93 `NOT_STARTED`; rule 89 + email eq.
- Offline: structural self-checks in both patch scripts; all new JSONata run on sample data (jsonata 2.0.6).

### Scenario matrix (v5) — one action group per run, prospect `rudra+hs-po5-<sc>@saleshandy.com`
| # | Actions (+ create-note, record-email-activity) | Gate set to the outcome used | HubSpot setup | Expected |
|---|---|---|---|---|
| S1 | create-company | company create | contact does NOT exist | 154 strip → 123 contact created → 155 → 124 company linked (280) → 148 note + 149 email on contact+company |
| S2 | create-company | company create | contact exists | 153 → 7 company linked to existing contact → 72 note + 73 email |
| S3 | create-deal | deal create | contact does NOT exist | 151 → 117 contact → 152 → 118 deal linked (3), closedate T12 → 143 note + 144 email on contact+deal |
| S4 | create-deal | deal create | contact exists | 150 → 3 deal linked → 59 note + 60 email |
| S5 | update-deal | deal update | contact with 2 deals (older, newer) | 159 → 160 → 22 returns the NEWER deal → 25 updates it, older unchanged → 84 note on deal+contact, 85 email on deal |
| S6 | update-company | company update | contact with 2 companies | newer company updated → 76 note, 77 email on company |
| S7 | create-contact | contact create | contact does NOT exist / exists | 156 → 5 created → 68/69; existing → 157 → 45 updated → 64/65 |
| S8 | update-contact | contact update | contact exists | 46 updated (no phone key) → 80/81 |
| S9 | create-task (+ create-note) | task create | contact exists / does NOT exist | 89 true → 90 NOT_STARTED + 91; missing → 158 → 92 → 93 + 94 |
| S10 | update-company only, gate 98 empty | — | contact with company | 98 `is_null` passes (or #52: Refold drops the slot → no run) |
Known limits: field mappings (`application.fields.*`) not saved for HubSpot on 80121 (v4 T1 setup gap) → mapping nodes return `{}`, so the `hs_email_domain` rejection itself can't be reproduced until a Contact Properties mapping with Email Domain is saved. HubSpot token has no `emails` read scope → email logs verified from the node response (201 + id + associations) only.

### Live run on v5 (staging, 2026-10-07; deployed version confirmed by new node ids 155/150/159 in the logs)
| # | Run | Result | Evidence |
|---|---|---|---|
| S1 create-company, contact missing | 6ac5e08327142f792c45dbc9 | **PASS** 121 0 results → 122 false → 136 → 154 → **123 contact 565228397271 created** → 155 → 124 company 351296561884 (PO5 S1 Co) linked → 148 note + 149 email on contact AND company (HubSpot reads) | `runs/*-S1-nodes-*.json`, `runs/S1-hubspot-*.json` |
| S3 create-deal, contact missing | 6ac5e0dae7104b6dc374f25c | **PASS** 116 false → 151 → 117 contact 565238446805 → 152 → 118 deal 353213568750 linked (3), closedate `2026-10-14T12:00:00Z` → 143 note + 144 email | `runs/*-S3-nodes-*.json` |
| S4 create-deal, contact exists | 6ac5e0fe4f2e43a722978e33 | **PASS** 116 true → 150 → 3 deal 353199180530 (newer) linked → 59 note + 60 email | `runs/*-S4-nodes-*.json` |
| S5 update-deal, 2 deals | 6ac5e12ae7104b6dc37519f2 | **PASS** 159 → 160 → 22 returned 353199180530 (newest) → 51 → 25 updated it → 84 note on deal AND contact, 85 email on deal. Older deal 353213568750 not updated by the workflow | `runs/*-S5-nodes-*.json`, `runs/S5-deals-*.json` |
| S9 create-task, contact missing | 6ac5e17927142f792c462018 | **SETUP GAP**: 92 contact created (lifecycle from config, no `""` error); 93 VALIDATION_ERROR `hs_timestamp` because "Due In" was not configured (95 skipped by its node_rule, same as Email Sent 93) | `runs/*-S9-nodes-*.json` |
| S9b same, Due In = 3, Task Title set | 6ac5e1ac6cadcd097bd40332 | **PASS** 158 → 92 contact 565358346986 (lifecycle lead) → 93 task 405545007845 `NOT_STARTED`, due `2026-10-10T12:00:00Z`, on the contact → 140 → 94 note | `runs/*-S9b-nodes-*.json` |
Observations (not bugs): HubSpot auto-associates an email logged on a contact with that contact's other open deals (S4 email 405464449759 also shows on the older deal) — portal behaviour. With no mapping saved, the strip nodes output `null` and create_contact still succeeds.
Config left on the staging workflow after the run: Action1 `create-task`, Action2 `create-note`, Action3 `record-email-activity`, Action4–11 empty, gates: company create Interested, deal create Meeting Booked, deal update Not Now, task create Interested; Due In 3; Task Title "PO5 follow-up task".
