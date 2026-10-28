// Which integration a draft belongs to, for the Dashboard and the four platform
// pages. A bug is judged by its summary, then its linked tickets, then its
// description. A comment is judged by the summary of the ticket it is posted on
// (read from Jira), then its own text. Anything that does not match is "other"
// and shows on the Drafts page (not an integration workflow).
export type Platform = 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho' | 'other';

export const PLATFORM_KEYS = ['salesforce', 'hubspot', 'pipedrive', 'zoho'] as const;

// Salesforce: parent AL-4131 and the trigger sub-tasks AL-4132 to AL-4144.
// HubSpot: parent AL-3984 and the trigger sub-tasks AL-4006 to AL-4017 (see docs/jira-reference.md).
// Pipedrive: parent AL-4170 and the trigger sub-tasks AL-4171 to AL-4176.
const SALESFORCE_KEYS = /^AL-(4131|413[2-9]|414[0-4])$/;
const HUBSPOT_KEYS = /^AL-(3984|400[6-9]|401[0-7])$/;
const PIPEDRIVE_KEYS = /^AL-(4170|417[1-6])$/;

function fromText(text: string): Platform | undefined {
  const t = text.toLowerCase();
  if (t.includes('salesforce')) return 'salesforce';
  if (t.includes('hubspot')) return 'hubspot';
  if (t.includes('pipedrive')) return 'pipedrive';
  if (t.includes('zoho')) return 'zoho';
  return undefined;
}

function fromKeys(keys: string[]): Platform | undefined {
  if (keys.some((k) => SALESFORCE_KEYS.test(k))) return 'salesforce';
  if (keys.some((k) => HUBSPOT_KEYS.test(k))) return 'hubspot';
  if (keys.some((k) => PIPEDRIVE_KEYS.test(k))) return 'pipedrive';
  return undefined;
}

export function platformOf(
  draft: { type: 'bug'; summary: string; links: string[]; description: string } | { type: 'comment'; ticket: string; body: string },
  ticketSummary?: string,
): Platform {
  if (draft.type === 'bug') {
    return fromText(draft.summary) ?? fromKeys(draft.links) ?? fromText(draft.description) ?? 'other';
  }
  return fromText(ticketSummary ?? '') ?? fromKeys([draft.ticket]) ?? fromText(draft.body) ?? 'other';
}
