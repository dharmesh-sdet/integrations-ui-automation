// Jira Cloud REST API v3 calls for the local server (site: docs/jira-reference.md).
// Credentials come from the environment (JIRA_EMAIL, JIRA_API_TOKEN in .env);
// they are never logged or returned. No call here is ever retried.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { markdownToAdf } from './adf.ts';

export const JIRA_SITE = 'https://saleshandy.atlassian.net';

export type Person = { name: string; accountId: string };
export type BugDraft = {
  type: 'bug';
  project: string;
  summary: string;
  description: string;
  priority: string;
  environment: string;
  epic: string;
  assignee: Person;
  qa: Person;
  links: string[];
  attachments: string[];
};
export type CommentDraft = { type: 'comment'; ticket: string; body: string };

type Field = { id: string; name: string; custom: boolean; schema?: { type?: string; items?: string; custom?: string } };

export class JiraError extends Error {}

function auth(): string {
  const { JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new JiraError('Jira is not connected: add JIRA_EMAIL and JIRA_API_TOKEN to automation/.env, then start the server again.');
  }
  return 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
}

async function call(method: string, apiPath: string, body?: unknown, headers: Record<string, string> = {}): Promise<any> {
  const isForm = body instanceof FormData;
  const res = await fetch(JIRA_SITE + apiPath, {
    method,
    headers: { Authorization: auth(), Accept: 'application/json', ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  // Jira's own error text, shown to the reviewer as is.
  if (!res.ok) throw new JiraError(`Jira answered ${res.status} ${res.statusText} for ${method} ${apiPath}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

// Custom fields are found by their name; the ids differ per site.
async function customField(name: string): Promise<Field | undefined> {
  const fields: Field[] = await call('GET', '/rest/api/3/field');
  return fields.find((f) => f.custom && f.name === name);
}

// Shapes a value the way the field's type needs it.
function fieldValue(field: Field, value: string): unknown {
  const { type, items } = field.schema ?? {};
  if (type === 'option') return { value };
  if (type === 'user') return { accountId: value };
  if (type === 'array' && items === 'user') return [{ accountId: value }];
  if (type === 'array' && items === 'option') return [{ value }];
  return value;
}

export async function whoAmI(): Promise<string> {
  return (await call('GET', '/rest/api/3/myself')).displayName;
}

// What the Environment, Epic Link and QA fields are on this site (for `npm run jira:check`).
export async function describeFields(): Promise<Record<string, Field | 'not found'>> {
  const out: Record<string, Field | 'not found'> = {};
  for (const name of ['Environment', 'Epic Link', 'QA']) out[name] = (await customField(name)) ?? 'not found';
  return out;
}

export type Sent = { key: string; url: string; problems: string[] };

// Creates the bug, then its links and attachments. If a link or attachment
// fails, the bug stays and the error is returned in `problems` (no retry).
export async function createBug(draft: BugDraft, root: string): Promise<Sent> {
  const fields: Record<string, unknown> = {
    project: { key: draft.project },
    issuetype: { name: 'Bug' },
    summary: draft.summary,
    description: markdownToAdf(draft.description),
    priority: { name: draft.priority },
    assignee: { accountId: draft.assignee.accountId },
  };
  const environment = await customField('Environment');
  const qa = await customField('QA');
  const epic = await customField('Epic Link');
  if (!environment) throw new JiraError('Custom field "Environment" was not found in Jira; nothing was created.');
  if (!qa) throw new JiraError('Custom field "QA" was not found in Jira; nothing was created.');
  fields[environment.id] = fieldValue(environment, draft.environment);
  fields[qa.id] = fieldValue(qa, draft.qa.accountId);
  // Sites without the "Epic Link" field set the epic as the parent.
  if (epic) fields[epic.id] = draft.epic;
  else fields.parent = { key: draft.epic };

  const issue = await call('POST', '/rest/api/3/issue', { fields });
  const sent: Sent = { key: issue.key, url: `${JIRA_SITE}/browse/${issue.key}`, problems: [] };
  for (const key of draft.links) {
    await call('POST', '/rest/api/3/issueLink', { type: { name: 'Relates' }, inwardIssue: { key: issue.key }, outwardIssue: { key } }).catch((e) =>
      sent.problems.push(`Link to ${key} not added. ${e.message}`),
    );
  }
  for (const file of draft.attachments) {
    try {
      const form = new FormData();
      form.append('file', new Blob([readFileSync(path.resolve(root, file))]), path.basename(file));
      await call('POST', `/rest/api/3/issue/${issue.key}/attachments`, form, { 'X-Atlassian-Token': 'no-check' });
    } catch (e) {
      sent.problems.push(`Attachment ${file} not added. ${(e as Error).message}`);
    }
  }
  return sent;
}

export async function addComment(draft: CommentDraft): Promise<Sent> {
  await call('POST', `/rest/api/3/issue/${draft.ticket}/comment`, { body: markdownToAdf(draft.body) });
  return { key: draft.ticket, url: `${JIRA_SITE}/browse/${draft.ticket}`, problems: [] };
}

// Current status and assignee of a ticket (read-only), for the review page.
export async function issueStatus(key: string): Promise<{ status: string; assignee: string; summary: string }> {
  const { fields } = await call('GET', `/rest/api/3/issue/${key}?fields=status,assignee,summary`);
  return { status: fields.status?.name ?? '', assignee: fields.assignee?.displayName ?? 'Unassigned', summary: fields.summary ?? '' };
}
