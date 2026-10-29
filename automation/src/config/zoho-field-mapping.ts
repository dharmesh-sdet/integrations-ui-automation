// Field Mapping pairs (Saleshandy field to Zoho field) for a new Zoho account. QA set them by hand
// on the staging account gzoho and Claude read the saved screens, 2026-10-29
// (context/zoho/field-mapping.md). tests/setup/zoho-field-mapping.spec.ts sets them on any account
// that is connected to Zoho. Labels are as the mapping screen shows them. Rows not listed stay on "Select".
export type ZohoMappingCard = 'Contact Fields' | 'Lead Fields' | 'Account Fields' | 'Deal Fields';

export const ZOHO_MAPPING_CARDS: ZohoMappingCard[] = ['Contact Fields', 'Lead Fields', 'Account Fields', 'Deal Fields'];

export const ZOHO_FIELD_MAPPING: Record<ZohoMappingCard, Record<string, string>> = {
  'Contact Fields': {
    'First Name': 'First Name',
    'Last Name': 'Last Name',
    Email: 'Email',
    'Phone Number': 'Phone',
    'Job Title': 'Title',
    Department: 'Department',
    Twitter: 'Twitter',
    City: 'Mailing Address - City',
    State: 'Mailing Address - State / Province',
    Country: 'Mailing Address - Country / Region',
    'Company HQ Location': 'Mailing Address - Zip / Postal Code',
  },
  'Lead Fields': {
    'First Name': 'First Name',
    'Last Name': 'Last Name',
    Email: 'Email',
    'Phone Number': 'Mobile',
    'Job Title': 'Title',
    Industry: 'Industry',
    Twitter: 'Twitter',
    Website: 'Website',
    City: 'Address - City',
    State: 'Address - State / Province',
    Country: 'Address - Country / Region',
    Company: 'Company',
    'Company Website': 'Website',
    'Company Industry': 'Industry',
    'Company Size': 'No. of Employees',
    'Company Revenue': 'Annual Revenue',
    'Company Phone': 'Phone',
    'Company HQ Location': 'Address - Zip / Postal Code',
  },
  'Account Fields': {
    Website: 'Website',
    City: 'Billing Address - City',
    State: 'Billing Address - State / Province',
    Country: 'Billing Address - Country / Region',
    'Company Website': 'Website',
    'Company Industry': 'Industry',
    'Company Size': 'Employees',
    'Company Revenue': 'Annual Revenue',
    'Company Phone': 'Phone',
    'Company HQ Location': 'Billing Address - Zip / Postal Code',
  },
  'Deal Fields': {
    'Prospect Overview': 'Description',
    'Company Revenue': 'Expected Revenue',
    'Deal Value': 'Amount',
    'Closing Date': 'Closing Date',
  },
};
