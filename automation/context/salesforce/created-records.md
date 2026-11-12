# Salesforce: how to create a Lead, Contact, Opportunity and Account

Read 2026-11-05 from the New form of each object in the Developer Edition org
`saleshandy-dev-ed` (Lightning), read-only, headless, nothing created. [staging]
Open a form at `https://saleshandy-dev-ed.develop.lightning.force.com/lightning/o/<Object>/new`
(`Lead`, `Contact`, `Opportunity`, `Account`). It opens as a dialog.

Login: the browser login asks for a code. Use the API login (`src/utils/salesforce-login.ts`,
`salesforceFrontdoorUrl`), which works from the trusted exit node only. The saved session in
`auth/salesforce-sfreplyreceived-chromium.json` had expired on 2026-11-05 (the MCP browser showed
the Salesforce login page).

## Required fields

| Object | Required |
|---|---|
| Lead | Last Name, Company, Lead Status |
| Contact | Last Name |
| Opportunity | Opportunity Name, Stage, Close Date |
| Account | Account Name |

## Other fields on each form

- Lead: Salutation, First Name, Mobile, Phone, Fax, Title, Email, Lead Source, Website, Industry, Annual Revenue, Rating, No. of Employees, Address (Street, City, Zip/Postal Code, State/Province, Country), Product Interest, Current Generator(s), SIC Code, Primary, Number of Locations, Description.
- Contact: Salutation, First Name, Account Name, Phone, Mobile, Home Phone, Other Phone, Title, Department, Fax, Birthdate, Email, Reports To, Assistant, Asst. Phone, Lead Source, Mailing Address and Other Address (Street, City, Zip/Postal Code, State/Province, Country), Languages, Level, Description.
- Opportunity: Amount, Private, Next Step, Account Name, Type, Probability (%), Lead Source, Primary Campaign Source, Order Number, Main Competitor(s), Current Generator(s), Delivery/Installation Status, Tracking Number, Description.
- Account, general: Parent Account, Phone, Fax, Account Number, Website, Account Site, Ticker Symbol, Type, Ownership, Industry, Employees, Annual Revenue, SIC Code, Rating.
- Account, address: Billing Address and Shipping Address, each with Street, City, Zip/Postal Code, State/Province and Country.
- Account, other: Customer Priority, SLA, SLA Expiration Date, SLA Serial Number, Number of Locations, Upsell Opportunity, Active, Description.

## Picklist values

- Salutation (Lead, Contact): Mr., Ms., Mrs., Dr., Prof., Mx.
- Lead Source (Lead, Contact, Opportunity): Web, Phone Inquiry, Partner Referral, Purchased List, Other.
- Lead Status: `Open - Not Contacted`, `Working - Contacted`, `Closed - Converted`, `Closed - Not Converted`.
- Lead Rating and Account Rating: Hot, Warm, Cold.
- Industry (Lead, Account), part 1: Agriculture, Apparel, Banking, Biotechnology, Chemicals, Communications, Construction, Consulting, Education, Electronics, Energy, Engineering, Entertainment, Environmental, Finance, Food & Beverage.
- Industry, part 2: Government, Healthcare, Hospitality, Insurance, Machinery, Manufacturing, Media, Not For Profit, Recreation, Retail, Shipping, Technology, Telecommunications, Transportation, Utilities, Other.
- Lead Product Interest: GC1000 series, GC5000 series, GC3000 series. Lead Primary: No, Yes.
- Contact Level: Secondary, Tertiary, Primary.
- Opportunity Stage: Prospecting, Qualification, Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost.
- Opportunity Type: `Existing Customer - Upgrade`, `Existing Customer - Replacement`, `Existing Customer - Downgrade`, New Customer.
- Opportunity Delivery/Installation Status: In progress, Yet to begin, Completed.
- Account Type: Prospect, `Customer - Direct`, `Customer - Channel`, Channel Partner / Reseller, Installation Partner, Technology Partner, Other.
- Account Ownership: Public, Private, Subsidiary, Other.
- Account Customer Priority: High, Low, Medium. SLA: Gold, Silver, Platinum, Bronze. Upsell Opportunity: Maybe, No, Yes. Active: No, Yes.

## Not yet seen

- Which fields the Saleshandy prospect receives from each record (Field Mapping tabs list the pairs, see `00-overview.md`).
- A validation rule or duplicate rule on any form. None showed before Save, and no record was saved.
- Screenshots: scratchpad only (`Lead-new.png`, `Contact-new.png`, `Opportunity-new.png`, `Account-new.png`). Not in the repo.
