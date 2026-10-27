// Scenarios: test-cases/salesforce/contact-created.md (Regression; AL-4141).
// Data: test-data/salesforce/contact-created.csv (node scripts/make-salesforce-side-data.ts
//   once; the people are replaced before every run).
// Rows: src/flows/salesforce-to-saleshandy.ts. Each row makes a Contact in Salesforce, runs
// the workflow at once through Refold (no 3-hour cron wait) and checks Logs and Saleshandy.
// Every run reads all Contacts of the shared org (up to 200, contact-created:84, :109):
// actions are recorded for QA, and the sequence rows need SEQUENCES_PAUSED=1.
import { test } from '../../src/fixtures/index.ts';
import { person, salesforceSideTests } from '../../src/flows/salesforce-to-saleshandy.ts';

test.use({ account: 'sfcreated' });

salesforceSideTests({
  trigger: 'Contact is created in Salesforce',
  csv: 'salesforce/contact-created.csv',
  mapping: { object: 'Contact', fields: ['Department'] },
  create: (sf, row) => sf.contacts.createContact({ ...person(row), phone: row['Phone Number'], department: row['Department'] }),
  fields: (row) => ({ Department: row['Department'] }),
  actionsProven: false,
  readsWholeOrg: true,
});
