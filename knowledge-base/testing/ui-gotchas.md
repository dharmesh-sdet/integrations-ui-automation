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

## HubSpot

| Gotcha | Effect | Handled by |
|---|---|---|
| "Hi there, have any questions?" tooltip | Blocked "Add contacts" [staging, 2026-10-08] | `HubSpotPage.closePopups()` registers a locator handler that closes it |
| Page header has its own "Create new" button | Two matches for "Create new" | Menu item by `data-test-id="create-object-dropdown-create-object"` |
| Create contact form is in an iframe | Locators on the page find nothing | `contentFrame()` of `[data-test-id="object-builder-ui-iframe"]` |
| Job title disabled until Email is filled | | Fill Email first; `fill()` waits |
| City shows in both the Key information card and the All properties panel | Two matches, test stopped (run 2026-10-08 12:32) | Stay inside the panel's `[data-test-id^="group-accordion-"]` groups |
| Country/Region next to Country/Region Code | Partial label match picks the wrong one | Exact label match; tests edit only City, Company name, Job title [QA, 2026-10-08] |
