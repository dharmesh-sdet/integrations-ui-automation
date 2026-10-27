// Scenario rows of the four Salesforce-side workflows (Lead / Contact / Account /
// Opportunity is created in Salesforce). One CSV row per scenario, found by its
// Scenario column; the rows are made by scripts/make-salesforce-side-data.ts and the
// people are replaced before every run (src/data/global-setup.ts).
export const SALESFORCE_SIDE_SCENARIOS = [
  'Add Prospect in Saleshandy > 1',
  'Move Prospect to another Sequence in Saleshandy > 1',
  'Assign a tag to Prospect in Saleshandy > 1',
  'Mark Prospect as Paused in Saleshandy > 1',
  'Mark Prospect as Replied in Saleshandy > 1',
  'Mark Prospect as Finished in Saleshandy > 1',
  'Mark Prospect as Unsubscribed in Saleshandy > 1',
] as const;

// Lead only: it reads only Leads created since its last run. The other three read every
// record of the shared org, so a blacklist would block every domain in it.
export const LEAD_ONLY_SCENARIOS = ['Blacklist a Domain in Saleshandy > 1'] as const;

// The four workflows: spec slug -> Lead only rows or not.
export const SALESFORCE_SIDE_WORKFLOWS = {
  'lead-created': true,
  'contact-created': false,
  'account-created': false,
  'opportunity-created': false,
} as const;
