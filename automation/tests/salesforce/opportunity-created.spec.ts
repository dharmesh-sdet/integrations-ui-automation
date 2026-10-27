// Scenarios: test-cases/salesforce/opportunity-created.md (Regression; AL-4142).
// Data: test-data/salesforce/opportunity-created.csv (node scripts/make-salesforce-side-data.ts
//   once; the people are replaced before every run).
// Rows: src/flows/salesforce-to-saleshandy.ts. The workflow imports an Opportunity's contact
// roles (opportunity-created:79-82), so each row makes a Contact, then an Opportunity from
// that Contact (which adds it as contact role, contacts.page.ts newOpportunity), runs the
// workflow at once through Refold (no 3-hour cron wait) and checks Logs and Saleshandy.
// Every run reads all Opportunities of the shared org (up to 200, opportunity-created:52):
// actions are recorded for QA, and the sequence rows need SEQUENCES_PAUSED=1.
import { test } from '../../src/fixtures/index.ts';
import { RUN_STAMP, fullName, person, salesforceSideTests } from '../../src/flows/salesforce-to-saleshandy.ts';
import { inDays } from '../../src/pages/salesforce/salesforce.ts';

test.use({ account: 'sfcreated' });

salesforceSideTests({
  trigger: 'Opportunity is created in Salesforce',
  csv: 'salesforce/opportunity-created.csv',
  mapping: { object: 'Contact', fields: ['Department'] },
  create: async (sf, row) => {
    await sf.contacts.createContact({ ...person(row), phone: row['Phone Number'], department: row['Department'] });
    // Stage "Prospecting" is on the org's Stage list (context/salesforce/reply-received-progress.md).
    await sf.contacts.newOpportunity(row['Email'], { name: `${fullName(row)} ${RUN_STAMP}`, stage: 'Prospecting', closeDate: inDays(30) });
  },
  fields: (row) => ({ Department: row['Department'] }),
  actionsProven: false,
  readsWholeOrg: true,
});
