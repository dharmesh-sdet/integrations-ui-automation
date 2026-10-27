# HubSpot — Sequence Email is Opened in Saleshandy (staging)

- Direction **SH → CRM**. Export `681368981acc0cbcd16295af`, slug `hubspot`, trigger `64647480c7f3ab6e2bf5b11f`.
- `v1-original.json` = definition pasted by the user, 2026-10-14 (106 nodes / 105 edges).
- Tickets: AL-4128 (update deal: Success, deal unchanged), AL-4126 (update company: Success, City unchanged). Sibling: AL-4125 (Bounced).

## v1 audit vs live Email Sent (`../link-is-clicked-in-saleshandy/email-sent-live.json`)
| # | Ticket | Finding |
|---|---|---|
| O1 | AL-4128 | Update deal: `22` searches deals with `dealname EQ prospect email`; `91` re-matches name == email. Real deals ("AWS Deal 1") never match → `total 0` → rule `24` ends branch, log Success. Explains all 7 runs (3 deals, re-open, 51-day close date, paired note/log). |
| O2 | AL-4126 | Update company: `9` searches companies with `name EQ prospect.company`, `sorts:["createdate"]` (oldest first), limit 100; `46` filters `allOrganisation[properties.name=...]`. Updates the oldest same-name company, not the contact's company (Bounced run: 200, `city: abcd` on another company). 2+ same-name companies → `companyID` is an array → Error (the ticket's "earlier run showed Error"). |
| O3 | — | `10` update_company sends `city/state/... = ""` next to the mapped `additional_fields` (Email Sent sends only id/name/domain + mapping). |
| O4 | — | 9 `log_email` connector nodes, none with `hs_email_headers` ("Unknown Contact"); Email Sent uses `POST /crm/v3/objects/emails` + headers (AL-4102). |
| O5 | — | Notes/logs `70/71/78/79` have `contact_id: ""`. |
| O6 | — | Tasks `84/86` `hs_task_status: ""` (Email Sent `NOT_STARTED`). |
| O7 | — | Update contact `20/44` send raw `prospect.phone`. |

## Chosen fix — targeted (user decision 2026-10-14: fix properly without breaking anything that works)
`integration-jsons/email-opened-in-saleshandy-al4128-al4126-fixed.json` (patch `patches/al4128_email_sent_parity.py`, base v1). 110 nodes / 109 edges.
- O1: +132 search contact, +133 contact exists?; `22` body = Email Sent 112 (associations.contact, createdate DESC, limit 1); `91` returns first deal (same output shape); `25` dealname `First Last` (Link Clicked) instead of the email.
- O2: +134/+135 contact lookup; `9` body = Email Sent 155; `46` = Email Sent 156 (`allCompanies.results[0].id`).
- O3: `10` drops the 9 blank keys → same key set as Email Sent 10.
- O5: `78/79` contact_id = `node.132…`. O6: `84/86` `NOT_STARTED`.
- O4, O7, O5 (70/71) left as is (not ticketed, currently working).
Checks: top level identical; 94/106 nodes byte-identical; only edges 21→22, 15→9 retargeted; in/out == edges; every node.X read upstream; every workflow.fields in config; node 91 run locally (1 deal → id, 0 → exists:false).

## Alternative (not used) — `v2-email-sent-copy.json` (patch `patches/v2_email_sent_copy.py`, same approach as Link Clicked v3 / Bounced v2)
Graph = live Email Sent; top level + start trigger = Opened v1. Open-specific changes only:
- `{{event.body.emailSentAt}}` → `{{event.body.emailOpenedAt}}` (20)
- 11 notes: Email Sent text + `Open Count: {{event.body.openCount}}`
- 9 email logs: subject `Email is opened - Saleshandy` (status SENT, as v1)
Checks (in script): 114 nodes / 113 edges, same ids + edges as Email Sent; every other node == Email Sent with only the time swapped; top level == v1; every `node.X` read upstream; every `workflow.fields.*` in Opened config; every `event.body.*` used exists on the Opened trigger.
Covers O1 (110→111→112→113: contact → newest associated deal), O2/O3 (153→154→155→156: contact → newest associated company; `10` = id/name/domain + Company Properties mapping), O4–O7.
Known carry-over from Email Sent: update deal `25` dealname = `{{firstName}}{{lastName}}` (no space) — renames the deal on every open.

Not run live yet.

## Live test plan — targeted fix (`al4128-al4126-fixed`)
Prospects `rudra+hs-eo-<id>@saleshandy.com`, one per scenario. Open = real open of the sent email by the user (open tracking on).
HubSpot setup and reads via HubSpot API (`HUBSPOT_ACCESS_TOKEN` from refold-qa-automation/.env). Config fields set via `PUT /config/field/<id>` (as send-for-open.sh).

Scope (user 2026-10-14): only the scenarios written in AL-4128 / AL-4126. Staging Sales Pipeline has no "Follow-Up" stage → Qualified Lead `4274252497` stands in.

| # | Ticket scenario | Config | HubSpot setup | Expected |
|---|---|---|---|---|
| T1 | AL-4128 main | update-deal; default / Qualified Lead / newbusiness / high / 0 days | contact + 1 deal "AWS Deal 1" (Prospecting) | deal: stage, type, priority set, close = today |
| T2 | AL-4128 3 deals | same | contact + 3 deals | only newest deal updated |
| T3 | AL-4128 values changed + 2nd open, 51 days | T1 contact; Negotiation / existingbusiness / low / 51 | — | new values, close = today + 51 |
| T4 | AL-4128 create note + update deal, 1 deal | + create-note | contact + 1 deal | deal updated, note on deal |
| T5 | AL-4128 log email + update deal, 3 deals | + record-email-activity | contact + 3 deals | newest deal updated, email logged |
| T6 | AL-4126 | update-company | contact + associated company, no City; prospect City/State set | company City = prospect City |

## Live run 2026-10-14 (staging, linked account 80121)
Setup: sequence 196005 "SF Email Opened test" (`glwG5nOYa6`), step `9KwOAr94a6`, open tracking on (code 5 = 1), sender rudra@ (369550). Workflow enabled via `PATCH /slug/hubspot/config/80121/workflows/<id>`.
**Imported version = `v2-email-sent-copy.json`** (run executed Email Sent node ids 110/111/112/113/98/124/125; targeted-fix ids 132–135 absent).
First send (05:33) never counted an open (opened = 0, no run in any CRM); Action1 had been saved as a string → UI showed no action. Re-saved as `["update-deal"]` (UI format), re-sent 05:41:34, user opened → open count 1.

| # | Execution | Result | Evidence |
|---|---|---|---|
| T1 | 6acf16367f8e9c58d5cbca1e (05:42:14, COMPLETED) | **PASS** (AL-4128 main). 21 true → 110 → 111 → 112 → 113 dealID 354151735017 → 24 true → 124/125 → 25 Update Deal 200. Deal "AWS Deal 1" (Prospecting, no type/priority) → stage Qualified Lead `4274252497`, type newbusiness, priority high. Rules 85/86 false (no note/log selected), every other action rule false. | `runs/20261014T0542-T1-nodes-*.json`, `runs/T1-hs-deal-after.json` |

Observations (not in ticket expected result): 98 close date **Skipped** with Closing Date = 0 (`exist` rule treats 0 as empty; template renders 0 as blank) → close date not set for 0 days; same in Email Sent. Deal renamed "AWS Deal 1" → "EoT1Test" (Email Sent `{{first}}{{last}}`, no space).

Round 2 config: Action1 `["update-deal","create-note","record-email-activity","update-company"]`; update values Negotiation `4274252498` / existingbusiness / low / 51 days. T2 contact 569213423339 with deals 354198553277, 354214889184, 354198553278 (newest); T6 contact 569246409439 + company 352163232446 "EoT6 Co" (no city), prospect City Ahmedabad / State Gujarat.

| # | Execution | Result | Evidence |
|---|---|---|---|
| T2 | 6acf174f5f6567d77c50ffd1 (05:46:55) | **PASS** 112 newest deal 354198553278 → 25 updated (Negotiation, existingbusiness, low, close 2026-12-04). Deals 1 and 2 unchanged (Prospecting, empty). | `runs/T2-hs-deal-*-after.json` |
| T3 | 6acf178394af3d98b87b7196 (05:47:47, 2nd open of T1) | **PASS** T1 deal 354151735017: Qualified Lead/newbusiness/high → Negotiation/existingbusiness/low; close 2026-12-04 = 2026-10-14 + 51. | `runs/T3-hs-deal-after.json` |
| T4 | same run | **PASS** note 406815294172 on deal 354151735017 + contact 569349290699 (HubSpot read). | |
| T5 | 6acf174f5f6567d77c50ffd1 | **PASS** newest deal updated; email 406864389856 logged on deal 354198553278 (assoc 210, from node 88 request/201; token lacks emails read scope). Note 406828098249 on deal + contact. | |
| T6 | 6acf175b94af3d98b87b6dbc (05:47:07) | **PASS** (AL-4126) 153 contact → 155 associated company 352163232446 → 152 mapping `{"city":"Ahmedabad"}` → 10 Update Company 200; HubSpot company city = Ahmedabad. | `runs/T6-hs-company-after.json` |

Extra run 6acf178a7f8e9c58d5cccf19 (05:47:54) = second open of the T2 email → same newest deal updated again, another note + email log (one per open, expected).
State (not in Company Properties mapping, only `city` is mapped) stays empty — mapping config, not a bug.
Left on staging: workflow enabled; config = round 2 above.

| M1 | 6acf19dd94af3d98b87c853b (05:57:49, re-open of T1, actions `["update-deal"]`) | **PASS** deal mapping `{annualRevenue: amount}`: event prospect carried both Annual Revenue custom fields (`1997619`, `2041901` = "50000"), 125 → `{"amount":"50000"}` → 25 `additional_fields.amount` → HubSpot deal 354151735017 amount = 50000. | `runs/20261014-M1-6acf19dd94af3d98b87c853b.json` |

Note: Open API `GET /v1/prospects?search=` does not return custom fields; the `/v1/prospects/import` by field id did store them.
