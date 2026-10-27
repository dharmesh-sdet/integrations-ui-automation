# HubSpot: "Prospect is Unsubscribed in Saleshandy" (staging)

- Direction **SH → CRM**. Export `681368981acc0cbcd16295ac`, slug `hubspot`, trigger `646474e0c7f3ab6e2bf5b127`.
- `v1-original.json` = definition the user pasted on 2026-10-19 (90 nodes / 89 edges).
- Tickets: AL-4015 (parent, In QA) → AL-4162, AL-4163, AL-4164, AL-4165.
- Reference = released Email Bounced v4 (`../email-bounced-in-saleshandy/v4-note89-contact-path.json`, the live Email Sent graph) + Link Clicked v5 / Reply Received v5 / Prospect Outcome v5 fixes.

## v1 → audit (offline)

### Ticketed
- **U1 [JSON] AL-4165 update-deal updates the oldest deal.** 21 → 22 `deals/search dealname EQ "<first> <last>"`, `sorts:["createdate"]` (ascending), limit 100 → 92 returns the first exact name match = oldest. A deal with any other name is never found (24 false, silent Success). Released: 110 search contact → 111 → 112 `associations.contact EQ id`, createdate DESCENDING, limit 1 → 113 → 24/25. (AL-4119 / AL-4103 / AL-4128 class, catalog #36/#44.)
- **U2 [JSON] AL-4163 update-company: Success, City/State unchanged.** (a) 15 → 9 `companies/search name EQ prospect.company`, oldest first → 91 exact-name loop: finds a company by name, not the contact's company; name mismatch → 12 false → Success with nothing written; 2+ same name → oldest. (b) 10 sends `industry/phone/city/state = ""` next to the mapped `additional_fields` → blanks mapped City/State (Opened O3 / AL-4127 v1). Released: 153 → 154 → 155 associated companies DESC limit 1 → 156 → 12 → 151/152 → 10 with only `companyId/name/domain/additional_fields`. Also needs Company Properties mapping with `city`/`state` (AL-4127 lesson, setup).
- **U3 [JSON] AL-4164 create-task, contact missing → Error.** 85 false → 101/102 → 87 `create_contact` with `lifecyclestage: "\"\""`, `hs_lead_status: "\"\""` (literal `""` string, not a valid option → 400). Same bug fixed in Prospect Outcome v5a (92 "lifecycle/lead status from config, was literal `""`"; S9b PASS). 88 also has an empty `{"id":"","type":""}` association and `hs_task_status: ""` (Bounced B10). Released 52/90: lifecycle from config, `NOT_STARTED`, single association.
- **U4 [JSON] AL-4162 create-deal + create-note, contact missing → no note.** 202 false → 203 → 204 `Create Deal (fallback, new contact)` has **no outgoing edges**; note/log rules 51/52 hang only off 3 (existing-contact path). Same as AL-4121 (Link Clicked A2). Also on the existing-contact path, note 53 / log 54 are on the deal only (`contact_id: ""`); ticket expects contact + deal. Released: 102/105 → 106/60 note (deal + contact), 108/62 log.

### Not ticketed, already fixed in released workflows
- **U5** create-company fallback 216 has no outgoing edges → no note/log (Link Clicked A5); 65/66 on company only.
- **U6** all 9 log nodes use `log_email` without `hs_email_headers` → "Unknown Contact" (AL-4102 / AL-4123); deal/company logs 54/66/70/80 not linked to the contact (Bounced v3). Released: `POST /crm/v3/objects/emails` with headers + contact association 198.
- **U7** notes on update-deal 79 / create-deal 53 / create-company 65 not linked to the contact (#39).
- **U8** dates 50/76/83 → `YYYY-MM-DD` without `T12:00:00.000Z` (#37, day shift by timezone).
- **U9** 200/212 `$merge([fixed, {{mapping}}])`: mapping overwrites fixed fields, empty values not dropped, unquoted mapping inside JSONata (Bounced B6, Outcome v5a). Released 147–150 build-body transforms.
- **U10** no `hs_email_domain` strip before contact create/update 5/44/87 (Bounced B8, read-only field → whole write rejected if mapped).
- **U11** 5/44/45/87 send many fixed `""` properties next to the mapping (same class as U2b); 45 writes raw `prospect.city/country/jobTitle/state` on update-contact (Bounced B9).
- **U12** cosmetic: `<b>Title: <b>` unclosed (Link Clicked v4).

### Same as released (not a regression, report only)
- create-task notes 86/89 run without a create-note rule (Outcome v3; Email Sent same shape).
- dealname `"<first> <last>"` (#45 keep), +5:30 IST offset in due/closing date, rules without false branch (silent Success), `base_url https://api.hubapi.com` on 9/17/22/41 (HubSpot host, not #43).

## v2 — `v2-bounced-copy.json` (patch `patches/v2_bounced_copy.py`, 2026-10-19; not imported yet)
User (2026-10-19): fix it the same way the other workflows were fixed. Same approach as Bounced v2 / Link Clicked v3:
graph = released Email is Bounced v4 (= live Email Sent + log contact link + note 89 fix); top level + start trigger = Unsub v1.
Unsubscribe-specific changes only:
- `emailBouncedAt` → `prospectUnsubscribedAt`
- 11 notes: Bounced text with "Raw Bounce Reason" swapped for `Manually Unsubscribed? {{isManuallyUnsubscribed}}`
- 9 email logs `POST /crm/v3/objects/emails`: subject `Prospect Unsubscribed - Saleshandy`, `hs_email_status: SENT`, headers from sender to prospect, contact association on every log
Fixes: AL-4165 (110→111→112 associated deals createdate DESC limit 1 → 113 → 25), AL-4163 (153→154→155 associated companies DESC limit 1 → 156 → 10 sends only id/name/domain + mapping),
AL-4164 (52 create contact lifecycle/lead status from config, 90 task `NOT_STARTED` one association), AL-4162 (new-contact deal 105 → 60/61 note on deal + contact, 62/63 log), U5–U11.
Checks (in script): 114 nodes / 113 edges = Bounced v4; edges identical; top level == Unsub v1; every node outside start/notes/logs == Bounced v4 with only the time swapped;
incoming/outgoing == edges; every `node.X` read is an ancestor; every `workflow.fields.*` and `event.body.*` exists in Unsub config; no `bounceReason`/`BOUNCED` left; no literal `""` in create_contact.

## v2-fixed.json (2026-10-19)
Re-ran `patches/v2_bounced_copy.py` against `v1-original.json` + `../email-bounced-in-saleshandy/v4-note89-contact-path.json` — regenerated output is byte-identical to `v2-bounced-copy.json`, all script self-checks pass (114 nodes / 113 edges, 11 notes, 9 email logs, trigger `646474e0c7f3ab6e2bf5b127`). Saved as `v2-fixed.json` — the version to import. Not yet imported into Pyxis; retest plan below still needs to be run live before this is considered released.

### Retest plan (one at a time, Mark as Unsubscribed)
| # | Ticket | Actions | HubSpot setup | Expected |
|---|---|---|---|---|
| R1 | AL-4165 | update-deal | contact + 3 deals | newest deal: stage/type/priority updated; older untouched |
| R2 | AL-4163 | update-company (Company Properties maps city + state) | contact + 1 associated company, no City | company City/State = prospect values |
| R3 | AL-4164 | create-task (Due In 3) | no contact | Success; contact created + task NOT_STARTED, due T12 |
| R4 | AL-4162 | create-deal + create-note | no contact | contact + deal created, note on both |
| R5 | U6 | update-deal + record-email-activity | contact + deal | log "Prospect Unsubscribed - Saleshandy" shows the prospect, not "Unknown Contact" |

## v2 → audit 2 (2026-10-19, before upload) — compared with every latest sibling
Diff of v2 against Link Clicked v5, Reply Received v5, Email Opened v2, Email Bounced v4 (shared node ids, time field normalised) + catalog #7/#8/#37/#43–#48/#50/#51/#54.
- Opened v2, Bounced v4: identical to v2 (apart from event-specific note/log text).
- **Link Clicked v4/v5 has fixes v2 lacks** (live on staging since 2026-10-14):
  - **A1 [JSON] #8** update-contact 20/55 and task create-contact 52 send the raw mapping → a mapped read-only `hs_email_domain` makes HubSpot reject the whole write. LC: strip steps 157/158.
  - **A2 [JSON]** contact match 56/57/92 is case-sensitive (`Jane@Acme.com` in SH vs `jane@acme.com` in HubSpot → "not found" → create-contact path → 409 / task on nobody) and returns an array when 2 contacts match. LC: `$lowercase(..)` + `[0]`.
  - **A3 [JSON] #43-style** 17/41/49 hardcode `base_url: https://api.hubapi.com` (the connector supplies the host; every other HubSpot call omits it).
  - **A4 [JSON] #7** 77 tests Hubspot Action6 twice (harmless, parity).
  - **A5 [cosmetic]** `<b>Title: <b>` unclosed in 11 notes.
- **A6 [JSON] #45 regression from v2**: v2 took Bounced's deal name `{{first}}{{last}}` (no space) in 25/147/148; this workflow's own naming (v1 nodes 25/200) is `{{first}} {{last}}`. #45 = keep the workflow's own naming (Reply Received kept its space the same way).
- Checked, no issue: Unknown Contact (all 9 logs have contact 198 + deal 210 / company 186), latest deal/company (#44), dates T12 (#37), transform reads `.result` (#47), no `prospect.phone` (#48), log bodies filled raw (Refold escapes once, AL-4129 #50), every rule value is a webui `hubspotTriggersOptions` key (#51/#59), every `workflow.fields`/`event.body` exists in config.
- Accepted / not changed: AL-4130 (log email also shows on the contact's older deals; HubSpot auto-association, ticket closed Done), #40 parallel contact create race, task notes without create-note rule, IST +5:30 day pick.
- **Open, not in any released workflow (needs decision): D3-1** (Reply Received live run 2026-10-15) Saleshandy sends date fields as `YYYY-MM-DD HH:MM:SS`; a date field mapped to a HubSpot date property → 400 `INVALID_LONG`. Only prod's `recent_1_star_review_date` hotfix converts one key.

## v3 — `v3-sibling-parity.json` (patch `patches/v3_sibling_parity.py`, base v2; THE VERSION TO UPLOAD)
A1–A6 applied; the touched nodes 17/20/41/49/52/55/56/57/77/92/157/158 now equal Link Clicked v5 input_data and edges exactly.
Checks (script): 116 nodes / 115 edges (+2/+2); top level == v2 == pasted v1; every node outside the change set == v2; in/out lists == edges; every `node.X` read upstream and transforms read via `.result`; no base_url / `<b>Title: <b>` / no-space deal name left; every action rule tests Action1–11 once; every `workflow.fields`/`event.body` in config.
JSONata run offline (`patches/_jsonata/check_v3.js`, jsonata 2.0.6, exact strings from the file): 56/57/92 mixed case → id, 2 matches → first id, none → empty; 157/158 drop `hs_email_domain` only, empty mapping ok; 147/148 name "Jane O\"Neil" wins over mapping, mapped amount kept, empties dropped, linked to contact.

### Retest plan v3 (upload, then one scenario at a time, Mark as Unsubscribed)
| # | Covers | Actions | HubSpot setup | Expected |
|---|---|---|---|---|
| R1 | AL-4165 | update-deal + create-note + record-email-activity | contact + 3 deals | newest deal updated (stage/type/priority/close date), older untouched; note + log on deal and contact, log shows prospect name |
| R2 | AL-4163 | update-company (Company Properties maps city + state) | contact + 1 company, no City | City/State = prospect values; note/log on company + contact |
| R3 | AL-4164 | create-task (Due In 3) + create-note | no contact | Success; contact (lifecycle/lead status from settings) + task NOT_STARTED due T12 + note |
| R4 | AL-4162 | create-deal + create-note + record-email-activity | no contact | contact + deal "First Last" linked; note + log on both |
| R5 | A2 | update-contact | HubSpot email lowercase, SH prospect mixed case | contact found and updated (not "not found") |
| R6 | A1 | update-contact, Contact Properties incl. `hs_email_domain` | contact exists | 200, other mapped fields written |
| R7 | U5 | create-company + create-note | no contact | contact + company linked, note on both |

## v3 → self-review (2026-10-19, user: "check it matches the other workflows")
Full node-by-node diff of v3 vs Link Clicked v5, Bounced v4, Email Opened v2, Reply Received v5 (runtime keys ignored, event-specific note/log text normalised). Two gaps, both inherited from Bounced v4:
- **B1 [JSON]** notes 61/67/79/107/138/144: sequence link split over two lines `…/sequence/{{id}}` + `\n/steps` → HubSpot link misses `/steps`. Link Clicked v4 and Reply Received have it on one line. (Bounced v4 still has this bug.)
- **B2 [JSON] #39** note 79 (update company) and 144 (create company, new contact) only on the company. Reply Received v5 also attaches the contact (same contacts logs 80/146 already use).
Not taken from Reply Received (reply-only): code nodes 157–165 (reply HTML for logs), prod date hotfix 126/129/134/166 (`recent_1_star_review_date` only, see D3-1 open item).

## v4 — `v4-note-parity.json` (patch `patches/v4_note_parity.py`, base v3; THE VERSION TO UPLOAD)
B1 + B2 only. Checks (script): nodes/edges/top level identical to v3; only the 6 notes changed; every note's contact/deal/company links and optional_fields == Reply Received v5; every note's text == Link Clicked v5 apart from the event lines.
Final parity (all 116 nodes): same node ids and **identical edges** to Link Clicked v5; every node equal to LC5 except 25/147/148 (deal name with a space, #45) and 79/144 (contact on note, = Reply Received v5), plus event text (time field, "Manually Unsubscribed?" note line, log subject "Prospect Unsubscribed - Saleshandy"). JSONata checks re-run on v4: 15/15 PASS.
Retest plan: as v3 (R1–R7); R2 and R7 also expect the note on the contact.

## v5 — `v5-gate-task-notes.json` (patch `patches/v5_gate_task_notes.py`, base v4; THE VERSION TO UPLOAD)
Bug (user report 2026-10-19): create-task only, prospect not in HubSpot → contact + task created, **and a note**, although create-note / record-email-activity were not selected.
Root cause: notes 89 (after task 45, contact exists) and 91 (after task 90, contact created) were wired straight after the task with no rule; every other note/log sits behind its activity rule. Inherited from Email Sent (all released siblings have it); Prospect Outcome v3 fixed it (rules 139/140, live PASS S9b).
- +159 rule (copy of create-note rule 81) 45 → 159 → 89; +160 rule 90 → 160 → 91. Edges 45→89 / 90→91 retargeted (ids kept), new 159→89 / 160→91 (true).
Checks (script): 118 nodes / 117 edges (+2/+2); only 45/90 (outgoing) and 89/91 (incoming) changed; 159/160 identical to rule 81 except id/name/wiring/position; top level identical; every one of the 11 notes and 9 logs now directly behind its 11-slot activity rule.
Retest: T1 create-task only, prospect missing → contact + task, **no note**; T2 create-task + create-note, prospect missing → task + note; T3 create-task only, contact exists → task, no note.
