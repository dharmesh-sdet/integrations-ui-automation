# Salesforce: "Prospect is Unsubscribed in Saleshandy" test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295c0` (workflow_id `65f3ef3cdc17494c670fb135`), slug `salesforce`.
- v1 = `v1-original.json` (91 nodes, 89 edges, 55 config fields), extracted verbatim from the session transcript.
- v2 = `v2-fix-all.json` (patch `patches/v2_fix_all.py`): 62 field changes in 47 nodes, ported from Link Clicked v3 / Email Sent v5 (see `.lavish/sf-unsubscribed-v2.html`).
- Trigger: custom trigger `646474e0c7f3ab6e2bf5b127` "Prospect is Unsubscribed". Edge: `POST /contacts/unsubscribe {contactIds}` (`src/contacts/contacts.controller.ts:684`) → `changeContactStatusToUnsubscribed` → `unsubscribeContacts` (`src/contacts/services/contacts.service.ts:6471`) → one `sendIntegrationEvent(ProspectUnsubscribed)` per prospect using its **latest sequence prospect task** (line 6555). Payload (`src/settings/integration/integration.service.ts:304`): `prospectUnsubscribedAt = actionTime`, + `prospect`, `user`, `sequence`.
  - No sequence id is needed in the call, but a prospect with **no sequence prospect task** (never added to any sequence) fires no event (code comment AL-4015).
  - `isManuallyUnsubscribed` is never set by edge (only in `webhook-test-data.ts`) → Note line "Manually Unsubscribed?" is blank. Observation, checked live below.
- Config field ids (from the JSON): Actions `65eee7666b6b77ca8a186199`, Select Object `67f4c2104db5f4f586154a49`, Closing date (while creating) `65eeffa6ac42f28c5e52a1df`, Opp Stage (While creating) `65f27ebc912f0b34b92dee29`, Closing date (while updating) `6605704d3fc2e06a668f4af1`, Opp Stage (While updating) `6605705e3fc2e06a668f5264`.

## v2 → static audit
Catalog sweep on v2: 0 open findings (all v1 findings fixed in v2). No hardcoded Saleshandy URL; only Saleshandy action `get_prospect_fields` (validated). Every `Actions` compare value exists in its options.

## v2 test matrix (one unsubscribe = one run)
| # | Actions (+ settings) | Salesforce before | Prospect | Expected |
|---|---|---|---|---|
| U1 | create-contact, create-note | none | new P1 | 5 false → 6 Create Contact (Phone, mapping) → 97 Note on contact |
| U2 | same, unsubscribe P1 again | contact exists | P1 | re-trigger fires; 5 true → 7 Update → 96 Note; no duplicate |
| U3 | update-contact + create-lead + create-note | contact exists | P1 | 56 true → 105 Update → 107 Note; 112 true → lead branch stops |
| U4 | create-lead + create-note | none | new P2 | 112 false → 13 false → 15 Create Lead (Company, Phone) → 99 Note |
| U5 | create-lead + update-lead + create-note | lead exists | P2 | 13 true → 16 Update → 98 Note; 67 true → 106 Update → 108 Note |
| U6 | create-opportunity + create-account + create-note (closing create 7, stage Prospecting) | none | new P3 | 21 false → 95 Contact → 25 Opp (+7d, ContactId) → 101 Note; 91 name → 31 false → 33 Account → 103 Note |
| U7 | update-opportunity + update-account + attach-activity [Contact, Opportunity] + create-note (closing upd 14, Qualification) | U6 records | P3 | 81 newest Opp → Qualification, +14d → 109 Note; 46 Account → 104 Note; 2 Tasks (WhoId contact, WhatId opp) |
| U8 | attach-activity [Lead] | U4 lead | P2 | 1 Task WhoId = lead, description with sequence link (sequence.id) |
| U9 | create-contact + create-account + attach-activity, Select Object `[]`, name with apostrophe | none | new P4 | no MALFORMED_QUERY, no crash, 0 errored nodes |
| U10 | update-contact + update-lead + update-opportunity + update-account | none | new P5 | every exists-rule false, nothing created, 0 errored nodes |
| U11 | create-contact | — | new P6 never added to a sequence | edge sends no event → no run (documented limit) |

## v2 live pass (2026-10-07)
Setup: test sequence "SF Unsubscribed test" `2AwrMQeVzQ` (numeric 196018), step `lXwAo41Ba8`, **not activated** (no emails sent). Runner `unsub-run.sh` (config PUT → upsert prospect into step → edge `POST /contacts/unsubscribe` → bounded read-only poll of executions).

### BLOCKER B0 — event accepted by Refold, no execution created
- U1 (P1 `rudra+sf-u1`, prospect 66489080, spt 98647891), unsubscribed 06:09:27 UTC → "Prospect(s) unsubscribed successfully".
- Edge (pyxis Loki, app=edge): `sendIntegrationEvent event.prospect-unsubscribed userId.80121 … sequenceProspectTaskId.98647891` → Kafka `native-integration` → `sendEventToCobalt.event.Prospect is Unsubscribed` → response `{"message":"Webhook Fired Success"}`. Saleshandy subscription for `prospect-unsubscribed` is on (last toggle `…prospect-unsubscribed.to.true`, 2026-10-06 ~11:06 UTC).
- Refold execution list (slug salesforce): no run of any workflow after 05:26:47 UTC (checked 06:12). Config PUTs on this workflow succeed.
- So Saleshandy side is fine; Refold received the event but did not start this workflow → workflow not enabled for the linked account in Refold, or the imported v2 not published to the `test` environment. Needs the user (UI). Edge payload note: Kafka message has `isManuallyMarked: true`, but `preparePayload` never maps it to `isManuallyUnsubscribed`.
- B0 resolved by the user (~06:13). U1 retry with new P1b `rudra+sf-u1b` (prospect 66489083): run `6ac5e3216cadcd097bd498e2` **ERRORED**. v2 is live (node 3 q = email-only). Node 3 Salesforce SOQL → 400 `invalid_grant` "expired access/refresh token" → Refold's Salesforce connection for linked account 80121 lost its refresh token. All other action rules ran (false, correct for Actions [create-contact, create-note]).
  My own read-only SF token still works, so the org is fine — only the Refold connection needs re-authorising. **BLOCKER B1 [CRM-CONFIG / connection]**: reconnect Salesforce in the Saleshandy integration screen.
- B1 resolved: user reconnected Salesforce (~06:15).

### v2 results (all runs COMPLETED, 0 errored nodes)
| # | Actions | Execution | Result | Salesforce |
|---|---|---|---|---|
| U1 | create-contact, create-note, new `sf-u1c` | 6ac5e3984f2e43a722980b0e | PASS: 3 email-only → 5 false → 121 mapping → 6 Create → 97 Note | Contact 003dL00002dX1PFQA0 Phone/MobilePhone/Title; Note on contact |
| U2 | same, unsubscribe again | 6ac5e3c146abc1991291631e | PASS: re-unsubscribe re-fires; 5 true → 7 Update → 96 Note | Phone 9999950012, Title "QA Lead U2", 2 Notes, no duplicate |
| U3 | update-contact + create-lead + create-note | 6ac5e3ef46abc19912916628 | PASS: 56 true → 105 Update → 107 Note; 112 true → lead branch stops | Title "QA Lead U3"; no Lead |
| U4 | create-lead + create-note, new `sf-u4` | 6ac5e41a6cadcd097bd4e3e9 | PASS: 112 false → 13 false → 15 Create Lead → 99 Note | Lead 00QdL00000iYZV3UAO Company/Phone/Title/City/State/Country |
| U5 | create-lead + update-lead + create-note | 6ac5e445c3cdec259309c80a | PASS: 13 true → 16 Update → 98; 67 true → 106 Update → 108 | Phone 9999950051, Title, City Vadodara, 3 Notes |
| U6 | create-opportunity + create-account + create-note (7, Prospecting), new `sf-u6` | 6ac5e47627142f792c477e90 | PASS: 26 due 2026-10-14 → 95 Contact → 25 Opp → 101; 91 → 29 → 33 Account → 103 | Opp 006dL00000T9pU2QAJ Prospecting/2026-10-14/Amount 2500/ContactId; Account 001dL00002ZL60SQAT Phone/Website (mapping) |
| U7 | update-opportunity + update-account + attach-activity [Contact, Opportunity] + create-note (14, Qualification) | 6ac5e4af27142f792c47b484 | PASS: 76 newest → 78 opportunity_id → 81 Update → 109; 45 true → 46 → 104; loop 2 items | Opp Qualification/2026-10-21/3700; Account Phone/Website updated; Tasks 00TdL00000FaQzRUAV (WhoId contact) + 00TdL00000FaR13UAF (WhatId opp) |
| U8 | attach-activity [Lead] | 6ac5e4ef395e2d1fbed7b538 | PASS | Task 00TdL00000FaR4HUAV WhoId = lead |
| U9 | create-contact + create-account + attach-activity, Select Object [], "Liam O'Connor" | 6ac5e526e7104b6dc37676ea | PASS: soql_name `Liam O\'Connor`, no MALFORMED_QUERY; 114 `[]` → loop 0; notes skipped (no create-note) | Contact 003dL00002dX4IHQA0; existing Account "Liam O'Connor" (from Link Clicked K8) matched by name → updated |
| U10 | update-contact/lead/opportunity/account + create-note, new `sf-u10` | 6ac5e55003c817c1aea5d1eb | PASS: 45/56/67/79 false, nothing written | no records |
| U11 | create-contact, prospect `sf-u11` in no sequence, Open API unsubscribe | — | AS DESIGNED: unsubscribed OK, **no run** (no sequence prospect task → edge sends nothing) | — |
| U12 | create-contact, Open API `POST /v1/prospects/unsubscribe` (connector route) | 6ac5e5c8e7104b6dc376b8c8 | PASS: Open API route fires the event too | Contact created |
| U13 | create-contact + create-note + attach-activity [Contact], email really sent (seq 196017), new `sf-u13` | 6ac5e6364f2e43a7229933f3 | **FAIL (race)**: contact + Note created, **no Task**. Loop 118 finished ~1 s into the run; Create Contact 6 took 5.3 s after the mapping nodes (Contact CreatedDate 06:27:06) → loop SOQL found nothing → 116 false | Contact 003dL00002dWfZcQAK, Note has Sender Email; 0 Tasks |
| U13b | attach-activity [Contact] only, same prospect (contact now exists) | 6ac5e6774f2e43a72299ab37 | PASS: proves the race (not the body) | Task 00TdL00000FaRSTUA3 with Sender Email + email body text (apostrophes OK) |

### Bugs / findings of this pass
- **[EDGE] F-1 "Manually Unsubscribed?" is always blank.** Note body reads `{{event.body.isManuallyUnsubscribed}}`; edge `preparePayload` (`src/settings/integration/integration.service.ts:304`) only sets `prospectUnsubscribedAt`. Kafka event from `unsubscribeContacts` carries `isManuallyMarked: true` (Loki 06:09:27); link-unsubscribes from email-tracker (`saleshandy-email-tracker/src/Email-tracking/services/email-tracking.service.ts:248`) carry none (= not manual). Fix: add `eventToCobalt.isManuallyUnsubscribed = Boolean(event.isManuallyMarked);` in that case (same as EmailBounced line 285). Not a JSON bug.
- **[JSON, structural — catalog #40 race] F-2 attach-activity misses records created in the same run.** Brand-new prospect + create-contact/create-lead/create-opportunity together with attach-activity on that object → Task step searches before the create finishes → no Task. Same in every SH→SF sibling (same layout). Fix needs a structural change (attach-activity waits for the create branches), so needs the user's decision.
- **[EDGE, by design] F-3 Prospect in no sequence → no event** (U11). `unsubscribeContacts` fires once per prospect from its latest sequence prospect task; none → nothing (code comment AL-4015). Product decision.
- Observations (not bugs): Sender Email / Email body / Latest Outcome blank when no email was sent yet (U1–U12, nothing to show); email body text loses line breaks between paragraphs (cheerio `.text()`, same as siblings); Account is matched by "First Last" name (accepted #45).
- Not run live: unsubscribe by the prospect clicking the unsubscribe link (needs a real click; code path email-tracker:248 sends the same event).

### Test state left behind
- Workflow config: Actions [attach-activity], Select Object [Contact], closing create 7 / Prospecting, closing update 14 / Qualification.
- Test sequence "SF Unsubscribed test" 196018 (not active) with prospects sf-u1c, sf-u4, sf-u6, sf-u9, sf-u10, sf-u12; seq 196017 got sf-u13 (email sent). Salesforce records listed above.

## v3 — `v3-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v2-fix-all.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.
