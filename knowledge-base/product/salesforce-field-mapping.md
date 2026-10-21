# Salesforce field mapping: how it works and what maps to what

How users map Saleshandy prospect fields to Salesforce object fields.
Source: [public docs, 2026-10-16] unless tagged otherwise.

## How the user does the mapping

1. Connect Salesforce first (Settings > Integrations > Salesforce > Connect).
2. Click the **profile icon** (top-right corner) and choose **Configure**
   (wrench icon) from the dropdown.
3. The mapping screen opens. It shows **Saleshandy fields on the left** and a
   **Salesforce field dropdown on the right** for each row.
4. There are 4 object tabs to map: **Lead, Contact, Opportunity, Account**.
5. For each Saleshandy field, pick the matching Salesforce field from the
   dropdown, then click **Save**.

## What the mapping screen looks like [staging, 2026-10-16]

- Top row: 4 object tabs: **Lead Properties**, **Contact Properties**,
  **Opportunity Properties**, **Account Properties**. Each tab shows
  "Prospects in Saleshandy" on the left.
- Below the tabs: "Please map the fields between Saleshandy & Salesforce so
  data gets synchronized between both apps accordingly."
- The left column is **always the same** across all 4 tabs: Saleshandy
  prospect fields (listed below). The right column is a "Select" dropdown
  with Salesforce fields specific to that object.

### Saleshandy prospect fields (left column, all tabs)

Under the heading "Prospect Overview":

1. First Name
2. Last Name
3. Email
4. Phone Number
5. Job Title
6. Department
7. Industry
8. Experience
9. LinkedIn
10. Twitter
11. Facebook
12. Website
13. City
14. State
15. Country
16. Company
17. Company Domain
18. Company Website
19. Company Industry
20. Company Size
21. Company Revenue
22. Company Founded Year
23. Company LinkedIn
24. Company Phone
25. Person's Seniority Level
26. Decision Role
27. Current Company Experience (In Months)
28. Tenure In Current Role (In Months)
29. Projected Salary
30. LinkedIn Followers
31. Is B2B
32. Company HQ Location
33. Company's Latest Funding Amount
34. Company's Latest Funding Date
35. Profile Headline
36. LinkedIn Profile Summary
37. Past Companies
38. Educational Qualification
39. Key Skills
40. Job Changed Before (In Months)
41. Profile Picture
42. Deal Value
43. Closing Date

(43 fields total. Custom prospect fields, if any, would appear below these.)

## Default vs custom fields

- **Saleshandy default fields** (the 43 listed above) are locked and cannot
  be changed or removed from the mapping.
- **Custom fields** can be created in Saleshandy (Settings > Prospect Fields)
  and then mapped to any Salesforce field.

## How this compares to HubSpot mapping

The flow is identical: Configure > pick fields > Save. The difference is:
- HubSpot has 3 object tabs: Contact, Company, Deal.
- Salesforce has 4 object tabs: Lead, Contact, Opportunity, Account.
- Salesforce has Lead as a separate object from Contact (HubSpot does not).
- Salesforce enforces required fields via API (Company on Lead, Stage and
  Close Date on Opportunity). If these are not mapped, the integration create
  will fail.

## Available Salesforce fields per object

The docs list only the Salesforce side of the mapping. The Saleshandy side is
always a prospect field (default or custom). The user picks which Salesforce
field each Saleshandy field should write to.

### Lead Properties (60 fields) [public docs]

Identity and name:
- Lead ID, Full Name, First Name, Last Name, Salutation, Title, Company,
  Photo URL

Contact info:
- Phone, Mobile Phone, Fax, Email, Website

Address:
- Street, City, State/Province, Zip/Postal Code, Country, Latitude,
  Longitude, Geocode Accuracy, Address

Qualification:
- Lead Source, Status, Industry, Rating, Annual Revenue, Employees,
  Description

Data quality:
- Data.com Key (listed twice in docs), Clean Status, Company D-U-N-S,
  D&B Company ID

Email bounce:
- Email Bounced Reason, Email Bounced Date

Conversion (read-only after conversion):
- Converted, Converted Date, Converted Account ID, Converted Contact ID,
  Converted Opportunity ID

System:
- Owner ID, Unread By Owner, Created Date, Created By ID, Last Modified Date,
  Last Modified By ID, System Modstamp, Last Activity, Last Viewed Date,
  Last Referenced Date, Deleted, Master Record ID, Individual ID

Custom (in test org):
- SIC Code, Product Interest, Primary, Current Generator(s),
  Number of Locations

### Contact Properties [public docs]

The Saleshandy docs page for Salesforce Contact Properties was not found in
search results. Expected to follow the same pattern as Lead Properties.
Fields to confirm on the Configure screen during exploration.

Standard Salesforce Contact fields likely available:
- Contact ID, First Name, Last Name, Salutation, Title, Email, Phone,
  Mobile Phone, Fax, Account ID, Department, Mailing Address fields,
  Other Address fields, Description, Lead Source, Owner ID, system dates.

**Not confirmed yet. Check on staging.**

### Opportunity Properties (46 fields) [public docs]

Core:
- Opportunity ID, Name, Account ID, Description, Stage, Amount,
  Probability (%), Expected Amount, Close Date, Opportunity Type, Next Step,
  Lead Source, Quantity

Status:
- Closed, Won, Forecast Category (listed twice in docs)

Campaign and line items:
- Campaign ID, Has Line Item, Price Book ID

Ownership and dates:
- Owner ID, Created Date, Created By ID, Last Modified Date,
  Last Modified By ID, System Modstamp, Last Activity, Last Stage Change Date

Fiscal:
- Fiscal Quarter, Fiscal Year, Fiscal Period

Activity:
- Has Open Activity, Has Overdue Task, Push Count

Related:
- Contact ID, Opportunity History ID (listed twice in docs)

View tracking:
- Last Viewed Date, Last Referenced Date, Deleted, Private

Custom (in test org):
- Delivery/Installation Status, Tracking Number, Order Number,
  Current Generator(s), Main Competitor(s)

### Account Properties (66 fields) [public docs]

Identity:
- Account ID, Account Name, Account Type, Parent Account ID, Account Number,
  Account Site, Account Source

Contact info:
- Account Phone, Account Fax, Website, Photo URL

Address (billing):
- Billing Street, Billing City, Billing State/Province,
  Billing Zip/Postal Code, Billing Country, Billing Latitude,
  Billing Longitude, Billing Geocode Accuracy, Billing Address

Address (shipping):
- Shipping Street, Shipping City, Shipping State/Province,
  Shipping Zip/Postal Code, Shipping Country, Shipping Latitude,
  Shipping Longitude, Shipping Geocode Accuracy, Shipping Address

Business info:
- Industry, Annual Revenue, Employees, Ownership, Ticker Symbol,
  Account Description, Account Rating, SIC Code, SIC Description,
  NAICS Code, NAICS Description, Year Started, Tradestyle

Data quality:
- Data.com Key, Jigsaw Company ID, Clean Status, D-U-N-S Number,
  D&B Company ID

System:
- Owner ID, Created Date, Created By ID, Last Modified Date,
  Last Modified By ID, System Modstamp, Last Activity, Last Viewed Date,
  Last Referenced Date, Deleted, Master Record ID, Operating Hour ID

Custom (in test org):
- Customer Priority, SLA, Active, Number of Locations, Upsell Opportunity,
  SLA Serial Number, SLA Expiration Date

## What matters for integration testing

- Required fields that must be mapped or have defaults:
  - Lead: Last Name, Company, Lead Status
  - Contact: Last Name
  - Opportunity: Name, Stage, Close Date
  - Account: Account Name
- If a required field is not mapped and has no default, the API create fails.
- Picklist fields (Lead Status, Stage, Industry, Rating) must have values
  that exist in the Salesforce org. A value not in the picklist will fail.
- The mapping screen does not show which fields are required. The user must
  know from Salesforce setup which fields their org requires.

## Sources

- [Salesforce: Configuration & Mapping Fields](https://docs.saleshandy.com/en/articles/9203067-salesforce-configuration-mapping-fields)
- [Lead Properties](https://docs.saleshandy.com/en/articles/9154568-lead-properties)
- [Account Properties](https://docs.saleshandy.com/en/articles/9154578-account-properties)
- [Opportunities Properties](https://docs.saleshandy.com/en/articles/9154576-opportunities-properties)
