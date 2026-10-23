import type { MappingObject } from '../pages/saleshandy/salesforce-integration.page.ts';

// Saleshandy field to Salesforce property, per mapping card. These are the pairs saved on
// the staging accounts (context/salesforce/00-overview.md, "Field mapping values") and the
// ones notes/production-testing/07-salesforce-email-sent.md lists for the production
// account, except the pairs EXPECTED_UNMAPPED lists. Every other row stays "Select". The production gate
// (tests/setup/salesforce-email-sent-prod-gate.spec.ts) maps whatever is missing.
export const EXPECTED_MAPPING: Record<MappingObject, Record<string, string>> = {
  Lead: {
    'First Name': 'First Name',
    'Last Name': 'Last Name',
    Email: 'Email',
    Company: 'Company',
    'Phone Number': 'Phone',
    'Job Title': 'Title',
    Industry: 'Industry',
    Website: 'Website',
    City: 'City',
    State: 'State/Province',
    Country: 'Country',
    'Company Revenue': 'Annual Revenue',
    'Company HQ Location': 'Zip/Postal Code',
  },
  Contact: {
    'First Name': 'First Name',
    'Last Name': 'Last Name',
    Email: 'Email',
    'Phone Number': 'Business Phone',
    Department: 'Department',
    City: 'Other City',
    State: 'Other State/Province',
    Country: 'Other Country',
    'Company HQ Location': 'Other Zip/Postal Code',
    'Profile Picture': 'Photo URL',
  },
  Opportunity: {
    'Prospect Overview': 'Description',
    'Deal Value': 'Amount',
    'Closing Date': 'Close Date',
  },
  Account: {
    Website: 'Website',
    City: 'Billing City',
    State: 'Billing State/Province',
    Country: 'Billing Country',
    'Company Website': 'Website',
    'Company Industry': 'Industry',
    'Company Size': 'Employees',
    'Company Revenue': 'Annual Revenue',
    'Company Founded Year': 'Year Started',
    'Company Phone': 'Account Phone',
    'Company HQ Location': 'Billing Zip/Postal Code',
  },
};

// Saleshandy fields that must stay "Select" (unmapped). Company is not mapped to Account Name
// (QA, 2026-10-22): with it unmapped, Create a Account names the Account with the prospect's
// First Name and Last Name, and Update a Account finds it by that name and no longer renames it
// to the Company. The production gate clears any of these it finds mapped.
export const EXPECTED_UNMAPPED: Partial<Record<MappingObject, string[]>> = {
  Account: ['Company'],
};
