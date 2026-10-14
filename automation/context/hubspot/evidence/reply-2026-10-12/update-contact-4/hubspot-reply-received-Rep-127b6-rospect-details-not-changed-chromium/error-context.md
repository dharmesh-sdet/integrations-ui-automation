# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hubspot/reply-received.spec.ts >> Reply is received in Saleshandy >> Update a Contact in HubSpot > 4: Contact in HubSpot, prospect details not changed
- Location: src/flows/activity-rows.ts:541:5

# Error details

```
Error: HubSpot City

expect(locator).toBeVisible() failed

Locator: locator('[data-test-id^="group-accordion-"]').getByRole('button', { name: /^City View property history.* --$/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - HubSpot City locator('[data-test-id^="group-accordion-"]').getByRole('button', { name: /^City View property history.* --$/ }) with timeout 5000ms
  - waiting for locator('[data-test-id^="group-accordion-"]').getByRole('button', { name: /^City View property history.* --$/ })

```

```yaml
- iframe
- banner:
  - link "HubSpot logo":
    - /url: /start-guide/247419080
    - img "HubSpot logo"
  - searchbox "Find in HubSpot"
  - img
  - button "Open Breeze Assistant":
    - img
    - text: Breeze Assistant
  - navigation "Global toolbar":
    - menu:
      - menuitem "Upgrade":
        - link "Upgrade":
          - /url: https://app-na2.hubspot.com/pricing/247419080/upgrade?upgradeSource=global-nav-bar
          - img
          - text: Upgrade
      - button "Create new":
        - img
      - menuitem "Calls":
        - button "Calls":
          - img "Calling"
      - menuitem "Marketplace":
        - button "Marketplace"
      - menuitem "Help":
        - button "Help":
          - img "Help"
      - menuitem "Settings":
        - link "Settings":
          - /url: /sales-products-settings/247419080/contacts?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
      - 'menuitem "Notifications: 2 unseen"':
        - 'button "Notifications: 2 unseen"':
          - img
      - text: "2"
      - menuitem "View profile and more":
        - button "View profile and more":
          - img "Deal Dharmesh"
          - text: Saleshandy
          - img
- button "Scroll up":
  - img
- navigation:
  - menu:
    - menuitem "Home"
    - menuitem "Contacts"
    - menuitem "Companies"
    - menuitem "Deals"
    - menuitem "Tasks"
    - menuitem "Segments"
    - button "Marketing" [expanded]
    - group:
      - menuitem "Marketing Emails"
    - button "Sales" [expanded]
    - group:
      - menuitem "Prospecting Agent":
        - text: Prospecting Agent
        - img
    - button "Platform" [expanded]
    - group:
      - menuitem "Workflows":
        - text: Workflows
        - img
    - menuitem "More"
    - link "Upgrade to Starter":
      - /url: /pricing/247419080/upgrade/suite-starter?upgradeSource=side-nav-spotlight
- button "Manage navigation"
- button "Scroll down":
  - img
- iframe
- iframe
- complementary:
  - navigation:
    - link "Contacts":
      - /url: https://app-na2.hubspot.com/contacts/247419080/objects/0-1/restore
  - button "Actions"
  - button:
    - img
  - heading "Rina Okabe" [level=2]
  - button "Edit"
  - text: Account Executive
  - link "rina.okabe@mailinator.com Link opens in a new window":
    - /url: mailto:rina.okabe@mailinator.com
    - text: rina.okabe@mailinator.com
    - img "Link opens in a new window"
  - button "Copy"
  - list:
    - button "Create a note"
    - text: Note
    - button "Create an email"
    - text: Email
    - button "Make a phone call"
    - text: Call
    - button "Create a task"
    - text: Task
    - button "Schedule a meeting"
    - text: Meeting
    - button "More activities, menu pop up"
    - text: More
  - button "Key information" [expanded]
  - button "Actions"
  - link:
    - /url: https://app-na2.hubspot.com/layout-editor/247419080/CRM_RECORD_LEFT/0-1/edit/HubspotProvided-CRM_RECORD_PAGE%3A%7C%3A0-1/card-builder/PROPERTIES_V3%2F0-1%2FV2?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
  - list:
    - button "Contact owner View property history Copy value More actions Deal Dharmesh":
      - text: Contact owner
      - button "View property history"
      - button "Copy value"
      - button "More actions"
      - text: Deal Dharmesh
    - button "Phone Number View property history Call with device More actions +1 555-0240-9364":
      - text: Phone Number
      - button "View property history"
      - link "Call with device":
        - /url: tel:+1 555-0240-9364
      - button "More actions"
      - text: +1 555-0240-9364
    - button "City View property history Copy value More actions Kobe":
      - text: City
      - button "View property history"
      - button "Copy value"
      - button "More actions"
      - text: Kobe
    - button "Lifecycle Stage View property history Copy value More actions Sales Qualified Lead":
      - text: Lifecycle Stage
      - button "View property history"
      - button "Copy value"
      - button "More actions"
      - text: Sales Qualified Lead
    - button "Lead Status View property history Copy value More actions Connected":
      - text: Lead Status
      - button "View property history"
      - button "Copy value"
      - button "More actions"
      - text: Connected
    - text: Last Contacted
    - button "View property history"
    - button "More actions"
    - text: "--"
    - button "Subscription status View property history More actions --":
      - text: Subscription status
      - button "View property history"
      - button "More actions"
      - text: "--"
    - button "Preferred email type View property history More actions --":
      - text: Preferred email type
      - button "View property history"
      - button "More actions"
      - text: "--"
    - button "Engagement level View property history More actions --":
      - text: Engagement level
      - button "View property history"
      - button "More actions"
      - text: "--"
    - text: Role
    - button "View property history"
    - button "More actions"
    - button "Role --": "--"
- navigation:
  - button "Catch-up"
  - button "Activities"
- link "Customize":
  - /url: https://app-na2.hubspot.com/sales-products-settings/247419080/object/0-1/record-customization?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
- button "Overview" [expanded]
- heading "Contact insights" [level=5]
- text: AI
- link:
  - /url: https://app-na2.hubspot.com/layout-editor/247419080/CRM_RECORD_MIDDLE/0-1/edit/HubspotProvided-CRM_RECORD_PAGE%3A%7C%3A0-1/card-builder/COMPANY_DESCRIPTION-FAS-0-1-0?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
- paragraph: Generated October 12, 2026 5:55 PM
- button
- paragraph: No recent activities or communications are recorded. Add activities or associations to see an updated summary.
- button "app-na2.hubspot.com 1 Source":
  - img "app-na2.hubspot.com"
  - paragraph: 1 Source
- button
- button "Ask a question"
- heading "Recent interactions" [level=5]
- text: AI
- img "empty-state-charts illustration"
- paragraph: No activity on this record.
- button "More activities, menu pop up": Create activity
- button "Health" [expanded]
- heading "Sentiment" [level=5]
- heading "Challenges" [level=5]
- heading "Positive feedback" [level=5]
- button "Collapse sidebar"
- complementary:
  - button "Companies (0)" [expanded]
  - button "Add"
  - link "Manage card settings":
    - /url: https://app-na2.hubspot.com/layout-editor/247419080/CRM_RECORD_RIGHT/0-1/edit/HubspotProvided-CRM_RECORD_PAGE%3A%7C%3A0-1/card-builder/ASSOCIATION_V3%2F0-2?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
  - alert:
    - img "empty-state-charts illustration"
    - text: See the businesses or organizations associated with this record.
  - button "Deals (0)" [expanded]
  - button "Add"
  - link "Manage card settings":
    - /url: https://app-na2.hubspot.com/layout-editor/247419080/CRM_RECORD_RIGHT/0-1/edit/HubspotProvided-CRM_RECORD_PAGE%3A%7C%3A0-1/card-builder/ASSOCIATION_V3%2F0-3?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
  - alert:
    - img "empty-state-charts illustration"
    - text: Track the revenue opportunities associated with this record.
  - button "Tickets (0)" [expanded]
  - button "Add"
  - link "Manage card settings":
    - /url: https://app-na2.hubspot.com/layout-editor/247419080/CRM_RECORD_RIGHT/0-1/edit/HubspotProvided-CRM_RECORD_PAGE%3A%7C%3A0-1/card-builder/ASSOCIATION_V3%2F0-5?eschref=%2Fcontacts%2F247419080%2Frecord%2F0-1%2F566952745666
  - alert:
    - img "empty-state-charts illustration"
    - text: Track the customer requests associated with this record.
  - button "Payments" [expanded]
  - button "Attachments" [expanded]
- complementary
- button "Close"
- banner:
  - heading "Rina Okabe -All Properties" [level=2]:
    - text: Rina Okabe
    - paragraph: "-All Properties"
- searchbox "Search property": City
- button "Clear input"
- link "Manage properties Link opens in a new window":
  - /url: /property-settings/247419080/properties?type=0-1
  - text: Manage properties
  - img "Link opens in a new window"
- checkbox "Hide blank properties"
- text: Hide blank properties
- button "Copy search results"
- button "Contact information 1 of 81 properties" [expanded]
- button "City View property history Copy value More actions Kobe":
  - text: City
  - button "View property history"
  - button "Copy value"
  - button "More actions"
  - text: Kobe
- button "Conversion information 1 of 16 properties" [expanded]
- text: IP city
- button "View property history"
- button "More actions"
- text: "--"
```

# Test source

```ts
  17  | import type { SaleshandyCrmPage } from '../pages/saleshandy/crm.page.ts';
  18  | import type { HubSpotIntegrationPage } from '../pages/saleshandy/hubspot-integration.page.ts';
  19  | import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
  20  | import { stopOnErrorLogs, untilPasses } from '../utils/wait.ts';
  21  | 
  22  | // Page objects a trigger step may need (fixtures from src/fixtures/index.ts).
  23  | export type FlowContext = {
  24  |   sequence: SaleshandySequencePage;
  25  |   integration: HubSpotIntegrationPage;
  26  |   mailinator?: MailinatorPage;
  27  |   crm?: SaleshandyCrmPage;
  28  | };
  29  | 
  30  | export type FlowConfig = {
  31  |   // Trigger name as Triggers & Activity and Logs show it, e.g. 'Link is Clicked in Saleshandy'.
  32  |   trigger: string;
  33  |   // Sequence the prospects are added to (one per workflow account).
  34  |   sequenceId: string;
  35  |   // Workflow CSV under test-data/, e.g. 'hubspot/link-clicked.csv'.
  36  |   csv: string;
  37  |   // The workflow's own trigger event, done after the step's email is sent
  38  |   // (Email Sent: nothing). `step` is 1 unless a row needs the event on step 2
  39  |   // (e.g. Reply rows that reply to the follow-up). `link` is the 0-based link
  40  |   // of the email for "click the second link" rows (Link Clicked only; other
  41  |   // workflows fire the same event again).
  42  |   fireEvent: (ctx: FlowContext, row: Row, step: number, link?: number) => Promise<void>;
  43  |   // True when `fireEvent` can fire the event on the step 2 email (rows that
  44  |   // continue "from row N, step 2 sent"). Default false: those rows are not added.
  45  |   step2Events?: boolean;
  46  |   // True when the shared "second event on the same email" row (Update a deal
  47  |   // 3) should be added. Default false: Reply Received writes its own.
  48  |   secondEventRows?: boolean;
  49  |   // True when step 1 should be sent with "Send now" right after the prospect
  50  |   // is added, instead of waiting for Saleshandy's own send (QA, 2026-10-12, for
  51  |   // Link Clicked). Default false: single prospects wait for Saleshandy.
  52  |   sendStep1Now?: boolean;
  53  |   // Subject of the step 1 email, for checks on the logged email (optional).
  54  |   emailSubject?: string;
  55  |   // Texts the HubSpot note must contain. Default: Step, Variant and the
  56  |   // prospect's email, which every Saleshandy-side workflow writes (Reply
  57  |   // Received: Step 1, Variant A, empty Latest Outcome). Return [] to skip.
  58  |   noteContains?: (row: Row, step: number) => string[];
  59  |   // Texts the logged email activity must contain. Default: the step 1
  60  |   // subject when `emailSubject` is set, else the prospect's full name.
  61  |   loggedEmailContains?: (row: Row, step: number) => string[];
  62  | };
  63  | 
  64  | export const fullName = (r: Row) => `${r['First Name']} ${r['Last Name']}`;
  65  | 
  66  | // Mapped fields checked on every contact (QA: tests edit only City, Company
  67  | // name and Job title, so these labels are unambiguous).
  68  | export const mapped = (r: Row) => ({ 'Job title': r['Job Title'], City: r['City'], 'Company name': r['Company'] });
  69  | 
  70  | // Create a Deal Extra Configuration used by the deal rows; Closing Date varies.
  71  | export const dealConfig = (closingDays: string) => ({
  72  |   'Select Pipeline (when to create)': 'Sales Pipeline',
  73  |   'Select Pipeline Stage (when to create)': 'Initial Contact',
  74  |   'Deal Type (while creating)': 'New Business',
  75  |   'Deal Priority (while creating)': 'High',
  76  |   'Closing Date (while creating)': closingDays,
  77  | });
  78  | 
  79  | // Update a Deal Extra Configuration (labels seen 2026-10-09), same values as
  80  | // Create a Deal; Closing Date varies.
  81  | export const dealUpdateConfig = (closingDays: string) => ({
  82  |   'Select Pipeline (when to update)': 'Sales Pipeline',
  83  |   'Select Pipeline Stage (when to update)': 'Initial Contact',
  84  |   'Deal Type (while updating)': 'New Business',
  85  |   'Deal Priority (while updating)': 'High',
  86  |   'Closing Date (while updating)': closingDays,
  87  | });
  88  | 
  89  | // A date N days from today as the deal header shows it, MM/DD/YYYY (e.g.
  90  | // "10/10/2026", seen 2026-10-09; the contact's Deals card uses "October 10, 2026").
  91  | export const daysFromToday = (days: number) => {
  92  |   const d = new Date();
  93  |   d.setDate(d.getDate() + days);
  94  |   return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  95  | };
  96  | 
  97  | // Waits until the contact has `expectedCount` deals and returns the ones not
  98  | // in `existingNames` (the deals the test made itself).
  99  | export async function newDealsOf(contacts: HubSpotContactsPage, contactId: string, expectedCount: number, existingNames: string[]) {
  100 |   let fresh: { id: string; name: string }[] = [];
  101 |   await untilPasses('New deal not on the contact in HubSpot', async () => {
  102 |     const list = await contacts.associations(contactId, 'deals');
  103 |     expect(list.count, 'deals on the contact').toBe(expectedCount);
  104 |     fresh = list.records.filter((r) => !existingNames.includes(r.name));
  105 |   });
  106 |   return fresh;
  107 | }
  108 | 
  109 | // Checks HubSpot contact properties (label to expected value; "--" is empty).
  110 | export async function expectContact(contacts: HubSpotContactsPage, row: Row, values: Record<string, string>): Promise<void> {
  111 |   let id = '';
  112 |   await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
  113 |     id = await contacts.findContactId(row['Email'], fullName(row));
  114 |   });
  115 |   await contacts.openAllProperties(id);
  116 |   for (const [label, value] of Object.entries(values)) {
> 117 |     await expect(await contacts.propertyRow(label, value), `HubSpot ${label}`).toBeVisible();
      |                                                                                ^ Error: HubSpot City
  118 |   }
  119 | }
  120 | 
  121 | export function createFlow(cfg: FlowConfig) {
  122 |   const { trigger, sequenceId, csv } = cfg;
  123 |   const rows = readCsv(csv);
  124 |   const sideCsv = (suffix: string) => {
  125 |     try {
  126 |       return readCsv(csv.replace(/\.csv$/, `-${suffix}.csv`));
  127 |     } catch {
  128 |       return [];
  129 |     }
  130 |   };
  131 | 
  132 |   const rowFor = (scenario: string): Row => {
  133 |     const row = rows.find((r) => r['Scenario'] === scenario);
  134 |     if (!row) throw new Error(`No row "${scenario}" in test-data/${csv}`);
  135 |     return row;
  136 |   };
  137 | 
  138 |   // Every other trigger off, this one on, and no activity left selected from earlier rows.
  139 |   async function startClean(integration: HubSpotIntegrationPage): Promise<void> {
  140 |     await integration.openTriggers();
  141 |     await integration.enableOnly(trigger);
  142 |     for (const activity of await integration.selectedActivities(trigger)) {
  143 |       await integration.removeActivity(trigger, activity);
  144 |     }
  145 |     await expect.poll(() => integration.selectedActivities(trigger), 'activities left selected').toEqual([]);
  146 |   }
  147 | 
  148 |   // Selects only `activity` and saves its Extra Configuration with `values`
  149 |   // (label to option). With `values` empty nothing is chosen ("skipped"); if
  150 |   // the activity already has saved values (checked on `labels`), the row cannot
  151 |   // run here and is skipped: saved Extra Configuration can never be cleared.
  152 |   async function useOnly(integration: HubSpotIntegrationPage, activity: string, values: Record<string, string>, labels: string[]): Promise<void> {
  153 |     await startClean(integration);
  154 |     await integration.selectActivity(trigger, activity);
  155 |     if (Object.keys(values).length === 0) {
  156 |       const saved = [];
  157 |       for (const label of labels) {
  158 |         const text = (await integration.configDropdown(label).innerText()).trim();
  159 |         if (text !== 'Select') saved.push(`${label}: ${text}`);
  160 |       }
  161 |       if (saved.length > 0) {
  162 |         await integration.cancelExtraConfiguration();
  163 |         test.skip(true, `${activity} already has saved Extra Configuration on this account (${saved.join(', ')}); this row needs a new account`);
  164 |       }
  165 |     }
  166 |     // Activities without Extra Configuration (e.g. Create a Company) open no
  167 |     // dialog; then the page Save stores the selection (seen 2026-10-09).
  168 |     const hasDialog = await integration.extraConfiguration().waitFor({ timeout: 5_000 }).then(() => true, () => false);
  169 |     if (!hasDialog) {
  170 |       await integration.save();
  171 |       await expect(integration.savedToast(), 'save confirmation').toBeVisible();
  172 |       return;
  173 |     }
  174 |     for (const [label, option] of Object.entries(values)) {
  175 |       // Closing Date is a number box (Days), the others are dropdowns.
  176 |       if (label.startsWith('Closing Date')) await integration.dueIn().fill(option);
  177 |       else await integration.chooseConfigOption(label, option);
  178 |     }
  179 |     await integration.configSaveButton().click();
  180 |     // Saving a Create a Deal with nothing chosen showed "Loading..." for longer
  181 |     // than 5 s on emailbounced (2026-10-12), so wait longer for the toast.
  182 |     await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
  183 |   }
  184 | 
  185 |   async function knownLogIds(integration: HubSpotIntegrationPage): Promise<Set<string>> {
  186 |     await integration.openLogs();
  187 |     const entries = await integration.logEntries(trigger).catch(() => []);
  188 |     return new Set(entries.map((e) => e.id));
  189 |   }
  190 | 
  191 |   // Adds the prospect, waits until step 1 is sent, then fires the workflow's
  192 |   // trigger event. Returns the log ids that existed before the event.
  193 |   async function runTrigger(ctx: FlowContext, row: Row, beforeSend?: () => Promise<void>): Promise<Set<string>> {
  194 |     // Waits for the send, the event and the sync.
  195 |     test.setTimeout(10 * 60_000);
  196 |     await test.step('Add the prospect to the sequence', async () => {
  197 |       await ctx.sequence.createAndAddProspect(sequenceId, row);
  198 |       markUsed(csv, row['Email']);
  199 |     });
  200 |     if (beforeSend) await beforeSend();
  201 |     // Email Sent: the send is the event, so take the log ids before it.
  202 |     const known = await knownLogIds(ctx.integration);
  203 |     await test.step('Wait until Saleshandy sends step 1', async () => {
  204 |       await ctx.sequence.ensureSent(sequenceId, fullName(row), 1, { bulk: cfg.sendStep1Now });
  205 |     });
  206 |     await cfg.fireEvent(ctx, row, 1);
  207 |     return known;
  208 |   }
  209 | 
  210 |   // timeout: Update a Deal logs stay RUNNING for about 7.5 minutes (2026-10-12), so those rows pass a longer one.
  211 |   async function expectNewLogsSuccess(integration: HubSpotIntegrationPage, known: Set<string>, timeout?: number): Promise<void> {
  212 |     await integration.openLogs();
  213 |     await untilPasses(`New "${trigger}" log entries did not all reach Success`, async () => {
  214 |       await integration.refreshLogs();
  215 |       const fresh = (await integration.logEntries(trigger)).filter((e) => !known.has(e.id));
  216 |       expect(fresh.length, 'new log entries for this trigger').toBeGreaterThan(0);
  217 |       stopOnErrorLogs(trigger, fresh);
```