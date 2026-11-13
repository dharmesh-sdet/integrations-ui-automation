# Import Prospects from Salesforce: developer guide (staging, workflow v4)

Source: the developer, given to QA 2026-11-12 and pasted into the session. Last update by the developer
2026-11-12. Staging workflow version v4. The developer reports all five live tests passed on v4.
Marked [developer]. Not yet checked by QA against the product. See `import-prospects-progress.md`.

## 1. What the workflow does

It copies the Contacts of one Salesforce List View into Saleshandy as prospects. It does not run on a
schedule and does not run when a Contact is created. It runs once each time a user clicks "Import
Prospects" in Saleshandy.

| Action (UI label) | Value in configuration | Effect |
|---|---|---|
| Add Prospect in Saleshandy | `add-prospect-in-account` | Imports the Contacts of a List View as prospects. No sequence. |
| Move Prospect to another Sequence in Saleshandy | `add-prospect-in-sequence-step` | Imports the Contacts and adds them to one step of one sequence. |

Each action has its own List View. With both actions selected, both imports run in the same run.

## 2. Words

Refold is the platform that runs the workflow (old name Cobalt). Edge is the Saleshandy backend service
that gets the click and sends an event to Refold. Node is one step of the workflow. Run (execution) is one
pass, with an execution id. Contact Properties is the field mapping saved on the Salesforce integration
page. Upsert means create if new, update if it exists. A Draft sequence is not active and sends no email.

## 3. Where the user starts an import

Staging `https://pyxis.lifeisgoodforlearner.com`. Settings > Integrations > Salesforce > "Prospects
Import" tab. Turn on "Import Prospects from Salesforce", select an action and its List View, click
"Import Prospects" (lower right).

- Green message "Prospect import started successfully" only means Saleshandy sent the event to Refold.
  It does not mean prospects were imported.
- Known webui bug: the button always asks for a Sequence Step, also for "Add Prospect in Saleshandy"
  alone. Without a step: red message "Please select a Sequence Step before importing prospects." and no
  request goes out. Workaround: select any sequence and step; the Add Prospect path does not use them.
  Fix planned. File: `saleshandy-webui .../triggers-and-activity/triggers-and-activity.tsx` lines 157 to 169.
- The button is disabled with the tooltip "Enable workflow to import prospects" when the workflow is off.
- Reply "You haven't subscribed to prospect import event yet": the user's event subscription is missing
  in Saleshandy, so Refold gets nothing.

## 4. Configuration fields (staging ids)

| Field | Id | Used by | Value |
|---|---|---|---|
| Actions | `6953cbb078b14b0a0a13e9d1` | both | list, e.g. `["add-prospect-in-account"]` |
| List View(while adding) | `6953cbe578b14b0a0a13f014` | Add Prospect | Salesforce List View id |
| List View(while adding to Seq) | `6953cc0778b14b0a0a13fc54` | Sequence path | Salesforce List View id |
| Sequence Name | `6953cc2678b14b0a0a140942` | not read by the workflow | sequence id |
| Sequence Step | `6953cc4978b14b0a0a141587` | Sequence path | step hash id, e.g. `mlP0jL8YzX` |

Contact Properties (app field id `65deed90eafd626bace9b8dc`) belongs to the Salesforce integration, not
to this workflow. Other Salesforce workflows use it too.

| Item | Value |
|---|---|
| Workflow template id | `660b85b31a456de68ef10782` |
| Staging workflow id | `6953cb2678b14b0a0a13256e` |
| Refold app slug | `salesforce` |
| Staging test user / linked account | `80121` |
| Salesforce org (staging) | `https://saleshandy-dev-ed.develop.my.salesforce.com` |
| Developer's test sequence (Draft) | id `195939`, step hash `mlP0jL8YzX`, step id `463277` |

Our own draft sequence on `sfemailopened`: "Salesforce Import Prospects QA", id 197853.

List Views in the staging org on 2026-11-12 [developer]:

| List View | Id | Contacts |
|---|---|---|
| All Contacts | `00B5h00000eNPChEAO` | 590 |
| Bulk SMS Contacts | `00B5h00000eNPEIEA4` | 590 |
| New Last Week | `00B5h00000eNPGkEAO` | 92 |
| New This Week | `00B5h00000eNPGqEAO` | 228 |
| Birthdays This Month | `00B5h00000eNPGsEAO` | 1 |
| Recently Viewed Contacts | `00B5h00000eNPHWEA4` | 206 |
| My Contacts | `00B5h00000eNPHhEAO` | 572 |

Counts change over time. New This Week and New Last Week change every week.

## 5. What happens after the click

Chain: button, Saleshandy edge, Refold, Salesforce, Refold, Saleshandy import.

1. Webui sends `POST /api/edge/integration/import-prospect` with `{"stepId": "<step hash>", "appId": 3}` (3 = Salesforce).
2. Edge looks for the user's event subscription `sync-prospects`. If found, it sends the event to Refold with `step_id`.
3. Refold starts the workflow; the run shows in the workflow logs.

Common nodes:

| Node | Log name | What it does |
|---|---|---|
| 1 | Start | Receives the event. |
| 28 | Prepare - Actions | Reads Actions into a list. Removes an action when its List View is empty, and the sequence action when the Sequence Step is empty. Output `{"result":{"actions":[...],"skipped_actions":[...]}}`. |
| 10 | rule | Is `add-prospect-in-account` in the list? |
| 29 | Rule - Move to Sequence | Is `add-prospect-in-sequence-step` in the list? |

Add Prospect path (node 10 true): 2 Get Query (query behind the List View); 30 Build query - mapped fields
(keeps filter and sort of the List View, replaces the field list with `Id, Email, FirstName, LastName,
Account.Name` plus every Salesforce field in Contact Properties); 7 Saleshandy (gets prospect fields and
ids); 3 salesforce (runs the query, output `records` and `totalSize`); 16 Custom Code (one prospect per
Contact, skips Contacts without a valid email, counted in `skipped_without_email`); 6 rule (always true);
21 Custom Code (batches of 100); 20 Loop (nodes 23 and 22 per batch, two batches at a time); 23 builds
the body (`prospectList`, `conflictAction: "upsert"`, `verifyProspects: false`); 22 Add Prospect sends the
batch with the action "Add Prospect to Saleshandy Account".

Sequence path (node 29 true) is the same with nodes 9, 31, 11, 12, 17, 14, 24, 25, 27, 26. Node 9 uses
"List View(while adding to Seq)". Node 26 sends with the action "Add Prospect to the Saleshandy Sequence"
and the Sequence Step.

Nodes 5, 15, 18, 19 are old and not connected. The Refold log does not show nodes inside a loop (22, 23,
26, 27); it shows only the loop node (20 or 25) as Success.

## 6. How Salesforce fields become Saleshandy fields (nodes 16 and 17)

1. Email from `Email`.
2. First Name from `FirstName`, Last Name from `LastName`. No full-name split: "Anna Van Dyke" gives First "Anna", Last "Van Dyke".
3. Every other field comes from Contact Properties (e.g. `phoneNumber → MobilePhone`).
4. A mapping can point to an Account field, e.g. `Account.Name`.
5. Company: from the Company mapping if it exists, else from the Account name of the Contact.
6. All values go as text (1200.5 becomes "1200.5").
7. An empty Salesforce value is not sent and does not clear the Saleshandy value.
8. A Contact without a valid email is skipped, counted in `skipped_without_email`.
9. Upsert: an existing prospect with the same email is updated, not created again.

Staging mapping on 2026-11-12: firstName → FirstName, lastName → LastName, email → Email, phoneNumber →
MobilePhone, jobTitle → Title, department → Department, myNameProperty → AccountId. The last one is a
problem (section 8).

## 7. Developer's test cases (use small List Views; Draft sequence only for the sequence path)

| Id | Configuration | Salesforce data | Expected |
|---|---|---|---|
| TC1 | Add Prospect, one small List View | Contacts with valid emails | Node 3 `totalSize` = number of Contacts. Node 16 count = same minus Contacts without email. Edge log imported = that count, failed = 0. Prospects exist in Saleshandy. |
| TC2 | Same as TC1 | "Anna" / "Van Dyke" | First "Anna", Last "Van Dyke". |
| TC3 | Same as TC1 | Only last name "Solo" | First empty, Last "Solo". |
| TC4 | Same as TC1 | No email | Not imported. `skipped_without_email` = 1. No error. |
| TC5 | Same as TC1 | Invalid email, e.g. `b.levy@expressl&t.net` | Workflow sends it. Saleshandy rejects with `failed_reason: "Invalid Email"` (edge log). Expected. |
| TC6 | Same as TC1 | Contact with Account, no Company mapping | Company = Account name. |
| TC7 | Same as TC1 | MobilePhone, Title, Department filled | Phone Number, Job Title, Department match. |
| TC8 | Move to Sequence only, Draft sequence, small view | Valid emails | Node 10 false, node 29 true. Edge path `/contacts/sequence/<step id>`, failed = 0. Prospects in the step. |
| TC9 | Both actions, both views, step set | Valid emails | Both paths run. Run 100 %. Two imports in the edge log. |
| TC10 | Sequence action only, its List View or Step empty | Any | Node 28 `actions: []`, `skipped_actions` names the missing fields. Both rules false. COMPLETED, no error. Nothing imported. |
| TC11 | Add Prospect only, List View empty | Any | Node 28 skips the action. Nothing imported. No error. |
| TC12 | Run TC1 twice | Same Contacts | Second run updates. No duplicates. |
| TC13 | All Contacts, My Contacts, New This Week, New Last Week, Recently Viewed, a custom view | Any | Node 3 returns the same Contacts as the view in Salesforce. |
| TC14 | Change a Contact field in Salesforce, run TC1 again | Changed Title | Saleshandy Job Title has the new value. |
| TC15 | No action selected | Any | Node 28 `actions: []`. Nothing runs. No error. |

## 8. Known limits and issues [developer]

- Webui asks for a Sequence Step for every action (bug, fix planned). Select any step meanwhile.
- Maximum 2000 Contacts per List View per run (Salesforce returns up to 2000 in one response).
- A mapped field that does not exist in Salesforce makes the query fail and nothing is imported (for
  example a custom field deleted in Salesforce but still in Contact Properties).
- `myNameProperty → AccountId` on staging: "my name property" is a currency field in Saleshandy and
  AccountId is text (e.g. `0015h00001bHhUMAA0`). For a Contact with an Account, Saleshandy can reject the
  prospect. Remove or change the mapping.
- Run status COMPLETED does not mean prospects were imported. Saleshandy can reject a prospect after the
  run completes. Read the edge log.
- Nodes inside a loop are not in the Refold log. Use the edge log or the Prospects page.
- A value with a comma, e.g. "SVP, Operations": the edge error report showed it with quote marks. Seen only
  on a rejected prospect. Test on an accepted prospect.
- The Contact Created workflow also imports new Contacts every 3 hours. A test Contact can arrive through it.

## 9. How to see the result

Refold log (UI): workflow logs on the Salesforce integration page, newest run, read nodes 28, 30, 3, 16, 20.
A run that stops early (e.g. 40 %) means a node returned nothing or failed. Saleshandy UI: search the
Prospects page by email or last name, open the prospect; for the sequence path open the sequence and the
step. Edge log (Grafana, Pyxis Loki, datasource uid `P8E80F9AEF21F6940`), narrow time range:

```
{app="edge"} |= "80121" |~ "failedResults"
```

Keys per line: `path` (`/contacts/import` or `/contacts/sequence/<step id>`), `importedContactsMutated`
(created or updated), `failedResults` (one entry per rejected prospect with `failed_reason`). The edge log
is the only place that shows rejected prospects.

## 10. API calls (staging only)

Base `https://pyxis.lifeisgoodforlearner.com/api/edge`. Never `my.saleshandy.com` (production). Keep tokens
in a private file outside any repository. Never write a token into a test file, log or report.

1. Login: `POST $SH_BASE_URL/auth/v2/login` with `{"email","password"}`. Token `.payload.accessToken`.
   Staging asks for no Turnstile token.
2. Refold token: `POST https://app.refold.ai/api/v2/public/session-token` with header `x-api-key:
   $REFOLD_ORG_API_KEY` and body `{"linked_account_id":"80121"}`. Token `.token`.
3. Read configuration (read only): `GET https://app.refold.ai/api/v2/public/slug/salesforce/config/80121?fields=true`
   with headers `x-api-key` and `linked_account_id: 80121`. Read `.workflows[] | select(.id=="6953cb2678b14b0a0a13256e")`.
4. Change one field: `PUT https://app.refold.ai/api/v2/public/config/field/<field id>?workflow_id=6953cb2678b14b0a0a13256e`
   with `Authorization: Bearer $REFOLD_LA_TOKEN`, `slug: salesforce`, body `{"value": ...}`. Actions is a
   list; a List View or Step is a string; clear with `{"value": null}`. Save the old value first, put it
   back after.
5. Start import (same as the button): `POST $SH_BASE_URL/integration/import-prospect` with
   `{"stepId":"","appId":3}`. An empty `stepId` is accepted. For the sequence path send the step hash.
   Expect `{"payload":{"message":"Prospect import started successfully","status":1}}`.
6. Find the run: `GET .../public/execution?slug=salesforce&workflow_id=6953cb2678b14b0a0a13256e&page=1&limit=1&sort=-createdAt`,
   then `GET .../public/execution/<execution id>`. Read `.status`, `.completion_percentage`, `.nodes[]`.
   A large List View takes some seconds. Read again until `COMPLETED`.
7. Find a prospect: `POST $SH_BASE_URL/contacts/list` with `{"pageNum":1,"pageSize":5,"search":"<last name or email part>"}`;
   then `GET $SH_BASE_URL/contacts/<prospect id>`, read `.payload.attributes[]`. Search by last name or
   plain part of the email. A search with `+` returns nothing.
8. Salesforce read only: `GET $SF_INSTANCE_URL/services/data/v58.0/sobjects/Contact/listviews/<id>/results?limit=2000`
   (`.size` = number of Contacts) and `.../describe` (`.query` = SOQL). Token is the Salesforce session id.
9. Draft check before a sequence test: `GET $SH_BASE_URL/sequences/195939`, `.payload.progress`: 1 Active, 2 Paused, 3 Draft.

## 11. Developer's live results on staging (user 80121, 2026-11-12)

| Test | Version | Execution id | Setup | Result |
|---|---|---|---|---|
| T1 | v3 | `6af58d9f7221682c3f77e542` | Add Prospect, Birthdays This Month (1) | Failed. Node 3 returned `[]`. Fixed in v4. |
| T4 | v3 | `6af58e065b5422839e0a243c` | Sequence only, List View and Step empty | Passed. Node 28 skipped the action. |
| T1 again | v4 | `6af590465b5422839e0b29a2` | Add Prospect, Birthdays This Month (1) | Workflow passed. Saleshandy rejected the one Contact: "Invalid Email" (`b.levy@expressl&t.net`, Salesforce sample data). |
| T2 | v4 | `6af590a988127c587b01f768` | Add Prospect, New Last Week (92) | Passed. 92 imported, 0 failed. Department and Job Title correct. |
| T3 | v4 | `6af5912dc43d16b416e9c30e` | Sequence only, New Last Week, Draft sequence 195939 | Passed. 92 added to step 463277, 0 failed. |
| T5 | v4 | `6af591569eb8ca609e174656` | Both actions | Passed. Both imports 92, 0 failed. 100 %. No duplicates. |

Configuration was put back afterwards: Actions `["add-prospect-in-account"]`, List View All Contacts,
other fields empty. The 92 developer test prospects are still in Draft sequence 195939. Not tested by the
developer: TC2, TC3, TC4, TC6 with a real Contact, TC13 for every view type, TC14, a view with more than
2000 Contacts, a comma value on an accepted prospect.

## 12. Rules for automated testers [developer]

1. Staging only. No request to `my.saleshandy.com` or the production Salesforce org.
2. No tokens or passwords in repo files, logs or reports.
3. Before a test, read and save the workflow configuration. After, put every changed field back and read it again to match the saved copy.
4. Small List Views. No All Contacts or My Contacts without approval.
5. Sequence path: Draft sequence only, check before each test.
6. No create, change or delete of Salesforce records without approval.
7. COMPLETED is not a pass. A pass needs the edge log with `failed` = 0 for the expected prospects, or the prospects found in Saleshandy with the expected values.
8. "Invalid Email" from bad Salesforce data is a data issue, not a workflow bug.
9. Report each result with the execution id, node ids and evidence.

## 13. Before production release [developer]

1. The production workflow must be the v4 file `integration-tests/salesforce/staging/import-prospects-from-salesforce/v4-no-pagination.json` (saleshandy-edge working folder of Rudra).
2. Saleshandy action ids are the same on staging and production: `644a7f4e9aac4fbbe68862cf` (Add Prospect to Saleshandy Account), `64634203c7f3ab6e2bf5295e` (Add Prospect to the Saleshandy Sequence), `6578300bc002b2b9b4f15c37` (Get Prospect Fields).
3. The production workflow id must be in the webui list `salesforceImportProspectWorkflowIds`.
4. The production Contact Properties of the test account must have no text-to-currency mapping like `myNameProperty → AccountId`.
5. Run TC1 on production with a List View of 1 to 5 Contacts. The edge log must show `failed` = 0.
6. Rollback: `v1-original.json` in the same folder. v1 cannot import anything.

## 14. Version history [developer]

v1 original (name split by space, mapped fields not fetched, mapping text not read, empty Actions crashed,
with both actions only one path ran, wrong action for Add Prospect, node 3 returned nothing; never
imported a prospect). v2 new node 28, rule 29, nodes 30 and 31, new mapping code in 16 and 17, Add Prospect
action in node 22. v3 node 28 skips an action with empty settings, Company falls back to the Account name.
v4 pagination removed from nodes 3 and 12 (with pagination on, node 3 returned an empty list; same fix as
Lead workflow v7). Files: `integration-tests/salesforce/staging/import-prospects-from-salesforce/` in the
saleshandy-edge working folder (every version, `test-log.md`, patch scripts, raw runs in `runs/`).
