// Scenarios: test-cases/salesforce/lead-created.md (Regression; AL-4144).
// Data: test-data/salesforce/lead-created.csv (node scripts/make-salesforce-side-data.ts
//   once; the people are replaced before every run).
// Rows: src/flows/salesforce-to-saleshandy.ts. Each row makes a Lead in Salesforce, runs
// the workflow at once through Refold (no 3-hour cron wait) and checks Logs and Saleshandy.
// The Lead workflow reads only Leads created since its last run, so its actions were run
// live (lead-created:137-163) and are asserted, and its Blacklist row is safe.
import { test } from '../../src/fixtures/index.ts';
import { person, salesforceSideTests } from '../../src/flows/salesforce-to-saleshandy.ts';

test.use({ account: 'sfcreated' });

salesforceSideTests({
  trigger: 'Lead is created in Salesforce (V1)',
  csv: 'salesforce/lead-created.csv',
  mapping: { object: 'Lead', fields: ['Company', 'Job Title'] },
  create: (sf, row) => sf.leads.createLead({ ...person(row), company: row['Company'], title: row['Job Title'], phone: row['Phone Number'] }),
  fields: (row) => ({ Company: row['Company'], 'Job Title': row['Job Title'] }),
  actionsProven: true,
  readsWholeOrg: false,
});
