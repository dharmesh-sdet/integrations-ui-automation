import type { Page } from '@playwright/test';

// The four Salesforce-side workflows (Lead / Contact / Account / Opportunity "is created
// in Salesforce") run on a Refold cron, "0 */3 * * *". Refold can start one now for this
// account: POST /api/v2/public/workflow/<id>/execute, the call refold-js executeWorkflow()
// makes (refold.ts:1151), used on staging 2026-10-06 (integration-tests
// contact-created-in-salesforce/test-log.md:77). It works on the account's own copy of
// the workflow, not the template.
//
// The token is the Refold session token Saleshandy webui itself sends to Refold from
// the Integrations page. It is read from that request and kept in memory only: never
// written to a file, a report or an annotation.
const REFOLD = 'https://app.refold.ai/api/v2/public'; // refold-js default; webui does not override it
const SLUG = 'salesforce';

export type RefoldNode = { node_name: string; node_status: string };
export type RefoldExecution = { status: string; nodes: RefoldNode[] };

export class RefoldRunNow {
  private readonly page: Page;

  private readonly token: string;

  private constructor(page: Page, token: string) {
    this.page = page;
    this.token = token;
  }

  // Opens Settings > Integrations on a logged-in Saleshandy page and takes the token
  // from webui's own Refold request (getApp, refold.ts:544).
  static async open(page: Page): Promise<RefoldRunNow> {
    const request = page.waitForRequest((r) => r.url().startsWith('https://app.refold.ai/') && !!r.headers().authorization, { timeout: 60_000 });
    await page.goto('/api-and-integrations/integrations');
    const token = (await request).headers().authorization.replace(/^Bearer\s+/i, '');
    return new RefoldRunNow(page, token);
  }

  private headers() {
    return { authorization: `Bearer ${this.token}`, slug: SLUG, 'content-type': 'application/json' };
  }

  private async get(path: string): Promise<any> {
    const res = await this.page.request.get(`${REFOLD}${path}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`Refold GET ${path.split('?')[0]} answered ${res.status()}.`);
    return res.json();
  }

  // A 24-hex id is used as is. A name is looked up in this account's past runs
  // (each run carries associated_workflow {_id, name}; the cron runs every 3 h once the
  // trigger is on), then in Refold's workflow list.
  async workflowId(nameOrId: string): Promise<string> {
    if (/^[0-9a-f]{24}$/.test(nameOrId)) return nameOrId;
    const wanted = nameOrId.trim().toLowerCase();
    const seen = new Set<string>();
    const runs = await this.get(`/execution?page=1&limit=100&sort=-createdAt&slug=${SLUG}`);
    for (const run of runs.docs ?? []) {
      const wf = typeof run.associated_workflow === 'string' ? JSON.parse(run.associated_workflow) : run.associated_workflow;
      if (wf?.name) seen.add(wf.name);
      if (wf?.name?.trim().toLowerCase() === wanted) return wf._id;
    }
    const list = await this.get(`/workflow?slug=${SLUG}&page=1&limit=100`);
    for (const w of list.docs ?? []) {
      if (w.name) seen.add(w.name);
      if (w.name?.trim().toLowerCase() === wanted) return w._id ?? w.id;
    }
    throw new Error(
      `No workflow named "${nameOrId}" in this account's runs or workflow list` +
        `${seen.size ? ` (names seen: ${[...seen].join(', ')})` : ''}. Turn its trigger on, ` +
        'or pass the 24-character workflow id (Logs > open a run of it: "Execution for workflow <id>").',
    );
  }

  // Starts the workflow now and returns the execution id.
  async run(nameOrId: string): Promise<string> {
    const id = await this.workflowId(nameOrId);
    const res = await this.page.request.post(`${REFOLD}/workflow/${id}/execute`, { headers: this.headers(), data: {} });
    if (!res.ok()) throw new Error(`Refold run-now for workflow ${id} answered ${res.status()}.`);
    const { execution_id: executionId } = await res.json();
    if (!executionId) throw new Error(`Refold run-now for workflow ${id} returned no execution_id.`);
    return executionId;
  }

  async execution(executionId: string): Promise<RefoldExecution> {
    return this.get(`/execution/${executionId}`);
  }

  // Waits until the run leaves RUNNING (statuses: COMPLETED, ERRORED, STOPPED,
  // STOPPING, TIMED_OUT, RUNNING; refold.ts getExecutions) and returns it. A plain
  // loop, not untilPasses, so scripts outside a test can use it too.
  async waitForEnd(executionId: string, timeout = 5 * 60_000): Promise<RefoldExecution> {
    const deadline = Date.now() + timeout;
    for (;;) {
      const run = await this.execution(executionId);
      if (run.status !== 'RUNNING' && run.status !== 'STOPPING') return run;
      if (Date.now() > deadline) throw new Error(`Refold run ${executionId} was still ${run.status} after ${timeout / 1000} s.`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}
