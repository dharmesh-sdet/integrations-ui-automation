export type Outcome = 'passed' | 'failed' | 'flaky' | 'did not run';
export type PlatformKey = 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho';
export type Platform = PlatformKey | 'other';

export const PLATFORM_KEYS: PlatformKey[] = ['salesforce', 'hubspot', 'pipedrive', 'zoho'];
export const NAMES: Record<Platform, string> = { salesforce: 'Salesforce', hubspot: 'HubSpot', pipedrive: 'Pipedrive', zoho: 'Zoho', other: 'Other' };
export const OUTCOMES: Outcome[] = ['passed', 'failed', 'flaky', 'did not run'];

export type Step = { title: string; status: string };
export type Shot = { path: string; failed?: boolean };
export type Test = {
  id: string; file: string; integration: string; workflow: string; activity: string; browser: string; title: string;
  outcome: Outcome; durationSec: number; expected: string; ticket: string; steps: Step[]; failedStep: string;
  whatHappened: string; shots: Shot[]; trace?: string; likelyReason?: string;
};
export type Workflow = { file: string; integration: string; title: string; ticket: string; runId: string; startedAt: string; durationMin: number; status: string };
export type RunData = { runId?: string; workflows: Workflow[]; tests: Test[] };

type Person = { name: string };
export type Sent = { key: string; url: string; problems: string[]; at: string };
type Live = { status: string; assignee: string; summary: string };
type Base = { id: string; platform: Platform; sent?: Sent; waitingFor?: string };
export type BugDraft = Base & {
  type: 'bug'; summary: string; description: string; project: string; priority: string; environment: string; epic: string;
  assignee: Person; qa: Person; links: string[]; attachments: string[]; live?: Live | null;
};
export type CommentDraft = Base & { type: 'comment'; ticket: string; body: string };
export type Draft = BugDraft | CommentDraft;
export type DraftsResponse = { site: string; drafts: Draft[] };

export type Mark = 'Bug' | 'Not a bug' | 'Retest';
export type Review = Record<string, { mark?: Mark; note?: string }>;
