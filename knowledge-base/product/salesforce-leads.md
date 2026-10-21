# Salesforce Leads: what the tester sees

Notes from a hands-on exploration of the Salesforce test org, 2026-10-16.
All facts are `[staging, 2026-10-16]` unless tagged otherwise.

## New Lead form

The form opens from Leads tab > New. It has many fields grouped into
sections:

**Lead Information**
- Lead Owner (pre-filled, e.g. Chintan Sapovadiya)
- Name: Salutation (dropdown, optional), First Name (optional), **Last Name (required)**
- **Company (required)** -- saving without it shows "We hit a snag. Review the following fields: Company"
- **Lead Status (required)** -- dropdown, default "Open - Not Contacted"
- Phone, Mobile, Fax, Title, Email, Lead Source (dropdown), Website,
  Industry (dropdown), Annual Revenue, Rating (dropdown), No. of Employees

**Address Information**
- Street, City, Zip/Postal Code, State/Province, Country

**Additional Information**
- Product Interest (dropdown), Current Generator(s), SIC Code,
  Primary (dropdown), Number of Locations

**Description Information**
- Description (free text)

Required fields summary: Last Name, Company, Lead Status.

## Duplicate detection

When a Lead with the same name and email already exists, Salesforce shows a
warning: "Similar records exist." This appears while filling the form, before
saving.

## Lead record (after creation)

A created Lead's page has 4 main sections:

### 1. Lead section
Shows the Lead's name and key details.

### 2. Lead Status section
The user can modify the status. Values seen in the dropdown:
- Open - Not Contacted
- Working - Contacted
- Closed - Not Converted
- Converted

### 3. Activity section
Has 3 sub-tabs:
- **Activity** -- buttons: New Task, Log a Call, New Event, Email. Below:
  "Upcoming & Overdue" and "Show All Activities"
- **Details** -- all field values for the Lead
- **Chatter** -- an internal feed/log. Changes are automatically posted here
  (e.g. changing Lead Status creates a Chatter entry). Users can also share
  a Post, Poll, or Question. Chatter is essentially an internal communication
  feed so the team knows what is happening with this Lead.

### 4. Related section
- Shows "We found 1 potential duplicate of this lead" with a "View Duplicates"
  link (when duplicates exist)
- Campaign History

## Actions available on a Lead

- Follow
- New Case
- New Note
- Submit for Approval

### New Case
Opens a modal with 4 fields. Status is the only required field. Contact Name
accepts a single contact. Creating a case adds a log entry to the Chatter.

### New Note
Has 3 fields: Title, Private (checkbox), Body. The created note's location
in the UI is not confirmed yet (not found after creation).

### Submit for Approval
Purpose not known yet. Likely part of a Salesforce approval workflow; not
relevant to the Saleshandy integration unless confirmed otherwise.

## What matters for the Saleshandy integration

- The integration creates Leads via API. Required fields (Last Name, Company,
  Lead Status) must be mapped or have defaults, otherwise creation fails.
- Duplicate detection may affect whether a "Create a Lead" activity creates a
  new Lead or warns/blocks.
- Lead Status values (Open - Not Contacted, Working - Contacted, Closed - Not
  Converted, Converted) are the picklist the integration works with.
- The Activity section is where "Record Email Activity" and "Record Call
  Activity" results appear on the Lead's timeline.
- Chatter logs status changes automatically, which can help verify that an
  integration update happened.
