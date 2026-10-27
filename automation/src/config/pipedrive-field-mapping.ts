// Field Mapping pairs (Saleshandy field to Pipedrive field) the Email Sent smoke rows depend on.
// Read on the staging Field Mapping page of the Pipedrive integration, 2026-10-27. The production
// account uses the same Pipedrive company. The gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts)
// reads these, it never changes them. Expected Close Date is not mapped by decision (QA, 2026-10-23).
export type PipedriveMappingCard = 'Contact Fields' | 'Deal Fields' | 'Organisation Fields';

export const EXPECTED_MAPPING: Record<PipedriveMappingCard, Record<string, string>> = {
  'Contact Fields': {
    'First Name': 'First name',
    'Last Name': 'Last name',
    Email: 'Email',
    'Phone Number': 'Phone',
    'Job Title': 'Job Title',
  },
  'Deal Fields': {
    'Deal Value': 'Value',
  },
  'Organisation Fields': {
    Company: 'Name',
    'Company Website': 'Website',
    'Company Industry': 'Industry',
  },
};
