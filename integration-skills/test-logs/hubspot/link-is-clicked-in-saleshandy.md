# HubSpot — Link is Clicked in Saleshandy (staging)

- Direction **SH → CRM**. Workflow `681368981acc0cbcd16295ab`, slug `hubspot`, linked account 80121.
- `v1-original.json` = `integration-jsons/link-is-clicked-in-saleshandy-latest-assoc-fixed.json`; `v1-live-fetch.json` (`GET /workflow/<id>`, 2026-10-13, updated 2026-10-02) is identical: 93 nodes / 92 edges, all `input_data` equal.
- Tickets: AL-4120, AL-4121, AL-4122, AL-4123.
- Config at 2026-10-13: workflow enabled, every workflow field `null`. App mapping: only Deal Properties `{annualRevenue: amount}`.
  Other SH→CRM HubSpot workflows disabled (Email Opened off, so a click's implicit open does not race).

## v1 → audit (offline)

| # | Ticket | Tag | Finding |
|---|---|---|---|
| A1 | AL-4120 | JSON | All 9 `create_note` bodies use `{{event.body.sequence.clickCount}}`; trigger schema + edge (`integration.service.ts:293`) put it at `event.body.clickCount` → blank line. |
| A2 | AL-4121 | JSON | `107 Create Deal (fallback, new contact)` has no outgoing edges. Existing-contact sibling `3` → `53/54` → `55` note / `56` log email. New-contact deal path never reaches note/log. |
| A3 | AL-4122 | JSON | Same as A2 (log email). |
| A4 | AL-4123 | JSON | Every `log_email` node sets only `deal_id`/`contact_id` and no `hs_email_headers` (e.g. `86` on update-deal: `contact_id:""`). Email Sent fixed this (AL-4102) with raw `POST /crm/v3/objects/emails` + `hs_email_headers` (from sender, to prospect) — nodes 80/84/88. |
| A5 | — | JSON | Sibling of A2: `114 Create Company (fallback, new contact)` also has no outgoing edges → no note/log on new-contact company path. Not ticketed. |

## Scenario matrix (live)

| # | Actions | HubSpot setup | Expected (fixed behaviour) | Ticket |
|---|---|---|---|---|
| L1 | create-deal + create-note + record-email-activity | contact missing | 106 contact → 107 deal → note + logged email on contact + deal, Click Count filled | AL-4121, AL-4122, AL-4120 |
| L2 | update-deal + create-note + record-email-activity | contact exists with deals | 25 updates latest deal → note (Click Count) + logged email showing prospect, not "Unknown Contact" | AL-4123, AL-4120 |

## v2 — `v2-note-log-blocks.json` (patch `patches/v2_note_log_blocks.py`, base v1)
User decision 2026-10-13: keep the existing "after create/update → create-note? / record-email-activity? → note / log" pattern; just add it where missing. No rebuild.
- `107 Create Deal (fallback, new contact)` → +121 `create-note?` → +123 note, +122 `record-email-activity?` → +124 log; contact `node.106.body.id` + deal `node.107.body.id` (copies of 53/54/55/56). AL-4121, AL-4122.
- `114 Create Company (fallback, new contact)` → +125/+127 note, +126/+128 log; contact `node.113.body.id` + company `node.114.body.id` (copies of 65/66/67/68). A5.
- All 9 `log_email` nodes: `additional_fields = {hs_email_headers: {"from":{"email":sender},"to":[{"email":prospect}]}}` (same field Reply Received uses on `log_email`). AL-4123.
- Contact added to existing-contact deal/company notes+logs: 55/56 `node.104…`, 85/86 `node.117…`, 67/68 `node.111…` (Email Sent parity).
- All 11 notes: `{{event.body.sequence.clickCount}}` → `{{event.body.clickCount}}`. AL-4120.
Checks (in the script): 101 nodes / 100 edges (+8/+8); untouched nodes + top level byte-identical; incoming/outgoing == edges; every `node.X` read is an ancestor; headers parse as JSON; no `sequence.clickCount` left.

## v2 live run (imported 2026-10-13 09:18 UTC; `v2-live-fetch.json` == `v2-note-log-blocks.json`)
Setup: sequence 196553 (`XdPdbvnxzV`), step `8Jwobjy2zO` (2 links), track link clicks on (code 4), open tracking off, active. Settings in `~/.config/sh-integration-testing/wf-hubspot-link-clicked.env`; send via `send-for-click.sh`. Config: pipeline `default`, stage `4274252495`, newbusiness/high, close 1 (create) / 0 (update), Lead Status NEW, Lifecycle lead. No HUBSPOT_TOKEN → verified from node responses.
- L1 sent 09:21:47 UTC to `rudra+hs-lc-l1@saleshandy.com` (task 98655331), actions create-deal + create-note + record-email-activity. Waiting for click.
- L1 (v2) not clicked — superseded by v3 before the click.

## v3 — `v3-email-sent-copy.json` (patch `patches/v3_email_sent_copy.py`; supersedes v2)
User decision 2026-10-13: Link Clicked must be the same as Email Sent; only the link and click count are extra.
Base graph = live Email Sent `681368981acc0cbcd162959c` (`email-sent-live.json`, == saved latest-assoc-fixed, updated 2026-10-02). Top level + start trigger (`646473d5c7f3ab6e2bf5b10f`) = Link Clicked v1.
- `{{event.body.emailSentAt}}` → `{{event.body.linkClickedAt}}` (20).
- 11 notes: Email Sent text + `Link URL: {{event.body.link}}` + `Click Count: {{event.body.clickCount}}`.
- 9 email logs (`POST /crm/v3/objects/emails`, headers, associations as Email Sent): subject `Link is clicked - Saleshandy`.
Checks: 114 nodes / 113 edges, same ids + edges as Email Sent; every other node == Email Sent with only the time swapped; top level == LC v1; every `node.X` read upstream; every `workflow.fields.*` exists in LC config_fields.

## AL-4127 — Update a Company: Success, City/State not updated (2026-10-14)
Ticket: "Update a Company in HubSpot" only, contact with 1 or 2 associated companies (no City/State), prospect City/State changed in SH, click → log Success, company City stays "--" (records 351264728764, 351264728787). Seen 2026-10-13, staging sequence 196221. Siblings: AL-4125 (Bounced), AL-4126 (Opened, PASS T6 on 10-14).
User pasted the live definition 2026-10-14 → `integration-jsons/link-is-clicked-in-saleshandy-al4127-current.json` = **v3** (all `input_data`/edges equal; only runtime fields `parsed_response`, `status`, ... differ).

### Analysis (offline)
- v3 `10 Update Company` = Email Sent 10: `companyId (156), name, domain, additional_fields (152 Company Properties mapping)`; reached via 15 → 153 → 154 → 155 (associated companies, createdate DESC, limit 1) → 156 → 12 → 151 → 152. Same as Opened v2, which passed AL-4126 (T6, 10-14: city Ahmedabad written).
- v1 `10` sent `industry/phone/city/state = ""` next to the mapping, which blanks mapped City/State (same as Opened O3).
- Edge payload is not the difference: `integration.service.ts preparePayload → prepareProspectPayloadForEvent` reads the prospect live for every trigger.
- Cause depends on when QA clicked (not known offline):
  - before 2026-10-13 09:40 UTC (v3 import) → v1 blank `city/state` keys;
  - after → v3 is correct, but the 10-13 app mapping had **only Deal Properties** `{annualRevenue: amount}`. Empty Company Properties → 152 = `{}` → 10 writes only name/domain → Success, City unchanged. Opened T6 also showed State stays empty when only `city` is mapped.
- To close: read the AL-4127 execution (node 152 output / node 10 request) and the Company Properties mapping at that time.

### v4 — `v4-al4127-mapping-fixes.json` (patch `patches/v4_al4127_mapping_fixes.py`, base v3)
`10` unchanged. Mapping/data gaps inherited from Email Sent:
- +157 strip `hs_email_domain` 121 → 157 → 20; 20 and 55 `additional_fields` = `node.157.body.result` (was raw `node.121.body`).
- +158 strip `hs_email_domain` 123 → 158 → 52; 52 = `node.158.body.result`. (Copies of 126/129/134; HubSpot rejects the whole write when the read-only field is mapped.) 44 `optional_fields` += `additional_fields`.
- 89 note `contact_id`: `node.92.body.contactID` (no such path) → `node.92.body.result.contactID` (as 45).
- 56/57/92: `allContact[$lowercase(properties.email)=$lowercase("{{prospect.email}}")][0].id` (was case-sensitive; 2 matches → array). jsonata 2.0.5: mixed case → id, 2 matches → first, 0 → `{}`.
- 17/41/49: dropped `base_url: https://api.hubapi.com` (as 63/102/155).
- 11 notes: `{{sequence.id}}\n/steps` → `/steps`; `<b>Title: <b>` → `<b>Title: </b>`. 77: duplicate Action6 condition removed.
Checks (in script): 116 nodes / 115 edges (+2/+2); top level == v3; untouched nodes == v3; `10` == v3; in/out == edges; every `node.X` read upstream; every `workflow.fields.*` in config; no hubapi host / broken link / bad path left.
Copied to `integration-jsons/link-is-clicked-in-saleshandy-al4127-fixed.json`.
Not changed (needs decision): create deal/company/task run on every click (duplicates); rules 12/19/24/111/154 no false branch (silent Success); IST +5:30 in 93/97/98.

### Live test plan — v4 (not run)
Prospects `rudra+hs-lc-<id>@saleshandy.com`; click = real click on the sent email (`send-for-click.sh`). **Before running: Company Properties mapping must include `city` and `state`** (Contact Properties: map one field + `hs_email_domain` for C2).

| # | Ticket / fix | Config | HubSpot setup | Expected |
|---|---|---|---|---|
| C1 | AL-4127 main | update-company | contact + 1 associated company (name, domain, no City/State); prospect City/State set | company City + State/Region = prospect values; log Success |
| C2 | AL-4127 2 companies | update-company | contact + 2 associated companies | only newest company updated, older unchanged |
| C3 | AL-4127 values changed | C1 contact; change prospect City/State, click again | — | new City/State |
| C4 | v4 strip (157) | update-contact; Contact Properties incl. `hs_email_domain` | contact exists | 20 + 55 200, mapped fields written (v3: 400) |
| C5 | v4 case match (57) | update-contact | HubSpot email lowercase, SH prospect mixed case | 19 true → contact updated (v3: no update) |
| C6 | v4 note 89 | create-task | contact exists | task + note on the contact |
| C7 | v4 strip (158) | create-task; mapping incl. `hs_email_domain` | contact missing | 52 contact created → 90 task → 91 note |

## v5 — `v5-log-contact-link.json` (patch `patches/v5_log_contact_link.py`, base = v4 = live staging 2026-10-14 06:20, checked 2026-10-15)
**Problem (plain words):** with "Record (log) an Email Activity" plus Update Deal, Update Company, or Create Company (when a new contact has to be created), the logged email shows on the deal/company as **"Unknown Contact"**.
**Why:** those 3 log-email steps attach the email only to the deal or company, never to the contact. HubSpot takes the person's name from the attached contact. The contact was already found/created earlier on the same path; it just wasn't passed to the log step.
**Change:** one extra entry in the `associations` list (`associationTypeId: 198`, email → contact) of the `POST /crm/v3/objects/emails` body:

| Node | When it runs | Contact it now uses |
|---|---|---|
| 88 | Update Deal + log email | node 110 Search Contact by Email (`results.0.id`) |
| 80 | Update Company + log email | node 153 Search Contact by Email (update company) |
| 146 | Create Company, new contact + log email | node 141 Get contactID (`result.contactID`) |

Same fix as Email is Bounced v3, which passed live (real bounce, run `6ad06d776e7ef68d28016f78`: emails linked to the contact).
Node 89 (note after task) was already fixed in v4 — not touched.
Checks (offline, in the script + after): only nodes 80, 88, 146 differ from v4; subject/body/headers/timestamp and the existing deal/company link unchanged; 116 nodes / edges / top level identical; each contact source runs earlier on the same path; all log-email nodes now link a contact; bodies valid JSON.
Retest: click with Update Deal + Record Email Activity → HubSpot timeline shows the prospect's name (contact → emails includes the new email).

## AL-4130 — logged email shows on older deals (live repro 2026-10-15, account 80121, portal 247320744, live = v5)
Setup: Action1 `["update-deal","record-email-activity"]` (Action2/3 cleared), Email Opened disabled during the test (re-enabled after).
HubSpot contact 570396007157 `rudra+hs-lc-al4130@saleshandy.com`; deals Oldest 354909465281 / Middle 354920210158 / Latest 354493084388 (5 s apart, 0 emails each).
"Import Prospects from Hubspot" (enabled) auto-added the contact to step `8Jwobjy2zO`; sequence resumed, sent 11:34:26 UTC (task 98783108), open + click tracking on.
One user click → 4 Link Clicked runs (6ad0baf5047637b276c56579, 6ad0baf567ee0feb461107a9, 6ad0bb005323e4f643baf8cb, 6ad0bb07047637b276c569e3), all COMPLETED.
- Every run: 112 → Latest, 25 updates Latest, **88 request associations = contact (198) + Latest (210) only**; 201, email ids 407491198672 / 407465543359 / 407465543366 / 407505406651.
- HubSpot afterwards: all 4 emails on **Oldest, Middle and Latest** (typeId 209) + contact. **Reproduced.**
- Probes (`runs/20261015-AL4130-P-*`): E1 email created with contact only → on all 3 deals. E2 created with Latest only, contact added after via `PUT /crm/v4/objects/emails/{id}/associations/default/contacts/{cid}` → Latest only + contact. E3 created with contact + Latest, then `POST /crm/v4/associations/emails/deals/batch/archive` Oldest/Middle → Latest only, stable after 75 s.
**Root cause [CRM behaviour, triggered by JSON]:** HubSpot auto-associates an email to all of the contact's deals when the contact association is in the *create* request. v5 (AL-4123) put the contact in the create body of 88 (and 63/109/80/140/146 already had it). Adding the contact in a second call does not fan out.
