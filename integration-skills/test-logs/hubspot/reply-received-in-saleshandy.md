# HubSpot: "Reply is Received in Saleshandy" test log

- Direction **SH → CRM**. Workflow `681368981acc0cbcd16295a9`, slug `hubspot`, staging, linked account 80121.
- `v1-original.json` = live definition from `GET $REFOLD_PUBLIC_BASE/workflow/<id>` (org API key), 2026-10-12. 104 nodes / 98 edges.
- QA report: Actions = update-deal, reply received → deal not updated.

## Config at 2026-10-12 (read-only `GET /slug/hubspot/config/80121`)
- Workflow `enabled: true`.
- `Hubspot Action1` = `[]`, Action2–11 unset → rule 21 can never be true. No action is saved on this account.
- `Select Pipeline / Stage (when to update)`, Deal Type / Priority / Closing Date (while updating) all unset.
- App field `Deal Properties` mapping = `null`.
- No Reply Received run in the last 200 HubSpot executions (back to 2026-10-06 09:15).

## v1 → audit (update-deal branch: 21 → 22 → 99 → 24 → 90 → 114 → 115 → 25 → 70/71)
- **A1 [JSON] deal lookup by name (#36 / #44)**: node 22 searches `deals/search dealname EQ "{{first}} {{last}}"`, sorts `["createdate"]`
  (ascending, oldest first); node 99 returns the first exact match. A deal linked to the contact with any other name
  (e.g. created by hand in HubSpot, or by create-deal of another workflow — Email Sent names it `{{first}}{{last}}` without space)
  is never found → rule 24 false → run ends Success, nothing updated. Email Sent reference (`email-sent-from-saleshandy-latest-assoc-fixed.json`
  110 → 111 → 112 → 113) finds the **latest deal associated with the contact** (search contact by email, then `associations.contact EQ id`, createdate DESC, limit 1).
- **A2 [JSON] oldest deal** when several share the name (ascending sort) — user rule #44 is "update the latest".
- A3 note: node 25 also writes `dealname = first last` (renames the deal) — #45 report only, kept.

## Scenario matrix (pending live run)
| # | Setup in HubSpot | Actions | Expected |
|---|---|---|---|
| U1 | contact + 1 associated deal named "First Last" | update-deal, create-note | 22 finds it → 25 updates stage/close date/type/priority → 72 note on deal |
| U2 | contact + 1 associated deal named something else (QA case) | update-deal | v1: 24 false, nothing updated (A1) |
| U3 | contact + 2 deals named "First Last" | update-deal | v1: oldest updated (A2) |
| U4 | no deal | update-deal | 24 false, no error |

## Live run U1 — 2026-10-12 10:35 (trigger: edge `PATCH /sequences/195954/emails/status {sequenceProspectTaskIds:[98651984],status:"replied"}` = QA's "Mark as replied")
Config: Action1 = `["update-deal","create-note"]` (array, as webui saves it), update pipeline default / stage 4274252495 / existingbusiness / high / 10 days, Deal Properties `{"annualRevenue":"amount"}`.
Execution `6accb7e7f65ff4bccd0c3442` (`runs/20261012T1035-U1-nodes-*.json`):
- 21 `eq` against the array → **true** (Refold `eq` matches an element of an array). Array storage is NOT the bug.
- 22 `dealname EQ "PO5 S3"` → 2 deals (353213568750 created 06:04:14, 353199180530 06:04:49); 99 → **oldest** 353213568750 (A2 confirmed).
- 25 Update Deal → stage 4274252495, dealtype existingbusiness, hs_priority high, closedate 2026-10-22 written. 72 note on deal. **PASS for a deal named "First Last".**
- 115 Mapping → `{}`: prospect custom field arrives as `"2041901":"50000"`, mapping key `annualRevenue` (set by API) not matched → amount not sent. Setup gap of my API-made mapping, unverified; re-check with a UI-saved mapping.

## AL-4119 root cause
QA's deal was created by hand in HubSpot ("A contact exists with 1 deal"), so its name is not "<first> <last>". Node 22 searches only `dealname EQ "<first> <last>"` → 0 results → 99 `exists:false` → 24 false → run ends **Success**, deal untouched. Matches the ticket exactly (Success in 4–6 s, both replies, Type/Priority/Close Date unchanged).
Secondary: "Closing Date 0 days" — webui `number-field.tsx` never saves 0 → node 90 rule `exist` false (catalog #34 note).

## v2 — `v2-deal-by-contact.json` (patch `patches/v2_deal_by_contact.py`, base = pasted export `v1-original.json`; live fetch kept as `v1-live-fetch.json`)
Reference: live Email Sent `681368981acc0cbcd162959c` (updated 2026-10-02) nodes 110 → 111 → 112 → 113 → 24 → 98.
- + 511 `search_contacts` email EQ prospect.email (= ES 110)
- + 512 rule contact exists AND email eq (= ES 111)
- + 513 `POST /crm/v3/objects/deals/search` `associations.contact EQ {{node.511.body.results.0.id}}`, createdate DESCENDING, limit 1 (= ES 112)
- + 514 transform `dealID = allDeals.results[0].id` (= ES 113)
- − 22 (dealname search), − 99 (name match code) and their edges
- 21 → 511; 24 reads `node.514.body.result.dealID`; 25 `dealId` = `node.514.body.result.dealID`
- 90 close date `YYYY-MM-DD` → `YYYY-MM-DDT12:00:00.000Z` (= ES 98, avoids day shift by timezone)
- Kept: 25 `dealname` = "first last" (with space; #45 keep as is), notes/log email (read `node.25.body.id`, unchanged).
Self-checks: 106 nodes / 100 edges, all edge ends exist, no `node.22.`/`node.99.` refs, every other node and top-level key byte-identical to v1.

### Retest plan (Mark as replied, update-deal only)
R1 contact + deal named anything (QA case) → 513 finds it → 25 updates stage/type/priority/close date ·
R2 contact + 2 deals → newest updated · R3 contact without deal → 24 false, Success, nothing written ·
R4 no contact → 512 false · R5 Closing Date 51 → closedate today+51 T12:00Z.

## v3 — `v3-email-sent-parity.json` (patch `patches/v3_email_sent_parity.py`; supersedes v2, which was never imported)
User (2026-10-12): make Reply Received work exactly like Email Sent from Saleshandy, all fixes; notes and logs must be proper.
Base graph = live Email Sent (`681368981acc0cbcd162959c`, identical to `integration-jsons/email-sent-from-saleshandy-latest-assoc-fixed.json`); top level (name, trigger, config_fields, export_id) = Reply Received v1.
Gained from Email Sent (all branches): contact-first create paths with association (deal→contact 3, company→contact 280) and new-contact fallbacks; build-body transforms (mapping merged, empty dropped); strip `hs_email_domain` before contact create/update; update-deal = latest deal associated with the contact (110–113); update-company = latest company associated with the contact (153–156); dates `T12:00:00.000Z` (97/98/93); tasks `NOT_STARTED`; no `prospect.phone`.
Reply-specific:
- start node = Reply Received trigger `6464679ac7f3ab6e2bf5a62c`; `emailSentAt` → `replyReceiveAt`.
- 11 notes: reply text — replied at, manual mark flag, sequence link/name, step + variant, original subject, sender, prospect, latest outcome, user, then the reply HTML.
- 9 email logs `POST /crm/v3/objects/emails`: `INCOMING_EMAIL`, from/sender = prospect, to = sender; subject `Re: <original subject>` (fallback "Reply received - Saleshandy"); body = reply HTML (fallback text for a manual mark with no content). Code nodes 157–165 (one before each log) JSON-escape html/subject/headers (#50).
- notes + logs on every record the branch knows: + contact on update-deal log 88, update-company note 79/log 80, create-company(new contact) note 144/log 146.
- dealname "First Last" with a space (RR's own naming, #45); #38 fix: note 89 `node.92.body.result.contactID`.
Checks: 123 nodes / 122 edges; incoming_nodes == edges for every node; every `node.X` read is an ancestor; untouched Email Sent nodes byte-identical; action keys = webui `helper.ts` keys; code node run offline with quotes/newlines/backslash/unicode and with empty reply → all 9 log bodies valid JSON, headers parse, associations intact.

### Retest plan (v3, "Mark as replied" via edge, one action group per run, + create-note + record-email-activity)
| # | Actions | HubSpot setup | Expected |
|---|---|---|---|
| P1 | update-deal (AL-4119) | contact + hand-made deal with any name | 110→111→112→113 → 25 updates the deal (stage/type/priority/close date T12) → 87 note + 88 log on deal AND contact |
| P2 | update-deal | contact + 2 deals | newest updated, older untouched |
| P3 | create-deal | contact missing / exists | contact created + deal linked (3) / deal linked to existing → note + log on both |
| P4 | create-company | contact missing / exists | company linked (280) → note + log on company and contact |
| P5 | update-company | contact + 2 companies | newest updated → 79/80 on company and contact |
| P6 | create-contact / update-contact | missing / exists | contact created/updated → note + log on contact |
| P7 | create-task | contact exists / missing | task NOT_STARTED due T12 → note |
| P8 | real reply with quotes/line breaks | any | log subject "Re: …", html = reply, from prospect to sender |

## v4 — `v4-al4129-single-escape.json` (patch `patches/v4_al4129_single_escape.py`, base = v3; not imported yet)
AL-4129 (logged reply email "from/to Unknown Contact"). Live run 2026-10-15, node 63: sent `hs_email_headers` decoded to `{\"from\":…}` → HubSpot stored `{"to":[],"cc":[],"bcc":[]}`.
- Root cause: code nodes 157–165 `esc()` JSON-escaped html/subject/headers AND Refold escapes every filled value once when rendering the log body → double escape. The v3 offline check assumed raw substitution, so it missed this.
- Proof Refold escapes once: Prospect Outcome v5 node 149 fills raw `{{event.body.sequence.emailBody}}` (HTML with `style="…"`) and the live run shows it intact.
- Fix: `esc` → `v == null ? '' : String(v)` in nodes 157–165. Log bodies, edges, all other nodes byte-identical to v3 (asserted).
- Offline check: new code + one escape per filled value, quotes/newline/backslash/unicode + `O"Neil` + empty reply → all 9 log bodies parse, headers JSON with from = prospect, to = sender.
- Not proven offline: Refold escaping newlines (no saved run has one) → retest T3.
- Open: pasted run was node 63 (create-deal/new-contact path in v3), ticket says update-deal (node 88). Confirm live = v3 before import.

### Retest (after import, one at a time)
T1 update-deal + log, contact with 3 deals, Mark as replied → node 88, latest deal email "from <prospect> to <sender>" ·
T2 create-contact + log → node 72 · T3 update-deal + log with a REAL reply containing quotes, newlines, backslash → 201, body as written ·
T4 update-company + log → node 80 on company + contact. Each: response `hs_email_headers` has from/to, not the empty one.

## v5 — `v5-prod-date-conversion.json` (patch `patches/v5_prod_date_conversion.py`, base = v4; not imported yet)
Prod-vs-staging review 2026-10-15: prod create-contact (101) / create-company (102) have an inline code node that drops
`hs_email_domain` AND converts `recent_1_star_review_date` to epoch ms (prod-only hotfix). Staging lost the date conversion.
- Contact: transforms 126/129/134 → code nodes with prod's code verbatim (same id/position/edges). 5, 44, 101, 135 now read
  `{{node.X.body.properties}}` (was `.body.result`).
- Company: new code node 166 (117 → 166 → 130); 149/150 `mapped` = `{{node.166.body.properties}}`.
- Everything else byte-identical to v4 (asserted); graph checks pass (124 nodes / 123 edges, every `node.X` read is an ancestor).
- Code run offline: date-only and ISO → ms, invalid date kept as is, empty / null data → `{}`.
- Not in prod either, left as is: update-contact (121 → 20/55), task create-contact (123 → 52), update-company (152 → 10).

### Retest
D1 create-contact, new prospect with `recent_1_star_review_date` mapped → node 5 201, date stored ·
D2 create-contact, existing contact → node 44 ·
D3 create-deal, contact missing → node 101 · D4 create-company, contact exists / missing → 136 / 135 + 142, date on company.

### v5 live run D2 — 2026-10-15 09:45 (account 80121, real reply to sequence 196745 "HS RR v5 date test D2")
Config: actions `["create-contact","create-company","create-note"]`; Contact + Company Properties incl. `closingDate → recent_1_star_review_date`.
Prospect `rudra+hs-rr-d2@saleshandy.com`, Closing Date `2026-10-12 00:00:00`. Execution `6ad0a0af047637b276b6e234` (`runs/20261015-D2-exec-*.json`) ERRORED.
- **Patch PASS**: 126, 134 (contact) and 166 (company) all turned `"2026-10-12 00:00:00"` into `1791763200000` (= 2026-10-12T00:00Z, valid for a HubSpot date property).
- 5 and 135 Create Contact → 400 `PROPERTY_DOESNT_EXIST recent_1_star_review_date` (portal 247320744). **Setup gap**: the property isn't in the portal (token can't create properties; user must add it as a Date picker on Contact + Company).
- Not reached because of that: 136/142 company create, notes. Contact was new, so both create-contact (5) and create-company (135) tried to create it (the parallel-create race from the review).

### v5 live run D3 — 2026-10-15 09:52 (same setup, mapping `closingDate → closedate` on Contact + Company, contact pre-created 570366706382)
Execution `6ad0a259679406052baf26e6` (`runs/20261015-D3-exec-*.json`) ERRORED.
- Path correct: 41 → 56 contact found → 43 true → 44 Update Contact; 130 → 131 true → 149 → 136 Create Company (associated 280).
- 126/166 pass `closedate: "2026-10-12 00:00:00"` through unchanged (by design: they only convert `recent_1_star_review_date`).
- 44 and 136 → 400 `INVALID_LONG: 2026-10-12 00:00:00 was not a valid long` (closedate, contact 0-1 and company 0-2).
- **Bug D3-1 [JSON, also in prod]**: Saleshandy sends date fields as `"YYYY-MM-DD HH:MM:SS"`. HubSpot date/datetime properties need epoch ms, so ANY date field mapped to a HubSpot date property fails. Prod's fix only covers one customer key (`recent_1_star_review_date`). Affects every mapping path: create/update contact, create/update company, create/update deal, task contact.
