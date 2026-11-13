# Import Prospects from Salesforce: Regression scenarios (QA looks good, 2026-11-13)

Approved by QA 2026-11-13. Cut from 34 rows to 21 on 2026-11-13 (QA): one row for each test of `tests/salesforce/import-prospects.spec.ts`, rows that share one click are merged. Add Prospect 16 (prospect in another sequence) was dropped. Built from the developer guide (`import-prospects-developer-guide.md`, TC1 to TC15) and our staging exploration (`import-prospects-progress.md`). Evidence by UI only (Prospects page, sequence, Logs tab). QA answers 2026-11-13: evidence by UI, new Contacts allowed (6 made), Draft sequence only, fresh account.
"(proposed, unconfirmed)" = Expected is not documented or not seen yet. "[developer]" = from the guide, not yet checked by QA on the product.

Environment: staging (pyxis), account `importprospects` (fresh, QA 2026-11-13, no email accounts connected), Salesforce org `saleshandy-dev-ed`, workflow v4. Import target: Draft sequence "Salesforce Import Prospects QA" (id 197856, never activated, sends nothing). No Jira ticket (QA said no sub-task).

Post release, still open: AL-4228 (a removed activity chip comes back after a reload), fixed after the release (developer comment 2026-11-13: same behavior on HubSpot, not blocking). Row 21 shows it. Do not treat it as a failure.

Not covered: the 2000 Contacts limit (no List View that large), a mapped field deleted in Salesforce, production. Known and accepted, not a failure: the toast "Please select a Sequence Step before importing prospects." for Add Prospect alone (known webui bug, fix planned [developer]). Contacts with an invalid email are rejected by Saleshandy (data issue, not a workflow bug [developer]).

## Test data setup

- Each run is one click of "Import Prospects". It runs once. No schedule starts it. Creating a Contact does not start it [developer].
- Contacts only. One List View per activity [developer].
- Main data: the custom List View "Import Prospects QA" (Contact, filter Mailing City equals Rotterdam, All contacts, all users). It holds exactly 6 Contacts, made by `scripts/make-salesforce-import-prospects-contacts.ts` (ids in `test-data/salesforce/import-prospects-contacts.txt`): Anna Van Dyke (full data, Account), Solo (last name only), Jonas Lindqvist (no email), Priya Raman (Title "SVP, Operations"), Marek Novak (no Department), Elise Dubois (added by hand in Saleshandy first).
- Birthdays This Month holds 1 Contact with the invalid email `b.levy@expressl&t.net`. Other views hold 92 to 590 Contacts and are used only for the rows that say so.
- Triggers & Activity: toggle "Import Prospects from Salesforce" on. Save, then reload. The button "Import Prospects" is enabled only after a saved activity exists.
- Field Mapping on `importprospects`: First Name, Last Name, Email, Phone Number to Business Phone, Department, Job Title to Title. Company is not mapped. The pair `myNameProperty` to `AccountId` is not set. It can reject prospects [developer].
- Check the result in Saleshandy > Prospects (search by last name or email), in the sequence, and in Settings > Integrations > Salesforce > Logs. The Logs tab shows Success only. A rejected Contact shows on the Prospects page as missing, not in Logs [developer].
- Write down what the Prospects Import tab holds before each row. Restore it after the row.

## How to check the data

Seen on staging 2026-11-13 [staging], page CRM > All Prospects (`/crm/list`), read only.

- The list has these columns: Name, Email, Job Title, Latest Status, Sequence Associated, Prospect Outcomes, Prospect Tags.
- It also has: Email Verification Status, Last Contacted, Department, Company, Company Industry, Industry, Company Website. It shows 25 prospects a page. The total shows as "out of N" (645 on `sfemailopened`).
- The icon at the end of the header opens "Edit Table Column". You choose which fields show in the table.
- The Export button exists. It is not clicked yet, so we do not know what it sends or where.
- Unknown so far: if Phone Number can be a column, and which page sizes exist. If Phone Number is not a column, open the prospect to read it.
- Method: a script reads the expected values from Salesforce for the List View. It then reads the same prospects from the table and compares each mapped field. A mismatch lists the email, the field, the expected value and the value found.
- Count check in every import row: new prospects = Contacts with a valid email, counted once per email, minus emails that already exist in Saleshandy. A Contact without an email must not create a prospect.
- Update rows: before the import, add 3 or 4 prospects by hand with the same emails as some Contacts and a different Job Title or Phone Number.
- The account `importprospects` is fresh: no prospects, no saved activity. Baseline 1 and the empty-field rows run first, before any activity is saved. Saved values may not clear again.

## Prospects Import tab

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New account, toggle off, no saved activity | Open Settings > Integrations > Salesforce > Prospects Import | Toggle off. Activity select disabled. "Import Prospects" disabled | None |
| 2 | Toggle on | Open the activity select | Two activities: "Add Prospect in Saleshandy" and "Move Prospect to another Sequence in Saleshandy". Both can be chosen together | None |
| 3 | Toggle on, no activity chip on the page | Click "Import Prospects" | Nothing runs, no error (proposed, unconfirmed) | None |
| 4 | Add Prospect dialog, Move dialog, List View list | Open each dialog and the List View list, then press Escape on a new Move dialog | Add: List View(while adding). Move: List View(while adding to Seq), Sequence, Sequence Steps. List: 7 Contact views, no Lead views. Escape leaves no chip without a List View (proposed, unconfirmed, QA could not reproduce it) | None |

## Empty configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Add Prospect saved with an empty List View | Click "Import Prospects" | Nothing imported, no Logs error. The "Please select a Sequence Step" toast is the known webui bug | None |
| 6 | Move saved with Sequence and Step, empty List View | Save the dialog, reload, reopen it, click "Import Prospects" | Step is still saved. Nothing imported. (Seen 2026-11-12: Step was not saved in one session, Needs QA) | None |

## Add Prospect in Saleshandy

List View "Import Prospects QA" unless the row says another.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | View Birthdays This Month, one Contact with the invalid email `b.levy@expressl&t.net` | Click "Import Prospects" | Logs Success. No prospect | None |
| 8 | The 6 new Contacts, Move has no List View | Save the List View, reload, click "Import Prospects" | Saved List View shows after reload. Message "Prospect import started successfully". One prospect per Contact with an email (5), in no sequence. The total goes up by 5 | None |
| 9 | Contact "Anna" "Van Dyke" | Same import | First Name Anna, Last Name Van Dyke | None |
| 10 | Contact with only a last name "Solo" | Same import | First Name empty, Last Name Solo | None |
| 11 | Contact without an email | Same import | No prospect for that Contact | None |
| 12 | Contact with an Account, no Company mapping | Same import | Company = Account name | None |
| 13 | Contact with Phone, Title, Department filled | Same import | Phone Number, Job Title, Department equal the Salesforce values | None |
| 14 | Title with a comma, "SVP, Operations" | Same import | Job Title shows the same text (proposed, unconfirmed) | None |
| 15 | View "My Contacts" (the Salesforce user Saleshandy is connected as owns many Contacts), all prospects deleted first | Select Add Prospect with "My Contacts", click "Import Prospects" | Total prospects = unique Contacts of that user that have a valid email. A Contact whose email is already a prospect adds none. (Verified by hand by QA 2026-11-13, not scripted) - Pass | None |

## Existing prospects

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 16 | Prospects already exist. Salesforce: Anna's Title changed, Elise's Phone changed, new Contact Hana. Saleshandy by hand: Elise's Job Title and Company Industry edited, Marek's Department set (empty in Salesforce) | Click "Import Prospects" again | Total goes up by 1 only, one prospect per email. Anna and Elise Job Title take the Salesforce value. Marek's Department and Elise's Company Industry are kept. Elise's Phone Number: new number added, old one kept as the second (proposed, unconfirmed, QA verdict open) | None |

## Move Prospect to another Sequence in Saleshandy

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 17 | Move List View set, Draft sequence, Step 1 (Add Prospect also saved) | Click "Import Prospects" | One Logs row Success. Every prospect with an email shows the Draft sequence, Step 1 | None |
| 18 | Same view imported again | Click "Import Prospects" | Total does not change. No duplicates | None |
| 19 | Sequence picked, Step empty | Click "Import Prospects" | Skipped, needs a second fresh account | None |
| 20 | Prospect in another Active sequence, duplicate setting off | Click "Import Prospects" | Skipped, an Active sequence sends mail | None |

## Both activities

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 21 | Saved Add Prospect chip | Click the X, reload | Chip stays removed (seen: it returns, post release) | AL-4228 |
