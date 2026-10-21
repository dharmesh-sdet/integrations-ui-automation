# UI gotchas

Things on the page that broke a walkthrough or a test, and how the code
handles them. Add one when it costs a failed run. Paths are under
`automation/src/`.

## Saleshandy

| Gotcha | Effect | Handled by |
|---|---|---|
| Left menu stays expanded over the page | Covered the trigger toggles until the test timed out [staging, 2026-10-08] | `SaleshandyPage.closeSidebar()` clicks a blank spot of the top bar |
| Trigger toggles have no accessible name | Cannot use `getByRole` with a name | Row found by CSS `div:has(> .switchToggle)` plus the trigger text (`hubspot-integration.page.ts`) |
| Trigger name spelling is "Hubspot" | Exact text match fails with "HubSpot" | Use the product's spelling |
| CRM list may already show the searched email at the top | Search looks done before it is | Wait for the "out of N" total to change (`crm.page.ts`) |
| Prospect dialog fields have no accessible name | | CSS plus label text, `SaleshandyCrmPage.field(label)` |
| Escape pressed inside an Extra Configuration list | Closed the whole modal, the next locator found nothing [staging, 2026-10-13] | Close a list by clicking its header again |
| Add to Sequence step list loads after the sequence is picked | An early click on "Sequence Steps" opened nothing and the test waited out its 20 minute timeout [staging, 2026-10-13] | `moveToStep()` clicks until the "Step N - Day" option shows (`sequence.page.ts`) |
| `{{` typed in the sequence step editor | Opens the variable picker and scrambles the text [staging, 2026-10-13] | Plain text without variables in test steps |
| Logs tab of a Saleshandy account that never ran a workflow shows "No logs yet" and no rows | `logEntries` waited for a row that never came and the test hit its timeout [staging, 2026-10-13] | Returns [] on "No logs yet" (`hubspot-integration.page.ts`) |
| Sequence Emails tab list does not update by itself after Send now | The send succeeded (request returned 201, "Email sent successfully" toast) but the row kept reading "Scheduled", so a check on the open page timed out [production, 2026-10-19; QA: the list had to be refreshed by hand] | `SaleshandySequencePage.sendNow()` reopens the Emails tab on each try until the row reads "Sent" |
| Sequence Emails tab renders a blank white page | The test waited for the Clicked column header until its 10 minute timeout (Link Clicked, Update a Contact 3); the re-run passed, cause not proven [staging, 2026-10-14] | Re-run the row; no script change |

## HubSpot

| Gotcha | Effect | Handled by |
|---|---|---|
| "Hi there, have any questions?" tooltip | Blocked "Add contacts" [staging, 2026-10-08] | `HubSpotPage.closePopups()` registers a locator handler that closes it |
| Page header has its own "Create new" button | Two matches for "Create new" | Menu item by `data-test-id="create-object-dropdown-create-object"` |
| Create contact form is in an iframe | Locators on the page find nothing | `contentFrame()` of `[data-test-id="object-builder-ui-iframe"]` |
| Job title disabled until Email is filled | | Fill Email first; `fill()` waits |
| City shows in both the Key information card and the All properties panel | Two matches, test stopped (run 2026-10-08 12:32) | Stay inside the panel's `[data-test-id^="group-accordion-"]` groups |
| Country/Region next to Country/Region Code | Partial label match picks the wrong one | Exact label match; tests edit only City, Company name, Job title [QA, 2026-10-08] |
| The contacts list shows the name link and a truncated email (`serena.caruso@mailinat...`) | A locator on the full email never matches, so a "does it exist" check always said no [staging, 2026-10-13] | Read the footer count ("1 contact", "0 contacts") instead (`email-opened-data-check.spec.ts`) |
| Create Contact panel says "This email address already belongs to a contact" | Job title stays disabled and Create never enables, the test ran into its timeout [staging, 2026-10-13] | Data: use new people; the check spec finds rows already in HubSpot |
| Create a Task: the task shows under "Upcoming" on the contact record | The script reported "Task not found on the HubSpot record (gave up after 180 seconds)" while the screenshot showed the task there. Cause not confirmed; the date text in that section is not read yet [staging, 2026-10-12] | Create a Task 1 and 2 passed later on 2026-10-13 [project: reply-received-progress.md]; how the reading was fixed is not recorded here |
| Logs entries are `role="button"` elements, not `<button>` tags, and the list renders several seconds after the page loads | A script that queries `button` finds no entries and returns an empty list; paging by script did not reload the list [staging, 2026-10-14] | Match on the 24-hex execution id in the element text; poll until the entries exist; use the MCP click on the snapshot ref for paging |
| Create Company: a company with the exact same domain already exists (every run reused the CSV domain) | The form turns to "Create a new company" and the Contact field is disabled; the test timed out at 5 minutes [staging, 2026-10-15] | Stamp the domain's first label per run (`runDomain` in `company-created.spec.ts`) |
| Create Company: the Contact dropdown stays open after a pick | The open list covers Create; clicks are intercepted [staging, 2026-10-15] | `createCompany` clicks Company name, then waits for the Search box to hide |
| Create Company: a click on the Contact field during the form's re-render opens nothing | `Search` box never shows [staging, 2026-10-15] | `createCompany` clicks again (up to 5 times) until it shows |
| A failed test restarts the worker and wipes module state | A module-level "created" Set is empty, so the next row creates the same contact and Create is disabled [2026-10-15] | Keep the list in a file (`createdFile` in `company-created.spec.ts`); `CREATED_LABELS` seeds it for reruns |
| A test that creates the row's HubSpot contact before the prospect is added fails in between (for example on "Done" in Saleshandy) | The row was marked used only after the prospect was added, so it stayed unused and the next run stopped with "HubSpot already has a contact with ..." [production, 2026-10-20, Unsubscribed smoke 02] | Mark the row used as soon as the contact exists: `flow.markUsed(row)` (`newContact` in `unsubscribed-smoke.spec.ts`); `markUsed` skips emails already listed |

## Shared waits

| Gotcha | Effect | Handled by |
|---|---|---|
| `waitForPageLoad`'s `networkidle` wait had no timeout of its own; a page that never goes fully idle (HubSpot Integration page is one) hung until the whole test's timeout fired | Playwright force-closed the browser mid-wait, surfacing as "Target page, context or browser has been closed" - reads like a crash, is actually a hang. Check this before assuming infra flakiness [staging, 2026-10-17, Unsubscribed lite: Baseline 1 hung and failed twice, passed clean right after the fix] | `waitForPageLoad` (`src/utils/wait.ts`) now bounds `networkidle` to 30 s with a catch, falling through to the existing `pageLoadProblem` content check either way |

## Playwright MCP servers

- `npm run mcp:open` (a visible window on `auth/<profile>`) does not help servers started with `--isolated`: they ignore the profile folder. Merge the cookies into the server's `--storage-state` file, then `/mcp` reconnect [staging, 2026-10-15].
