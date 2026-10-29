# Zoho on staging: walkthrough

Date: 2026-10-28. Account: `gzoho` (`dharmesh+gzoho@saleshandy.com`). Read-only. No toggle, save, connect, disconnect or record change was made.
Tool: headless Chromium script, saved sessions `auth/saleshandy-gzoho-chromium.json` and `auth/zoho-gzoho-chromium.json`.

## Result in one line

The Saleshandy side was walked, except the options inside the trigger dropdowns. The Zoho CRM side was not reached, because the saved Zoho session asked to verify identity.

## Saleshandy side

Base URL: `https://pyxis.lifeisgoodforlearner.com`

### Integration list

- API & Integrations > Integrations (`/api-and-integrations/integrations`) shows a "Native Integrations" section with 6 cards in this order: Pipedrive, Zoho, Hubspot, Salesforce, Aimfox, HeyReach. [staging, 2026-10-28]
- The Zoho card text is "Connect now to sync Zoho data to Saleshandy." and its button reads "Connected". The other native cards read "Connect Now". [staging, 2026-10-28]
- The session of `gzoho` was valid. No Saleshandy login was asked. [staging, 2026-10-28]

### Zoho page

- URL: `/api-and-integrations/integrations/zoho`. Breadcrumb "Integration > Zoho > <tab>". A red "Disconnect" button sits top right. [staging, 2026-10-28]
- Four tabs: Field Mapping, Triggers & Activity (`?tab=triggers-activity`), Custom Workflow (`?tab=custom-workflow`), Logs (`?tab=logs`). [staging, 2026-10-28]
- The Custom Workflow tab is not in the earlier context files. See below. [staging, 2026-10-28]
- Not seen: the connect screen and the Zoho permission (OAuth scope) screen. The account is already connected, and Connect and Disconnect are out of scope.

### Field Mapping tab

- Four rows, each "Prospects in Saleshandy" with a Zoho logo: Deal Fields, Contact Fields, Account Fields, Lead Fields (in that order). [staging, 2026-10-28, Zoho > Field Mapping]
- A click opens the mapping page. The URL stays the same. The breadcrumb reads "Integration > Zoho > Type > Field Mapping". [staging, 2026-10-28]
- The title is "Field Mapping" for all four types. Nothing on the page names the type. [staging, 2026-10-28]
- Left side, identical for all four types: 44 Saleshandy rows (the first one is "Prospect Overview"). The first row is "Prospect Overview". The list follows. [staging, 2026-10-28]

```
First Name
Last Name
Email
Phone Number
Job Title
Department
Industry
Experience
LinkedIn
Twitter
Facebook
Website
City
State
Country
Company
Company Domain
Company Website
Company Industry
Company Size
Company Revenue
Company Founded Year
Company LinkedIn
Company Phone
Person's Seniority Level
Decision Role
Current Company Experience (In Months)
Tenure In Current Role (In Months)
Projected Salary
LinkedIn Followers
Is B2B
Company HQ Location
Company's Latest Funding Amount
Company's Latest Funding Date
Profile Headline
LinkedIn Profile Summary
Past Companies
Educational Qualification
Key Skills
Job Changed Before (In Months)
Profile Picture
Deal Value
Closing Date
```

- Every Zoho dropdown on all four types reads "Select". No mapping is saved on this account. The Save button is greyed out. [staging, 2026-10-28]
- No custom Zoho field appears in any list. Only standard fields. [staging, 2026-10-28]
- No field is marked as required on the screen. Not seen.

Zoho options in the dropdown, read from the open list with nothing chosen. Each list is one item per line. [staging, 2026-10-28]

Deal Fields (27 options):

```
Deal Owner
Amount
Deal Name
Closing Date
Account Name
Stage
Type
Probability (%)
Next Step
Lead Source
Campaign Source
Created By
Modified By
Created Time
Modified Time
Description
Contact Name
Expected Revenue
Last Activity Time
Lead Conversion Time
Sales Cycle Duration
Overall Sales Duration
Deal Image
Record Id
Change Log Time
Locked
Reason For Loss
```

Contact Fields (57 options):

```
Mailing Address - Latitude
Mailing Address - Longitude
Other Address - Latitude
Other Address - Longitude
Contact Owner
Lead Source
First Name
Last Name
Account Name
Email
Title
Department
Phone
Home Phone
Other Phone
Fax
Mobile
Date of Birth
Assistant
Asst Phone
Created By
Modified By
Created Time
Modified Time
Full Name
Description
Email Opt Out
Skype ID
Salutation
Secondary Email
Last Activity Time
Twitter
Contact Image
Reporting To
Unsubscribed Mode
Unsubscribed Time
Record Id
Change Log Time
Locked
Last Enriched Time
Enrich Status
Mailing Address
Mailing Address - Country / Region
Mailing Address - Flat / House No./ Building / Apartment Name
Mailing Address - Street Address
Mailing Address - City
Mailing Address - State / Province
Mailing Address - Zip / Postal Code
Mailing Address - Coordinates
Other Address
Other Address - Country / Region
Other Address - Flat / House No./ Building / Apartment Name
Other Address - Street Address
Other Address - City
Other Address - State / Province
Other Address - Zip / Postal Code
Other Address - Coordinates
```

Account Fields (48 options):

```
Billing Address - Latitude
Billing Address - Longitude
Shipping Address - Latitude
Shipping Address - Longitude
Account Owner
Rating
Account Name
Phone
Account Site
Fax
Parent Account
Website
Account Number
Ticker Symbol
Account Type
Ownership
Industry
Employees
Annual Revenue
SIC Code
Created By
Modified By
Created Time
Modified Time
Description
Last Activity Time
Account Image
Record Id
Change Log Time
Locked
Last Enriched Time
Enrich Status
Billing Address
Billing Address - Country / Region
Billing Address - Flat / House No./ Building / Apartment Name
Billing Address - Street Address
Billing Address - City
Billing Address - State / Province
Billing Address - Zip / Postal Code
Billing Address - Coordinates
Shipping Address
Shipping Address - Country / Region
Shipping Address - Flat / House No./ Building / Apartment Name
Shipping Address - Street Address
Shipping Address - City
Shipping Address - State / Province
Shipping Address - Zip / Postal Code
Shipping Address - Coordinates
```

Lead Fields (53 options):

```
Address - Latitude
Address - Longitude
Lead Owner
Company
First Name
Last Name
Title
Email
Phone
Fax
Mobile
Website
Lead Source
Lead Status
Industry
No. of Employees
Annual Revenue
Rating
Created By
Modified By
Created Time
Modified Time
Full Name
Description
Skype ID
Email Opt Out
Salutation
Secondary Email
Last Activity Time
Twitter
Lead Image
Converted Date Time
Lead Conversion Time
Unsubscribed Mode
Unsubscribed Time
Converted Account
Converted Contact
Converted Deal
Record Id
Change Log Time
Is Converted
Locked
Last Enriched Time
Enrich Status
Address
Address - Country / Region
Address - Flat / House No./ Building / Apartment Name
Address - Street Address
Address - City
Address - State / Province
Address - Zip / Postal Code
Address - Coordinates
Lead Status Modified Time
```

- The Deal list has no Pipeline option. This fits the known issue Q3.
- The Lead list shows "Title". It has no "Designation". Not confirmed whether it is the same field.

### Triggers & Activity tab

- Heading "Triggers & Activity". Text "Enable the triggers & activities you want to automate between Saleshandy & Zoho." [staging, 2026-10-28]
- Seven rows in this order, each with a toggle (OFF) and a greyed dropdown that reads "Select": [staging, 2026-10-28]
  1. Email Sent from Saleshandy
  2. Reply is Received in Saleshandy
  3. Link is Clicked in Saleshandy
  4. Email is Opened in Saleshandy
  5. Conversation Category is Updated in Saleshandy
  6. Email is Bounced in Saleshandy
  7. Prospect is Unsubscribed in Saleshandy
- All seven toggles are OFF on this account. The Save button at the bottom looks active. [staging, 2026-10-28]
- No "Prospect is Finished" row. [staging, 2026-10-28]
- Not seen: the action slots 1 to 11, the Create Account, Contact, Lead, Deal and Task options, the Deal closing date, the Task fields and the Conversation Category list. The dropdowns look greyed while the toggle is OFF, and I did not turn a toggle ON because that was out of scope.

### Custom Workflow tab

- Heading "Custom Workflows". Text "Build and manage custom automation workflows for your Zoho integration." A "Create Workflow" button. [staging, 2026-10-28]
- Empty state: "No workflows yet". Text: "To use Saleshandy events as workflow triggers, make sure Saleshandy triggers are enabled in the Triggers & Activity tab." [staging, 2026-10-28]
- I did not click "Create Workflow". Not seen: the builder screen.

### Logs tab

- Two filters and a button: a status filter, a date filter and "Refresh". [staging, 2026-10-28]
- Status options: All, Success, Error. Default "All". [staging, 2026-10-28]
- Date options: Today, Yesterday, Last 7 Days, Last 14 Days, Last 30 Days, Last 90 Days. Default "Last 30 Days". [staging, 2026-10-28]
- This account has no log. The tab shows "No logs yet" and "Logs will appear here once your workflows and trigger rules start running." [staging, 2026-10-28]
- Not seen: the log columns, the run detail and the statuses of a real run, because there is no run.

## Zoho CRM side

- Not reached, twice. The session file `auth/zoho-gzoho-chromium.json` was saved again at 17:26, but `https://crm.zoho.com/crm/` still redirected to `accounts.zoho.com/account/v1/relogin`. The page shows a masked email, "Verify your identity", "Verify using OTP" and a "Confirm Password" field. [staging, 2026-10-28]
- I stopped after the second try, as the task said. Not seen: the enabled modules, the edition, the duplicate rules, the record layouts, the pipelines and stages, the Task fields, the tags, the notes and the org id.
- One approved retry in a visible Chromium window (headless off, 1440x900, same session file) also ended on `accounts.zoho.com/account/v1/relogin` with "Verify your identity". I entered no password or code, and stopped. [staging, 2026-10-28]
- QA then signed in by hand in a visible window (clean context, no saved session). The window reached `https://crm.zoho.com/crm/org941113438/tab/Accounts/custom-view/7636887000000087515/list`, and the session was saved to `auth/zoho-gzoho-chromium.json` at 17:31. The org id in the URL is 941113438, the same as the developers used. [staging, 2026-10-28]
- One headless retry with that new file ended on `accounts.zoho.com/account/v1/relogin` with "Verify your identity" again. That script opened `https://crm.zoho.com/crm/`, not `ShowHomePage.do`. Both addresses redirect to the same relogin page, so I did not retry. [staging, 2026-10-28]
- The login works in a visible window and fails in a new headless browser right after. So the saved cookies do not carry the login. Not proven why.
- Likely cause (not proven): the saved cookies are not enough for Zoho, in a headless or a visible window. Zoho may tie the login to the browser profile or the IP, or the session may need a fresh login that the script never finishes.

## Unclear list in 00-overview.md

| # | Item | Answer |
|---|---|---|
| 1 | Connect and disconnect screens, OAuth scopes | Connect state is a "Connected" card and a red "Disconnect" button. The connect screen and the scopes were not seen. |
| 2 | Duplicate rules | Not seen (Zoho CRM not reached). |
| 4 | Edition and modules of the test org | Org id 941113438 (from the URL after QA's sign-in). Edition and modules not seen. The Field Mapping lists show that Deals, Contacts, Accounts and Leads exist. They do not show Tasks. |
| 5 | Note title per workflow | Not seen. No log exists. |
| 7 | Release dates | The screens do not show dates. Not seen. |

## Differences from 00-overview.md

1. The page has a fourth tab, Custom Workflow, empty. The overview does not mention it.
2. The trigger name is "Email is Opened in Saleshandy". The overview says "Sequence Email is Opened in Saleshandy". The row order is also different: the overview lists Opened 4th and Bounced 5th, the screen lists Conversation Category 5th.
3. The conversation trigger reads "Conversation Category is Updated in Saleshandy". The overview says "Conversation Category (Prospect Outcome) is updated in Saleshandy".
4. No mapping is saved on `gzoho`. The developer probes in the overview are not here.
5. The Lead dropdown shows "Title", not "Designation". The overview mapping says jobTitle to Designation. This can be the label for the same field. Not confirmed.
6. The Deal list has no Pipeline field. The overview already says Pipeline and Stage are hidden in the UI (Q3). This fits Q3.
7. All seven triggers are OFF.

## Open questions for QA

1. The Zoho session saved at 17:31 still asks to verify identity in a headless run. Can you run `npm run login:zoho -- gzoho` again and tick "Trust this browser" if Zoho shows it? Default: yes. The headed retry already failed, so the next option is that QA stays logged in inside one visible window (`npm run mcp:open` style) while I read the pages there.
2. May I turn a trigger ON in the UI without pressing Save, only to read the action dropdown options? Default: yes, one trigger at a time, then turn it OFF again and do not save. Without it the action slots and the Task fields stay unseen.
3. May I open "Create Workflow" in Custom Workflow to see the builder, without saving? Default: yes. Is Custom Workflow in scope for the Zoho tests? Default: no, leave it out.
4. Which Zoho field mapping do the tests use? Default: Contact: Phone, Title, Department, Mailing City, Mailing Country, Twitter. Lead: Phone, Title, Industry, Website, City, No. of Employees, Annual Revenue. This is the developer probe set from 00-overview.md. Waiting for QA's pick.

## Trigger dropdowns and Create Workflow, 2026-10-29 (read-only, QA took the defaults)

Method: headless script with the saved Saleshandy session of `gzoho`. For each trigger I turned the toggle ON, opened the dropdown, read it, and turned the toggle OFF. I did not press Save and did not pick an option. Nothing was changed on the account.

- The toggle works while the page is open. The dropdown opens only after the toggle is ON. [staging, 2026-10-29]
- All seven triggers show the same five options: Create/Update a Lead in Zoho, Create/Update a Deal in Zoho, Create/Update a Contact in Zoho, Create/Update Account in Zoho, Create a Task in Zoho. [staging, 2026-10-29] Seen by screenshot for Email Sent and Conversation Category. The other five lists were read as text only. The Prospect is Unsubscribed list was not read.
- The "Create a Task" option for Conversation Category is on the same list. The Conversation Category value list, the Deal closing date and the Task fields did not show before an option is picked. Not seen. [staging, 2026-10-29]
- Custom Workflow > Create Workflow opens a dialog with "Workflow Name *" (required), "Description", Cancel and Create Workflow. The builder is behind that button. I stopped here, because "Create Workflow" saves a workflow. Custom Workflow stays out of scope (QA default). [staging, 2026-10-29]
- The Zoho CRM side is still not reached. QA must run `npm run login:zoho -- gzoho` and tick "Trust this browser".

## Zoho CRM side, 2026-10-29 (read-only, through the `playwright-zoho` MCP)

Method: visible Chromium window on profile `auth/mcp-zoho-profile`. The login holds. Nothing was created, changed or deleted. Cookie files do not work for Zoho (four headless runs ended on "Verify your identity"), a saved browser profile does.

- Org id 941113438. Org owner on Company Settings: `rudra@saleshandy.com`. Time zone: (GMT 5:30) India Standard Time (Asia/Kolkata). The page does not show the edition. [staging, 2026-10-29, Setup > General > Company Settings]
- Setup > Customization > Modules and Fields lists these modules, all ON except Feeds: Home, Leads, Contacts, Accounts, Deals, Tasks, Meetings, Calls, Reports, Campaigns. Feeds is OFF. The list continues below Campaigns, and I did not scroll it. [staging, 2026-10-29]
- "Last Modified" shows Oct 29, 2026 for Leads, Contacts, Accounts and Deals, and Oct 15, 2026 for Tasks. Someone changed those four modules today. Not known who or what. [staging, 2026-10-29]
- The top menu calls Deals "Potentials" in the link (`/tab/Potentials`). The module name in Setup is "Deals". [staging, 2026-10-29]
- The Setup menu has no Pipelines or Duplicate Check entry under Customization or Automation. Not seen: the edition, the duplicate rules, the Deal stages and the Task fields.
- Setup has "Remove sample data" and "Delete CRM account". Tests must never open them.
- Guessed Setup URLs return HTTP 400. Open Setup from the gear icon, or use `/crm/org941113438/settings/index`.

### Deals module (read-only, 2026-10-29)

- Setup > Customization > Modules and Fields > Deals (API name `Potentials`): one layout, "Standard", shared to Administrator and Standard. No pipeline option. [staging, 2026-10-29]
- 17 fields, none custom: Account Name, Amount, Campaign Source, Closing Date, Contact Name, Created By, Deal Name, Deal Owner, Description, Expected Revenue, Lead Source, Modified By, Next Step, Probability (%), Reason For Loss, Stage, Type. Stage, Type, Lead Source and Reason For Loss are Pick Lists. Closing Date is a Date, Amount a Currency. [staging, 2026-10-29]
- Stage values, read from the Deals Kanban columns (the Kanban shows only stages that exist), in this order with the default probability: Qualification 10%, Needs Analysis 20%, Value Proposition 40%, Proposal/Price Quote 75%, Negotiation/Review 90%, Closed Won 100%, Closed Lost 0%, Closed Lost to Competition 0%. [staging, 2026-10-29]
- The org already holds about 100 deals from earlier runs (78 in Qualification, 16 in Needs Analysis). The deal list opens in Kanban view. Deals made in tests must use unique names. [staging, 2026-10-29]

### Tasks module (read-only, 2026-10-29)

- 12 fields, none custom: Closed Time (DateTime), Contact Name (Lookup), Created By, Description (Multi Line), Due Date (Date), Modified By, Priority (Pick List), Related To (Lookup), Repeat, Status (Pick List), Subject, Task Owner (Lookup). [staging, 2026-10-29]
- Not seen: the values of Priority and Status, and the field the Saleshandy Task options write to. The Saleshandy Task fields were also not seen (the option shows them only after it is picked).

Still to read: duplicate rules, the note title after a real run, the Saleshandy Task and Deal closing date fields.

## Task and Deal Extra Configuration, 2026-10-29 (read-only, headless script on gzoho, nothing saved)

- Create a Task in Zoho opens "Extra Configuration": Due In (number, Days), Subject (text), Status (list), Priority (list). [staging, 2026-10-29]
- Status options: Not Started, Deferred, In Progress, Completed, Waiting on someone else. Priority options: High, Highest, Low, Lowest, Normal. [staging, 2026-10-29]
- Create/Update a Deal in Zoho opens "Extra Configuration": Deal Closing date (number, default 0, Days), Select Pipelines and Select Stages. Both lists are greyed and empty, so Pipeline and Stage cannot be chosen (fits Q3). [staging, 2026-10-29]
- Email Sent was already ON on gzoho with a Contact action when this was read. [staging, 2026-10-29]

## Note text after a real run, 2026-10-29 (Zoho, read-only)

Contact `John Subtronics` holds 1 note (Notes 1), owner rudra, text: "Saleshandy Email Sent from Sequence", then Sequence Name, Sequence (link), Step, Sender Email, Prospect Email, Prospect Name, User, one per line. The Email Body is not in this note. [Zoho, 2026-10-29]
