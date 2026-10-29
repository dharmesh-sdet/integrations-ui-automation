// One Saleshandy account per workflow, so workflows running in parallel never
// change each other's Saleshandy settings or data. A spec picks its account with
// test.use({ account: '<name>' }). Saleshandy sessions are saved per account:
// auth/saleshandy-<account>-<browser>.json (npm run login:saleshandy -- <account>).
// Every account connects the one common HubSpot portal and shares its session,
// auth/hubspot-<browser>.json (QA, 2026-10-09). Specs on that portal can see each
// other's HubSpot records, so checks find records by their own unique emails.
// No passwords here, only which login to use.
// Named after the HubSpot workflows in context/hubspot/00-overview.md.
export const accounts = {
  contactupdated: { saleshandy: 'dharmesh+contactupdated@saleshandy.com' }, // Contact Updated in HubSpot
  contactcreated: { saleshandy: 'dharmesh+contactcreated@saleshandy.com' }, // Contact Created/Properties Updated in HubSpot
  dealcreated: { saleshandy: 'dharmesh+dealcreated@saleshandy.com' }, // Deal Created/Properties Updated in HubSpot
  companycreated: { saleshandy: 'dharmesh+companycreated@saleshandy.com' }, // Company Created/Properties Updated in HubSpot
  emailsent: { saleshandy: 'dharmesh+emailsent@saleshandy.com' }, // Email Sent from Saleshandy
  replyreceived: { saleshandy: 'dharmesh+replyreceive@saleshandy.com' }, // Reply is received in Saleshandy
  outcomeupdated: { saleshandy: 'dharmesh+outcomeupdated@saleshandy.com' }, // Prospect Outcome is updated in Saleshandy
  linkclick: { saleshandy: 'dharmesh+linkclick@saleshandy.com' }, // Link Clicked in Saleshandy
  emailbounced: { saleshandy: 'dharmesh+emailbounced@saleshandy.com' }, // Email is Bounced in Saleshandy (TODO(needs-input): confirm the address QA signs up with)
  emailopened: { saleshandy: 'dharmesh+emailopened@saleshandy.com' }, // Sequence Email is Opened in Saleshandy (TODO(needs-input): confirm the address QA signs up with)
  unsubscribed: { saleshandy: 'dharmesh+unsubscribed@saleshandy.com' }, // Prospect is Unsubscribed in Saleshandy
  sfreplyreceived: { saleshandy: 'dharmesh+salesforce+1@saleshandy.com' }, // Reply is received in Saleshandy, Salesforce (QA, 2026-10-16)
  sfemailsent: { saleshandy: 'dharmesh+salesforce+emailsent@saleshandy.com' }, // Email Sent from Saleshandy, Salesforce (QA, 2026-10-19). Own Saleshandy-side session (playwright-sfemailsent, auth/saleshandy-sfemailsent-chromium.json) and own Salesforce-org session (playwright-salesforce-emailsent, auth/salesforce-sfemailsent-chromium.json), separate from sfreplyreceived's
  sfoutcomeupdated: { saleshandy: 'dharmesh+salesforce+prospectoutcome@saleshandy.com' }, // Prospect Outcome is updated in Saleshandy, Salesforce (QA, 2026-10-20). Own Saleshandy-side session (playwright-sfoutcomeupdated, auth/saleshandy-sfoutcomeupdated-chromium.json) and own Salesforce-org session (playwright-salesforce-outcomeupdated, auth/salesforce-sfoutcomeupdated-chromium.json)
  // Pipedrive workflows (QA, 2026-10-23). Each has its own Saleshandy account and Pipedrive company, and its own saved sessions
  // (auth/saleshandy-<account>-chromium.json, auth/pipedrive-<account>-chromium.json). Addresses are a default, TODO(needs-input): confirm each one QA signs up with.
  gpipedrive: { saleshandy: 'dharmesh+gpipedrive@saleshandy.com' }, // QA, 2026-10-24: Saleshandy account for Pipedrive, with its own Saleshandy and Pipedrive sessions
  pdemailsent: { saleshandy: 'dharmesh+pdemailsent@saleshandy.com' }, // Email Sent from Saleshandy, Pipedrive
  pdreplyreceived: { saleshandy: 'dharmesh+pdreplyreceived@saleshandy.com' }, // Reply is received in Saleshandy, Pipedrive
  pdlinkclicked: { saleshandy: 'dharmesh+pdlinkclicked@saleshandy.com' }, // Link Clicked in Saleshandy, Pipedrive
  pdemailopened: { saleshandy: 'dharmesh+pdemailopened@saleshandy.com' }, // Sequence Email is Opened in Saleshandy, Pipedrive
  pdemailbounced: { saleshandy: 'dharmesh+pdemailbounced@saleshandy.com' }, // Email is Bounced in Saleshandy, Pipedrive
  pdunsubscribed: { saleshandy: 'dharmesh+pdunsubscribed@saleshandy.com' }, // Prospect is Unsubscribed in Saleshandy, Pipedrive
  pdoutcomeupdated: { saleshandy: 'dharmesh+pdoutcomeupdated@saleshandy.com' }, // Prospect Outcome is updated in Saleshandy, Pipedrive
  // Zoho CRM (2026-10-28). Own Saleshandy and Zoho sessions (auth/saleshandy-gzoho-chromium.json,
  // auth/zoho-gzoho-chromium.json). TODO(needs-input): confirm the address QA signs up with.
  gzoho: { saleshandy: 'dharmesh+gzoho@saleshandy.com' }, // Saleshandy account for Zoho CRM, Email Sent only
  // Every Zoho workflow except Email Sent, run in parallel with gzoho (QA, 2026-10-29). Own sessions
  // (auth/saleshandy-notemailsentzoho-chromium.json, auth/zoho-notemailsentzoho-chromium.json).
  // TODO(needs-input): confirm the address QA signs up with.
  notemailsentzoho: { saleshandy: 'dharmesh+notemailsentzoho@saleshandy.com' }, // Saleshandy account for Zoho CRM, all workflows except Email Sent
  // Lead / Contact / Account / Opportunity is created in Salesforce (tests/salesforce/*-created.spec.ts).
  // One account for the four Salesforce-side workflows: each spec turns on only its own
  // trigger, and fewer accounts on the shared Salesforce user means fewer token drops.
  // QA sets up by hand: the account, Salesforce connected, Field Mapping (Lead, Contact as in
  // src/config/salesforce-field-mapping.ts), Sequence A (Step 1) and Sequence B, both paused,
  // OTP off, both logins (npm run login:saleshandy -- sfcreated, npm run login:salesforce -- sfcreated).
  sfcreated: { saleshandy: 'TODO(needs-input): the staging login QA creates for this account' },
  // Production smoke tests (notes/production-testing/). `environment: 'production'`
  // points the Saleshandy side at my.saleshandy.com (src/config/environments.ts).
  // The HubSpot portal is the same shared one.
  emailopenedprod: { saleshandy: 'PROD_USERNAME in automation/.env', environment: 'production' }, // Production smoke: Sequence Email is Opened in Saleshandy
} as const;

export type Account = keyof typeof accounts;

export function isAccount(value: unknown): value is Account {
  return typeof value === 'string' && value in accounts;
}
