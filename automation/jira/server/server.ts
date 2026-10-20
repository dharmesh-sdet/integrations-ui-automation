// Local server for the review page (plan section 10): serves reports/ and
// sends the drafts in jira/drafts/ to Jira when the reviewer clicks the button.
// Start: npm run jira, then open http://localhost:4317. Check the connection
// without writing anything: npm run jira:check.
//
// A draft is a JSON file Claude writes after QA confirmed the bug (or asked
// for the comment); see docs/bug-creation.md. Once sent, the file records the
// Jira key and cannot be sent again. Failed writes are never retried. A
// draft can be deleted from the review page; that only removes the local
// file, it does not touch Jira (and does nothing to an already-sent one).
import { createServer, type ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { addComment, createBug, describeFields, issueStatus, JIRA_SITE, whoAmI, type BugDraft, type CommentDraft, type Sent } from './jira-client.ts';

const root = path.resolve(import.meta.dirname, '../..');
const reportsDir = path.resolve(root, process.env.REPORTS_DIR ?? 'reports');
const draftsDir = path.join(root, 'jira/drafts');
const PORT = Number(process.env.JIRA_SERVER_PORT ?? 4317);

type Draft = (BugDraft | CommentDraft) & { sent?: Sent & { at: string }; waitingFor?: string };

if (process.argv.includes('--check')) {
  // Read-only: who the token belongs to and how the custom fields are set up.
  console.log(`Connected to ${JIRA_SITE} as ${await whoAmI()}`);
  console.log(JSON.stringify(await describeFields(), null, 2));
  process.exit(0);
}

const draftFile = (id: string) => path.join(draftsDir, `${id}.json`);
const readDraft = (id: string): Draft => JSON.parse(readFileSync(draftFile(id), 'utf8'));
const listDrafts = () =>
  readdirSync(draftsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ id: f.replace(/\.json$/, ''), ...readDraft(f.replace(/\.json$/, '')) }));

// Live Jira status of sent bugs, read at most every 20 s per ticket (the page
// asks every few seconds). A failed read only hides the status.
const statusCache = new Map<string, { at: number; value: { status: string; assignee: string } | null }>();
async function liveStatus(key: string) {
  const hit = statusCache.get(key);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;
  const value = await issueStatus(key).catch(() => null);
  statusCache.set(key, { at: Date.now(), value });
  return value;
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.zip': 'application/zip', '.md': 'text/plain; charset=utf-8' };

// One send at a time per draft, so a double click cannot create two tickets.
const sending = new Set<string>();

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/drafts') {
      const drafts = await Promise.all(listDrafts().map(async (d) => (d.sent && d.type === 'bug' ? { ...d, live: await liveStatus(d.sent.key) } : d)));
      return json(res, 200, { site: JIRA_SITE, drafts });
    }

    const send = url.pathname.match(/^\/api\/drafts\/([\w-]+)\/send$/);
    if (req.method === 'POST' && send) {
      // Only the review page served from here may send.
      if (req.headers.origin !== `http://localhost:${PORT}`) return json(res, 403, { error: 'Open the report from this server to send.' });
      const id = send[1];
      if (!existsSync(draftFile(id))) return json(res, 404, { error: 'Draft not found.' });
      if (sending.has(id)) return json(res, 409, { error: 'This draft is being sent.' });
      sending.add(id);
      try {
        const draft = readDraft(id);
        if (draft.sent) return json(res, 409, { error: `Already sent as ${draft.sent.key}.` });
        let raw = '';
        for await (const chunk of req) raw += chunk;
        // The reviewer's edits on the page win over the file.
        const edits = JSON.parse(raw || '{}');
        if (draft.type === 'bug') Object.assign(draft, { summary: edits.summary ?? draft.summary, description: edits.text ?? draft.description });
        else Object.assign(draft, { body: edits.text ?? draft.body });
        const sent = draft.type === 'bug' ? await createBug(draft, root) : await addComment(draft);
        draft.sent = { ...sent, at: new Date().toISOString() };
        writeFileSync(draftFile(id), JSON.stringify(draft, null, 2) + '\n');
        return json(res, 200, draft.sent);
      } catch (e) {
        // Shown to the reviewer as is; never retried.
        return json(res, 502, { error: (e as Error).message });
      } finally {
        sending.delete(id);
      }
    }

    const del = url.pathname.match(/^\/api\/drafts\/([\w-]+)$/);
    if (req.method === 'DELETE' && del) {
      // Only the review page served from here may delete.
      if (req.headers.origin !== `http://localhost:${PORT}`) return json(res, 403, { error: 'Open the report from this server to delete.' });
      const id = del[1];
      if (!existsSync(draftFile(id))) return json(res, 404, { error: 'Draft not found.' });
      // Removes the local draft file only; a sent draft stays in Jira as is.
      unlinkSync(draftFile(id));
      return json(res, 200, { deleted: id });
    }

    if (req.method === 'GET') {
      const rel = decodeURIComponent(url.pathname === '/' ? '/report.html' : url.pathname);
      const file = path.join(reportsDir, rel);
      if (file.startsWith(reportsDir + path.sep) && existsSync(file) && statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        return res.end(readFileSync(file));
      }
    }
    json(res, 404, { error: 'Not found.' });
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Review page with Jira buttons: http://localhost:${PORT}`));
