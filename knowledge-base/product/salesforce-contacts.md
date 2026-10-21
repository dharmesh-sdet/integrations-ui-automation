# Salesforce Contacts: what the tester sees

Notes from a hands-on exploration of the Salesforce test org, 2026-10-16.
All facts are `[staging, 2026-10-16]` unless tagged otherwise.

## Related lists on a Contact record

A Contact's page shows these related sections:

- **Opportunities** -- deals associated with this Contact
- **Cases** -- support cases linked to this Contact
- **Campaign History** -- campaigns the Contact is a member of. Only one
  campaign can be assigned at a time. After adding a campaign, a "New Campaign
  Member" modal opens.
- **Notes & Attachments** -- notes and files linked to this Contact

## Campaign membership

When adding a Contact to a Campaign, the "New Campaign Member" modal has a
Status field with these values:
- Not Contacted
- Unsubscribed
- Bounced
- Clicked
- Opened
- Sent
- Responded

**What is a Campaign?** A Campaign in Salesforce is a marketing initiative
(email blast, webinar, trade show, ad campaign). It tracks which Contacts or
Leads participated and their response status. It is the Salesforce equivalent
of tracking marketing touches. Not directly relevant to the Saleshandy
integration unless a workflow creates campaign members.

## What matters for the Saleshandy integration

- Contacts are one of the four objects the integration can create or update
  (Lead, Contact, Account, Opportunity).
- The related Opportunities list is where deals tied to a Contact appear,
  so a "Create an Opportunity" activity may show up here.
- Notes & Attachments is where "Attach Note" activity results appear on a
  Contact's record.
- Campaign History is not part of the Saleshandy integration.
