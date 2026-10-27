// Scenarios: test-cases/salesforce/account-created.md (Regression; AL-4143).
// Data: test-data/salesforce/account-created.csv (node scripts/make-salesforce-side-data.ts
//   once; the people are replaced before every run).
// Rows: src/flows/salesforce-to-saleshandy.ts. The workflow imports an Account's Contacts
// (account-created:81-82), so each row makes an Account and a Contact on it in Salesforce,
// runs the workflow at once through Refold (no 3-hour cron wait) and checks Logs and
// Saleshandy. Every run reads all Accounts of the shared org (up to 200,
// account-created:50): actions are recorded for QA, the sequence rows need SEQUENCES_PAUSED=1.
import { test } from '../../src/fixtures/index.ts';
import { RUN_STAMP, person, salesforceSideTests } from '../../src/flows/salesforce-to-saleshandy.ts';

test.use({ account: 'sfcreated' });

salesforceSideTests({
  trigger: 'Account is created in Salesforce',
  csv: 'salesforce/account-created.csv',
  mapping: { object: 'Contact', fields: ['Department'] },
  create: async (sf, row) => {
    const name = `${row['Company']} ${RUN_STAMP}`;
    await sf.accounts.createAccount({ name, billingCity: row['City'] });
    await sf.accounts.newContact(name, { ...person(row), phone: row['Phone Number'], department: row['Department'] });
  },
  fields: (row) => ({ Department: row['Department'] }),
  actionsProven: false,
  readsWholeOrg: true,
});
