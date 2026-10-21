import type { Account } from './accounts.ts';

// What tests/setup/account-setup.spec.ts sets up on a new workflow account,
// after QA has created it, turned off OTP and connected HubSpot (QA, 2026-10-09).

// Saleshandy field to HubSpot property. Pairs from context/hubspot/00-overview.md
// (Field mapping). Contact skips Birthday: new accounts have no such field (QA, 2026-10-09).
// Labels are as the mapping screen shows them (note the curly apostrophe).
export const fieldMapping = {
  'Contact Properties': {
    'First Name': 'First Name',
    'Last Name': 'Last Name',
    Email: 'Email',
    'Phone Number': 'Phone Number',
    'Job Title': 'Job Title',
    Industry: 'Industry',
    LinkedIn: 'LinkedIn URL',
    Twitter: 'Twitter Username',
    Facebook: 'Facebook ID',
    Website: 'Website URL',
    City: 'City',
    State: 'State/Region',
    Country: 'Country/Region',
    Company: 'Company Name',
    'Company Website': 'Website URL',
    'Company Industry': 'Industry',
    'Company Size': 'Company size',
    'Company Revenue': 'Annual Revenue',
    'Company Phone': 'Mobile Phone Number',
    'Person’s Seniority Level': 'Employment Seniority',
    'Company HQ Location': 'Country/Region Code',
    'Closing Date': 'Close Date',
  },
  'Company Properties': {
    Email: 'HubSpot Owner Email',
    Industry: 'Industry group',
    LinkedIn: 'Linkedin handle',
    Website: 'Website URL',
    City: 'City',
    State: 'State/Region',
    Country: 'Country/Region',
    Company: 'Company name',
    'Company Domain': 'Company Domain Name',
    'Company Website': 'Website URL',
    'Company Industry': 'Industry group',
    'Company Size': 'Company size segment',
    'Company Founded Year': 'Year Founded',
    'Company HQ Location': 'Country/Region Code',
    'Closing Date': 'Close Date',
  },
  // Only these two pairs (QA, 2026-10-09; linkclick had Deal Value to Deal Name).
  'Deal Properties': {
    'Deal Value': 'Amount',
    'Closing Date': 'Close Date',
  },
} as const;

export type MappingObject = keyof typeof fieldMapping;

// "Template N" is the Nth template on the Saleshandy Library tab of the step
// editor's Template picker (QA, 2026-10-09). Names in list order, seen 2026-10-09.
export const libraryTemplates = [
  'Quick email',
  'Addressing pain points',
  'Upselling',
  'Exclusive Sales offer',
  'Looking for the best person to contact',
  'First outreach(Introduction)',
  'Selling Feature to benefit',
  'Met Someoneone at event',
] as const;

// One Email step variant. Numbering restarts in every sequence: Step 1 A =
// Template 1, Step 1 B = Template 2, Step 2 A = Template 3, ... (QA, 2026-10-09).
export type StepVariant = { step: number; variant: string; template: number };
export type SequenceSetup = { name: string; steps: StepVariant[] };

// Sequences each account needs. They stay Draft (QA, 2026-10-09).
// Before activating one for a timed run, give it an always-on sending
// schedule (Settings > Sending Schedule > Add Schedule, all days/hours).
// HubSpot's default window (Mon-Fri 09:00-18:00) queues step emails as
// "Scheduled Tomorrow" and fails rows that run outside it (lesson
// 2026-10-18, Unsubscribed AL-4015). Not set here; done by hand or by the
// generator agent during stage 3.
export const sequences: Partial<Record<Account, SequenceSetup[]>> = {
  companycreated: [
    { name: 'Sequence A', steps: [{ step: 1, variant: 'A', template: 1 }] },
    { name: 'Sequence B', steps: [{ step: 1, variant: 'A', template: 1 }] },
  ],
  // Prospect is Unsubscribed (AL-4015): one step; sender and activation are
  // done in the exploration and in the spec, not here.
  unsubscribed: [
    { name: 'HubSpot Prospect Unsubscribed QA', steps: [{ step: 1, variant: 'A', template: 1 }] },
  ],
  // Production smoke test (notes/production-testing/01-email-opened.md): one
  // step; activated and given its sender by hand-off steps, not here.
  emailopenedprod: [
    { name: 'HubSpot Email Opened Smoke', steps: [{ step: 1, variant: 'A', template: 1 }] },
  ],
};

// The body starts with this line, a blank line, then the template.
export function stepHeading(sequence: string, s: StepVariant): string {
  return `${sequence} - Step ${s.step} ${s.variant}`;
}
