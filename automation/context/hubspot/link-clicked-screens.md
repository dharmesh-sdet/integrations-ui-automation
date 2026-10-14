# Link Clicked: HubSpot screens seen (read-only walkthrough, 2026-10-12)

Source: throwaway headless Playwright scripts (chromium, 1440 wide) with
`auth/hubspot-chromium.json`, shared portal 247419080 (base
https://app-na2.hubspot.com). Nothing was created, edited, saved or deleted;
dropdowns were opened and closed with Escape (values checked unchanged).
Saleshandy was not touched. All records below already existed (made by
Email Sent workflows on 2026-09-29 to 2026-10-02), so the note title seen is
`sequence-email-sent`, NOT a link-clicked title. What a Link Clicked note looks
like (title, Step, Variant) was not seen (see the end).

Quick correction list for the current spec guesses:

- Tabs on a record are NOT `role=tab`. The tab is `role=button` named
  "Activities" (`<a data-tab-id="1" role="button">` inside `role=navigation`).
  The existing `hubspot.page.ts` fallback `.or(getByRole('button', ...))`
  already covers it.
- "Activities" is a tab of the middle pane next to "Catch-up" (Overview is the
  other tab, called "Catch-up" in the tab bar; its content is "Overview").
- The company card is titled "Key information", not "About".
- A property picker in the All Properties panel is a `button` (not a
  `combobox`) whose name is "<label> <current value>", not just the label.

## 1. Contact record, Activities tab

Records: contact 561264763587 (Valeria Cruz, notes + task + logged email),
560735641316 (Isabella Vargas, notes), 562555539140 (Hiroshi Tankhya, notes +
deal). URL: `/contacts/247419080/record/0-1/<id>`.

Tab and filters
- Tab: `getByRole('button', { name: 'Activities', exact: true })` (first
  match; the sidebar has none with this name). Content wrapper
  `data-test-id="tab-1-content"`; timeline card
  `data-test-id="card-wrapper-SINGLETON/0-1/RECORD_TIMELINE"`.
- Filter tabs under it: "All activities", "Notes", "Emails", "Calls",
  "Tasks", "Meetings" (`timeline-tab-filter-activity`, `-notes`, `-emails`,
  `-calls`, `-tasks`, `-meetings`). Also "Collapse all", "Activity (25/35)",
  "All time", "Activity assigned to", "Clear all", a "Search activities" box.
- Month group headers as plain text: "Overdue", "October 2026",
  "September 2026".
- Event wrappers: `timeline-preview-event` (every event),
  `timeline-note-event`, `timeline-task-event`, `timeline-simple-event`
  (header+timestamp inside note and task), `collapsible-event-accordion`
  (notes and logged emails), `generic-preview-event-header`, `header-message`,
  `simple-event-timestamp`, `formatted-be-message`,
  `source-label-with-instance-link` (the "Saleshandy" link),
  `owner-reference-lite-name`. Note event has
  `data-selenium-event-type="NOTE"`, task `"TASK"`.
- Reading the whole tab with `body.innerText` works: collapsed notes still
  contain their full text in innerText (they are only visually clipped).

Note created by Saleshandy (exact text, record 561264763587, Sep 30 2026)

```
Note created via Saleshandy
Sep 30, 2026 at 11:16 AM GMT+5:30
Note content preview
Title: sequence-email-sent
Sequence: https://my.saleshandy.com/sequence/195722 /steps
Sequence Name: Email Sent from Saleshandy
Step: 2
Variant: B
Sender Email: dharmesh@saleshandy.com
Sent as a new thread? false
Contains Link? true
Latest Outcome: Meeting Booked
Prospect Email: valeria.cruz@dispostable.com
User: dharmesh+ev@saleshandy.com
```

- Header text is exactly "Note created via Saleshandy" ("Note" is a link
  button, "Saleshandy" a link to integrations-settings).
- Fields are one per line as "Label: value", in this order: Title, Sequence,
  Sequence Name, Step, Variant, Sender Email, Sent as a new thread?,
  Contains Link?, Latest Outcome, Prospect Email, User. "Latest Outcome:" is
  followed by nothing when empty.
- Older notes (Oct 2, records 560735641316 and 562555539140 first notes) have
  no "Sent as a new thread?" and "Contains Link?" lines. Record 562555539140
  shows "Sequence: https://my.saleshandy.com/sequence/962876 /steps" with a
  space before "/steps" in some notes and none in others.
- The sequence URL shows as a link with a space before "/steps" (seen on
  195722 notes): do not match the URL as one exact string.
- Cut off: collapsed, the card shows only the Title line and the first part
  of the Sequence line, faded (screenshot), with a chevron at the left of the
  header. There is no "Read more" link. Clicking the first `role=button` inside
  the event expands it to all lines. Expanded card then also shows "Actions",
  "Add comment", "2 associations" (a note made with a deal paired shows 2
  associations: contact and deal).
- Timestamp format in cards: "Sep 30, 2026 at 11:16 AM GMT+5:30" (portal
  timezone GMT+5:30).

Task made by Saleshandy (record 561264763587, task id 403953523439)
- Collapsed card, in an "Overdue" group at the top:
  "Task assigned to Deal Dharmesh via Saleshandy", right side
  "Overdue: Oct 2, 2026 at 5:30 PM GMT+5:30", then a circle checkbox and the
  title "Email Sent from Saleshandy" (the task title is the Task title typed
  in Extra Configuration). Hidden text "Task content preview". A second hidden
  line "Task is overdue." appears for overdue tasks.
- A future (not overdue) task was not seen, so the label for it (probably
  "Due: ...") was not seen. In the card the due date uses the same
  "Oct 2, 2026 at 5:30 PM GMT+5:30" format; the compact form
  `simple-event-timestamp` renders "Overdue:" + "October 2, 2026".
- Tasks list `/tasks/247419080/view/all` (columns Status, Title, Associated
  Contact, Associated Company, Last Contacted, Last Engagement, Task Type,
  Due date) showed one row: title "Email Sent from Saleshandy", contact
  Valeria Cruz, Task Type "Email", Due date "October 2, 2026 5:30 PM". The
  list was filtered to one assignee ("Assigned to (1)"), so other tasks may
  exist.

Logged email made by Saleshandy (record 561264763587, Oct 2 2026 12:03 PM)
- Header: "Logged email by Evan Collins via Saleshandy" (collapsed, the name is
  truncated with an ellipsis; "Logged email" is a link button, "Evan
  Collins" is the HubSpot user, not the Saleshandy sender). Right side
  "Oct 2, 2026 at 12:03 PM GMT+5:30". Hidden text "Logged email content
  preview".
- Expanded: sub line "with Valeria Cruz", the body (HTML, links are
  clickable: "Mailinator" link), then a button "Expand" (the body is cut off
  and "Expand" shows the rest), then "Logged email properties summary" with
  "Contacted: Valeria Cruz" and "Activity date: 10/02/2026 12:03 PM GMT+5:30"
  (format MM/DD/YYYY hh:mm AM/PM). Footer "Add comment", "4 associations"
  (contact + paired deals).
- There is NO subject line in the card, and no From/To lines and no word
  "outgoing" or "incoming". The direction was not seen as text. Items are
  listed by the body only; the first line of the body is the greeting
  ("Hey there, Valeria,").
- The Overview tab shows the same event under "Outbound" in Recent
  interactions (`event-timeline-container-OUTBOUND`), as
  "Logged email by Evan Collins via Saleshandy": this is the only place
  that says outbound.
- Also in the timeline, written by the integration: "Deal Activity" cards
  ("Deal ValeriaCruz created by Integration", "ValeriaCruz moved to
  Prospecting by Integration. View details"), "Contact Activity"
  ("Valeria Cruz moved to Customer."), and "Created" ("This contact was
  created from Offline Sources fromSaleshandy").

## 2. Deal record, Activities tab

Record: deal 351726408423 (name "ValeriaCruz", pipeline Sales Pipeline, stage
Prospecting; associated contact 561264763587), also opened 351719113435
(9 events, 1 note). URL: `/contacts/247419080/record/0-3/<id>`.

- Same tab: `getByRole('button', { name: 'Activities', exact: true })`.
  Filter bar is the same, but the count label is plain "Activity" (no
  "(25/35)").
- Left card is "About this deal" with: Deal owner, Last Contacted, Deal Type
  ("New Business"), Priority ("Medium"), Closed Lost Reason, Campaign success
  rate, Number of email campaigns, Expected close date, Integration required.
  Header strip shows Amount, Close Date, Pipeline, Deal Stage.
- Note: "Note created via Saleshandy" with the same field lines as on the
  contact (Title ... User), here shown expanded in innerText, with "2
  associations" (contact + deal). Same timeline test ids.
- Logged email: header "Logged email by Evan Collins via Saleshandy",
  sub line "with Valeria Cruz", body, "Expand", "Logged email properties
  summary", "Contacted: Valeria Cruz", "Activity date", "4 associations".
  So it shows on the deal too.
- Deal-specific events: "Deal Activity ... ValeriaCruz moved to Prospecting.
  View details" and "Created ... This deal was created fromSaleshandy".
- Right sidebar: "Contacts (1)" card with the contact name, job title,
  "Email:...", "Phone Number:...".
- On the contact record the Deals card (`card-wrapper-ASSOCIATION_V3/0-3`)
  chicklets are `chiclet-0-3-<dealId>`, with `deal-chicklet-title-link`,
  `deal-chicklet-close-date`, `deal-chicklet-stage-select`. Deal names show
  with no space ("ValeriaCruz", "HiroshiTankhya"). Close date text
  "Close Date:October 20, 2026".

## 3. Company record, key information card

Record: company 351773387466 ("Stripe", domain mailinator.com). Also read
349792798399 and 350046957305 (same layout). URL
`/contacts/247419080/record/0-2/<id>`.

- The left card title is "Key information" (not "About"). Wrapper:
  `data-test-id="card-wrapper-PROPERTIES_V3/0-2/V2"` (same as contact, with
  `0-1`). It has an "Actions" dropdown button (name "Actions", exact) with
  "View all properties".
- Layout is label on one line, value on the next (`label` element, then the
  value in a span with `data-selenium-test="property-input-<name>"`).
  innerText: "Company owner / No owner / City / Al Ain / Lifecycle Stage /
  Lead / Lead Status / -- / Industry / -- / Last Contacted / -- / Lead
  generation maturity / Industry focus / Company size segment / Technology
  stack". Empty shows "--".
- Property wrappers `data-test-id`: `hubspot_owner_id`, `city`,
  `lifecyclestage`, `hs_lead_status`, `industry`, `notes_last_contacted`,
  `lead_generation_maturity`, `industry_focus`, `company_size_segment`,
  `technology_stack`.
- The key card does NOT show State/Region, Domain or Country. They are in
  "View all properties" (panel, Contact information group), exact row text
  (button `^<label> View property history`):
  - "City" = Al Ain
  - "State/Region" = Abu Dhabi (also "State/Region Code" = "--")
  - "Company domain name" = mailinator.com (also "Domain status", "Redirect
    domain"). The label is "Company domain name", not "Domain name".
  - "Country/Region" = United Arab Emirates (also "Country/Region Code")
- Header (highlight card `card-wrapper-OBJECT_HIGHLIGHT-FAS-0-2-1`) shows the
  name ("Stripe", `highlight-property-display-name`) and the domain as a
  link (`highlight-property-item-domain` /
  `highlight-property-display-domain`, text "mailinator.com").
- Company Activities tab was not opened.

## 4. Lifecycle stage and Lead status dropdowns (contact 561264763587)

Two places, both read-only (opened, then Escape; values still Customer and
Connected).

Key information card (left): the wrapper `data-test-id="lifecyclestage"` and
`data-test-id="hs_lead_status"`; click on the value opens a popup with a
search box and `role=listbox` + `role=option`.

All properties panel (Actions > View all properties, `searchbox` "Search
property", rows in `[data-test-id^="group-accordion-"]`):
- Row text: "Lifecycle stage\nCustomer" and "Lead status\nConnected", row is a
  `button` named `^Lifecycle stage View property history`. One click on the
  row opens the picker directly.
- After the click the row becomes a picker `button` with
  `aria-haspopup=true`, `aria-expanded=true`, text = current value
  ("Customer"). Its name is "Lifecycle stage Customer" style:
  `getByRole('button', { name: /^Lifecycle stage/ })` matched 1,
  `{ name: 'Lifecycle stage', exact: true }` matched 0. `getByRole('combobox',
  { name: 'Lifecycle stage' })` matched 0 in the panel and on the page.
- The popup (inside `[data-test-id="typeahead-results"]`) holds one
  unnamed `combobox` (the search input, `aria-expanded=true`, empty name),
  one unnamed `listbox`, and the options. `getByRole('combobox')` count on the
  page was 1.
- Lifecycle stage options (role option, exact text, 9): "Select a stage",
  "Subscriber", "Lead", "Marketing Qualified Lead", "Sales Qualified Lead",
  "Opportunity", "Customer", "Evangelist", "Other". `getByRole('option',
  { name: 'Customer', exact: true })` matched 1.
- Lead status options (exact text): an empty option (blank text), "New",
  "Open", "In progress", "Open Deal", "Unqualified", "Attempted to contact",
  "Connected", "Bad timing". Unlike Saleshandy's Lead Status, HubSpot has a
  blank option. The option list appeared with each name twice in the DOM
  (one `option` with `aria-selected`, one without), so
  `getByRole('option', { name: 'Open', exact: true })` can match 2: use
  `.last()` or `.first()`, and note "Open" vs "Open Deal" needs `exact`.
- Escape closes the popup; the row stays in edit/picker state (button still
  matches `/^Lifecycle stage/`), nothing saved.
- Label case differs by place: Key information "Lifecycle Stage" and "Lead
  Status"; All properties panel "Lifecycle stage" and "Lead status".
  The existing `setDropdownProperty` regex `^<label> View property history`
  needs the panel casing ("Lifecycle stage").

## 5. Task type and priority

Seen on the expanded task card (record 561264763587, task 403953523439),
after clicking the card header chevron. Text lines:
"Task properties summary / Due date / Reminder: No reminder / Set to repeat /
Task properties summary / Task stage: Not Started / Task Type: Email /
Priority: Medium / Queue: Not Assigned / Assigned to: Deal Dharmesh /
Task Notes: Add description / 1 association / Add comment".

- Collapsed card does NOT show type or priority; only title, assignee,
  overdue/due label.
- Labels exact: "Task Type" (value "Email"), "Priority" (value "Medium").
  The Tasks list column header is "Task Type" too, with value "Email".
- The Due date value in the expanded card is an input (not in innerText);
  take the date from the collapsed header or the Tasks list.
- Task type "Email" and Priority "Medium" match Create a Task config
  Email / Medium. Other values (Call, To-do, Sales Navigator...; None, Low,
  High) were not seen on a record.

## 6. Mailinator

Not seen. 40 public inboxes were requested from the Link Clicked test-data
emails (+ eleni.papadakis, seo-yeon.baek). About 13 loaded (their message
rows were not captured by the script) and then Mailinator returned Cloudflare
"Error 1015 You are being rate limited". Stopped there, not retried. No
"HubSpot Link Clicked QA" step 2 subject was recorded.

## Not seen, and why

- Link Clicked note: title, Step 2 / Variant text for a link-clicked event.
  Existing records were all made by Email Sent (title "sequence-email-sent").
  Needs a real click on the linkclick account.
- Note for Link Clicked: whether a new field (e.g. clicked link) exists.
- A future-dated (not overdue) task label, and task priorities or types
  other than Email / Medium.
- Logged email direction text and subject: the card has no subject and no
  From/To lines; only "Outbound" on the Overview tab was seen.
- "Read more" link: none exists for notes; only chevron expand (notes) and an
  "Expand" button (logged email body). A very long note was not found.
- Company record Activities tab (notes/emails on a company): not opened.
- Mailinator step 2 follow-up subject: rate limited (see 6).
- Only contacts matching "mailinator.com" (24 of them) were scanned; no
  dispostable.com or other domains.
