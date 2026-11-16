# Import Prospects from Salesforce: Regression scenarios (DRAFT, not saved to test-cases, waits for QA's "looks good")

Draft 2026-11-13. Built from the developer guide (`import-prospects-developer-guide.md`, TC1 to TC15) and our staging exploration (`import-prospects-progress.md`). Evidence by UI only (Prospects page, sequence, Logs tab). Defaults used until QA answers: small List Views only, no new Salesforce Contacts, Draft sequence only.
"(proposed, unconfirmed)" = Expected is not documented or not seen yet. "[developer]" = from the guide, not yet checked by QA on the product.

Environment: staging (pyxis), account `sfemailopened`, Salesforce org `saleshandy-dev-ed`, workflow v4. Import target: Draft sequence "Salesforce Import Prospects QA" (id 197853, never activated, sends nothing). No Jira ticket (QA said no sub-task).

Not covered: the 2000 Contacts limit (no List View that large), a mapped field deleted in Salesforce, production. Known and accepted, not a failure: the toast "Please select a Sequence Step before importing prospects." for Add Prospect alone (known webui bug, fix planned [developer]). Contacts with an invalid email are rejected by Saleshandy (data issue, not a workflow bug [developer]).

## Test data setup

- Each run is one click of "Import Prospects". It runs once. No schedule starts it. Creating a Contact does not start it [developer].
- Contacts only. One List View per activity [developer].
- Small List Views only. Birthdays This Month holds 1 Contact with the invalid email `b.levy@expressl&t.net`. Other views hold 92 to 590 Contacts. Which views are allowed is open (QA).
- Some rows need a special Contact: a full name, a last name only, no email, an Account, a comma in a value, or a changed Title.
- Those rows need a List View that holds such a Contact, or new Contacts. This is open (QA). Until then the rows stay "(proposed, unconfirmed)".
- Triggers & Activity: toggle "Import Prospects from Salesforce" on. Save, then reload. The button "Import Prospects" is enabled only after a saved activity exists.
- Field Mapping on `sfemailopened`: check `myNameProperty` to `AccountId` before the first run. A text value into a currency field can reject prospects [developer].
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
- A fresh account (no prospects, no saved activity) is needed for Baseline 1 and the empty-field rows. QA creates it. Until then those rows cannot run on `sfemailopened`.

## Prospects Import tab (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Toggle off, no saved activity | Open Settings > Integrations > Salesforce > Prospects Import | Toggle off. Activity select disabled. "Import Prospects" disabled | None |
| 2 | Toggle on | Open the activity select | Two activities: "Add Prospect in Saleshandy", "Move Prospect to another Sequence in Saleshandy". Both can be chosen together | None |
| 3 | Each activity | Open its Extra Configuration | Add Prospect: List View(while adding). Move: List View(while adding to Seq), Sequence, Sequence Steps (disabled until a Sequence is picked) | None |
| 4 | List View field open | Open the list | Contact views only, searchable: All Contacts, Bulk SMS Contacts, New Last Week, New This Week, Birthdays This Month, Recently Viewed Contacts, My Contacts | None |
| 5 | Add Prospect saved with a List View | Save the dialog, Save the page, reload, reopen the dialog | Saved List View shows | None |
| 6 | Move saved with List View, Sequence and Step in one dialog session | Save the dialog, Save the page, reload, reopen the dialog | Step shows as saved. Observed 2026-11-12 by script: Step was not saved, it saved only on a second pass. (proposed, unconfirmed) repeat by hand | None |
| 7 | Move saved with a List View and a Sequence | Click "Import Prospects" | Green message "Prospect import started successfully". It means the event was sent, not that prospects arrived | None |

## Add Prospect in Saleshandy

Extra Configuration: List View(while adding) = a small view, unless the row says another. Move not selected, with a Sequence and Step saved so the button works.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | List View with valid emails | Click "Import Prospects" | Logs row Success. Each Contact with a valid email is a prospect on the Prospects page. Not added to any sequence [developer] | None |
| 2 | Contact "Anna" "Van Dyke" in the view | Click "Import Prospects" | First Name Anna, Last Name Van Dyke [developer] | None |
| 3 | Contact with only a last name "Solo" | Click "Import Prospects" | First Name empty, Last Name Solo [developer] | None |
| 4 | Contact without an email | Click "Import Prospects" | No prospect for that Contact. Logs row Success, no error [developer] | None |
| 5 | Contact with the invalid email `b.levy@expressl&t.net` (Birthdays This Month) | Click "Import Prospects" | Logs row Success. No prospect on the Prospects page. This is expected [developer] | None |
| 6 | Contact with an Account, no Company mapping | Click "Import Prospects" | Prospect Company = Account name [developer] | None |
| 7 | Contact with Mobile Phone, Title, Department filled | Click "Import Prospects" | Prospect Phone Number, Job Title, Department equal the Salesforce values [developer] | None |
| 8 | Contact with a comma in a value, for example Title "SVP, Operations" | Click "Import Prospects" | Prospect Job Title shows the same text (proposed, unconfirmed) | None |
| 9 | Same view, prospects already imported | Click "Import Prospects" again | Same prospects updated. No second prospect for any email [developer] | None |
| 10 | Prospect imported, Title changed in Salesforce | Click "Import Prospects" | Prospect Job Title has the new value [developer] | None |
| 11 | List View(while adding) empty, Add Prospect saved | Click "Import Prospects" | Nothing imported. Logs row Success, no error [developer]. Toast about Sequence Step is the known webui bug | None |
| 12 | Each other view type: New Last Week, Recently Viewed Contacts, My Contacts | Click "Import Prospects" | Prospects equal the Contacts the view shows in Salesforce (proposed, unconfirmed, large views, QA decides) | None |
| 13 | Prospect already in Saleshandy with the same email, different Job Title and Phone Number | Click "Import Prospects" | Same prospect, no second one. Job Title and Phone Number have the Salesforce values (mapped fields update) [developer] | None |
| 14 | Prospect already in Saleshandy with a Department, Contact has an empty Department | Click "Import Prospects" | Department keeps its old value. An empty Salesforce value does not clear it [developer] | None |
| 15 | Prospect already in Saleshandy with a field that is not mapped | Click "Import Prospects" | The unmapped field keeps its old value (proposed, unconfirmed) | None |
| 16 | Prospect already in another sequence | Click "Import Prospects" | Prospect stays in that sequence. Records what happens to its data (proposed, unconfirmed) | None |
| 17 | View with some existing prospects and some new ones | Click "Import Prospects" | Count check: the Prospects total goes up only by the new emails. Every mapped field matches Salesforce for new and existing prospects | None |

## Move Prospect to another Sequence in Saleshandy

Extra Configuration: List View(while adding to Seq) = a small view, Sequence = "Salesforce Import Prospects QA", Sequence Steps = Step 1. Add Prospect not selected.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | View with valid emails | Click "Import Prospects" | Prospects are in the Draft sequence, Step 1. Sequence count goes up by the number of valid, new emails [developer] | None |
| 2 | Same view imported before | Click "Import Prospects" again | Sequence count does not change. No duplicate [developer] | None |
| 3 | Sequence picked, Step empty | Click "Import Prospects" | Toast "Please select a Sequence Step before importing prospects." No request sent | None |
| 4 | List View empty, Sequence and Step set | Click "Import Prospects" | Nothing imported. Logs row Success, no error [developer] | None |
| 5 | Active sequence, "Allow adding duplicate prospects in multiple sequences" off, prospect already in another sequence | Click "Import Prospects" | (proposed, unconfirmed) Prospect is not added. An Active sequence sends mail, so QA decides whether the row runs | None |

## Both activities

Extra Configuration: Add Prospect with a small view, Move with a small view, the Draft sequence, Step 1.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Both saved with valid emails | Click "Import Prospects" | One Logs row Success. Prospects exist, and the Draft sequence holds them. Both imports ran [developer] | None |
| 2 | Add Prospect with a List View, Move with an empty List View | Click "Import Prospects" | Only the Add Prospect import runs. Draft sequence count does not change [developer] | None |
| 3 | No activity chip, toggle on | Click "Import Prospects" | Nothing runs, no error [developer]. Observed 2026-11-12: the button is enabled with no chip | None |
| 4 | Remove the Add Prospect chip, reload | Reload the page | Chip stays removed. Observed 2026-11-12: the chip came back, Actions still held both values (proposed, unconfirmed, needs QA: bug or not) | None |
| 5 | Add Prospect dialog open | Press Escape | Activity chip is not selected without a List View. Observed 2026-11-12: chip stays selected (proposed, unconfirmed, needs QA: bug or not) | None |
