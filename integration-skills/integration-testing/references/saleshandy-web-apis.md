# Saleshandy APIs used for live testing

Never guess an endpoint. Base URLs and tokens come from
`~/.config/sh-integration-testing/<env>.env`, never from this file.

## Two APIs, two auths

| API | Base (env var) | Auth | Spec |
|---|---|---|---|
| Open API gateway (what connector actions call) | `SH_OPEN_API_BASE` (staging `https://pyxis-open-api-gateway.lifeisgoodforlearner.com`) | `x-api-key: $SH_API_KEY` | `GET $SH_OPEN_API_BASE/api-doc-json` (OpenAPI JSON, ~113 endpoints, all under `/v1/...`) |
| Edge web API (what the web app calls) | `SH_BASE_URL` (staging `https://pyxis.lifeisgoodforlearner.com/api/edge`) | `Authorization: Bearer $SH_TOKEN` (user JWT) | edge controllers in this repo — cite `file:line` |

Pull the spec fresh each session (`curl -s $SH_OPEN_API_BASE/api-doc-json > scratchpad/doc.json`)
and read request/response schemas from it with `jq`. Use the edge web API only for things the
Open API can't do (send-now, remove prospect from sequence), with the route taken from the edge
controller code.

## Proven calls (staging, 2026-10-06)

| Purpose | Call | Notes |
|---|---|---|
| Create sequence | Open API `POST /v1/sequences` `{title, emailAccountIds:[hashId]}` | returns hashed `sequenceId` |
| Add email step | Open API `POST /v1/sequences/{seqHash}/steps` `{"type":1,"absoluteDays":1,"variants":[{"payload":{subject,content}}]}` | spec says `type:"Email"` but API only accepts `1` |
| Add prospect | Open API `POST /v1/sequences/prospects/import-with-field-name` `{stepId:<step hash>, conflictAction:"upsert", verifyProspects:false, prospectList:[{"First Name":..,"Email":..}]}` | keys = field labels |
| Activate | Open API `POST /v1/sequences/status` `{sequenceIds:[hash], status:"resume"}` | inside the schedule window a newly added prospect sends within ~1 min on its own |
| List email tasks | edge `GET /sequences/{numericSeqId}/emails?page=1&limit=10` | `.payload.emails[].id` = sequenceProspectTaskId, `.contact.id` = contactId |
| Send now | edge `POST /sequences/{numericSeqId}/emails/send` `{sequenceProspectTaskId, emailAccountId}` | `src/sequence/sequence.controller.ts:2009` |
| Remove prospect | edge `PATCH /sequences/{numericSeqId}/contacts` `{contactIds:[n]}` | re-import after this to re-trigger |
| Prospect by email | Open API `GET /v1/prospects?search=<url-encoded email>` | partial search returns nothing |
| Sender list | Open API `POST /v1/email-accounts` `{pageSize:50,status:1}` | `.payload.emails[]` (`hashId`) |

## Refold logs + config (`scripts/refold-logs.sh`)
- List runs: `GET $REFOLD_PUBLIC_BASE/execution?slug=<crm>&workflow_id=<export_id>&page=1&limit=N&sort=-createdAt` with
  `Authorization: Bearer $REFOLD_LA_TOKEN`, `slug: <crm>` (same call edge makes). The org dashboard token (`$REFOLD_BASE/instance`)
  expires/rotates daily, so don't depend on it.
- Node-level detail: `GET $REFOLD_PUBLIC_BASE/execution/<id>` with `Authorization: Bearer $REFOLD_LA_TOKEN`, `slug: <crm>`.
  The org `instance/<id>` detail has no nodes.
- Change workflow config (user-approved for testing only): `PUT $REFOLD_PUBLIC_BASE/config/field/<fieldId>?workflow_id=<export_id>`
  `{"value": ...}` with the linked-account token. Field ids are the `_id`s in the workflow's `config_fields`.
- Loop (group) children are not in the node log. Verify loop results in the CRM.
- Running every action at once triggers the parallel create race. Test branch-specific behaviour with one action group at a time.

## Validated Saleshandy connector actions (Pyxis `custom` nodes)

Action id is the same in staging and production unless noted. A `custom` Saleshandy node whose
`action` id is not here → flag (step 3.2 of the skill).

| action_name | action_operation_id | action id | env seen |
|---|---|---|---|
| Add Prospect to Saleshandy Account | add_prospect_to_saleshandy_account | 644a7f4e9aac4fbbe68862cf | test, prod |
| Add Prospect to the Saleshandy Sequence | add_prospect_to_the_saleshandy_sequence | 64634203c7f3ab6e2bf5295e | test, prod |
| Change Prospect Status | change_prospect_status | 65770a9bc002b2b9b4592f16 | test, prod |
| Assign a Tag to Prospect | assign_a_tag_to_prospect | 65770ac2c002b2b9b4592f1e | test, prod |
| Blacklist a Domain (one string) | blacklist_a_domain | 65770ac8c002b2b9b4592f26 | test, prod |
| Blacklist Domains Bulk (array) | blacklist_domains_bulk | 6abcfffa5f7bd2f2319f4038 | test (prod id unknown — ask) |
| Get Prospect Id | get_prospect_id | 6577137ac002b2b9b45c5de4 | test, prod |
| Get Prospect Fields | get_prospect_fields | 6578300bc002b2b9b4f15c37 | test, prod |
| Update Prospect to Saleshandy Account | update_prospect_to_saleshandy_account | 6836e9c189920efd0dfd3149 | test (prod id unknown — ask) |
| unsubscribe prospects upd | unsubscribe_prospects_upd | 6aa3a571686cab0157a32ce0 (test) / 6ab119716a74bb3813a4c406 (prod) | env-specific id |
| Get All Sequences | ? | ? | not used in any saved workflow yet — ask for id |

`Blacklist Domains (Bulk)` with action id `000000000000000000000000` appears in an old file — a
placeholder, not a real action. Request bodies: copy from the HubSpot workflows of the same kind
(`integration-jsons/`), and check against the Open API schema of the endpoint the action calls.

## Live-test calls (fill in path/body from the spec or edge code on first use)

### SH → CRM triggers
- [ ] List email accounts — Open API `POST /v1/email-accounts`
- [ ] Create sequence — Open API `POST /v1/sequences`
- [ ] Add email step — Open API `POST /v1/sequences/{sequenceId}/steps`
- [ ] Attach sender — Open API `POST /v1/sequences/{sequenceId}/email-accounts/add`
- [ ] Add prospect to sequence — Open API `POST /v1/sequences/prospects/import-with-field-name`
- [ ] Activate sequence — Open API `POST /v1/sequences/status`
- [ ] Send now — edge web API (route from code)
- [ ] Remove prospect from sequence — edge web API (route from code)
- [ ] Confirm email sent — Open API `GET /v1/prospects/{contactId}/minimal/sequences`
- [ ] Change prospect status — Open API `PATCH /v1/prospects/status`
- [ ] Opened / clicked / replied — no API; ask the user

### CRM → SH checks
- [ ] Prospects — Open API `GET /v1/prospects`
- [ ] Fields + types — edge `GET /fields/list?page=1&limit=500` (`payload.items[]`: id, label, fieldType) or Open API `GET /v1/fields`
- [ ] DNC — Open API `GET /v1/dnc/item/search`
- [ ] Tags — Open API `GET /v1/prospects/tags`

## Learned 2026-10-07 (SF Link Clicked)
- Sequence settings PATCH takes **numeric** codes: 1 unsubscribe link, 2 unsubscribe text, 3 mark as finished, **4 track link clicks**, **5 track email opens**, 6 risky prospects, 7 BCC, 8 CC, 9 text-only, 11 ESP matching, 12 first-step text-only, 13 unsubscribe header. Body `{"settings":[{"code":4,"value":"1"}]}`.
- A link click also counts as an **open** (fires "Email Opened" workflows even with open tracking off). Disable every other workflow subscribed to the account before testing click/open workflows, or their actions race yours.
- Salesforce standard duplicate rules match Contact↔Lead across objects and also fuzzy-match names (95% on a similar name + email) — use clearly distinct names per scenario.
- Click-by-script (`link-is-clicked-in-saleshandy/click-email.py`) needs TEST_MAILBOX_USERNAME / TEST_MAILBOX_APP_PASSWORD in refold-qa-automation/.env (empty today → user clicks by hand).

## Learned 2026-10-12 (Zoho) — app config + field mapping by API
- **Read app config** (field mappings + every workflow's `enabled`): `GET $REFOLD_PUBLIC_BASE/slug/<crm>/config/<config_id>` with
  `x-api-key: $REFOLD_ORG_API_KEY` + `linked_account_id: <id>` (the LA token gives "Missing API Key"). `config_id` = the
  `config_id` on any execution record (80121 here). `GET $REFOLD_PUBLIC_BASE/config` does not exist.
- **Save a field mapping** (what the webui's `cobalt.updateConfigField(crm, mapFieldId, obj)` does): `PUT $REFOLD_PUBLIC_BASE/config/field/<appFieldId>`
  (no `workflow_id`) with the LA token + `slug: <crm>`, body `{"value": {"<shKey>": "<CRM api name>"}}`.
  shKey = `formatProspectLabel(label)` for default fields (= `mappingDefaultField`, e.g. `phoneNumber`, `jobTitle`),
  `camelCase(label)` for custom ones (webui `configuration-content.tsx:59`). CRM api names = the map field's `options[].value`.
- Zoho app field ids (staging): Deal Fields `64a7d3aa65d5483aa1e724bd`, Contact Fields `64b8b4990edd2d8358d64717`,
  Account Fields `64b8b4f30edd2d8358d64735`, Lead Fields `64e41f7b83771b6c370352ac`.

## Learned 2026-10-14 (HubSpot Email Opened)
- HubSpot/Salesforce action selection is stored by the webui as an **array in the first action slot**: `Hubspot Action1 = ["update-deal","create-note"]`
  (`saleshandy-webui .../triggers-and-activity/triggers-and-activity.tsx:176-187`). A plain string saves fine via the API but the UI shows "no action" — always PUT the array.
- `text-only-email`: `0` off, `1` remove styling automatically (tracking still works), `2` text only (forces open tracking off).
- `refold-qa-automation/.env` `HUBSPOT_ACCESS_TOKEN` has trailing text after a space — use `${L%% *}` (see `hubspot/staging/sequence-email-is-opened-in-saleshandy/hs.sh`).
