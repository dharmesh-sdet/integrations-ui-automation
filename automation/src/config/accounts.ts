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
} as const;

export type Account = keyof typeof accounts;

export function isAccount(value: unknown): value is Account {
  return typeof value === 'string' && value in accounts;
}
