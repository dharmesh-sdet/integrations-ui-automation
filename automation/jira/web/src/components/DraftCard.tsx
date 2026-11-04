import { useState } from 'react';
import { Chip } from './ui';
import { deleteDraft } from '../api';
import type { Draft } from '../types';
import { fmtDate } from '../util';

export const isOpen = (d: Draft) => d.type === 'bug' && !!d.sent && !!d.live && !/^(done|released|closed)$/i.test(d.live.status);

type Props = {
  d: Draft; site: string; selected?: boolean; onSelect?: (on: boolean) => void;
  onSend: (d: Draft, edits: { summary?: string; text: string }) => Promise<void>; onChanged: () => void;
};

export default function DraftCard({ d, site, selected, onSelect, onSend, onChanged }: Props) {
  const bug = d.type === 'bug';
  const [summary, setSummary] = useState(bug ? d.summary : '');
  const [text, setText] = useState(bug ? d.description : d.body);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const send = async () => {
    setBusy(true); setStatus('Sending...');
    try { await onSend(d, { summary: bug ? summary : undefined, text }); onChanged(); }
    catch (e) { setStatus('Not sent. ' + (e as Error).message); setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try { await deleteDraft(d.id); onChanged(); } catch (e) { setStatus('Not deleted. ' + (e as Error).message); setBusy(false); setConfirmDel(false); }
  };
  const fields: [string, string][] = bug
    ? [['Project / Type', d.project + ' / Bug'], ['Priority', d.priority], ['Environment', d.environment], ['Epic Link', d.epic], ['Assignee', d.assignee.name], ['QA', d.qa.name],
       ['Linked Work Items', d.links.length ? 'Relates to ' + d.links.join(', ') : 'None'], ['Attachments', d.attachments.length ? d.attachments.join(', ') : 'None']]
    : [['Ticket', d.ticket]];

  return (
    <details className={`card draft ${d.sent ? '' : 'waiting'}`} open={!d.sent}>
      <summary>
        {!d.sent && onSelect && <input type="checkbox" className="pick" checked={!!selected} onClick={(e) => e.stopPropagation()} onChange={(e) => onSelect(e.target.checked)} aria-label="Select draft" />}
        <Chip kind={d.sent ? 'passed' : 'flaky'}>{bug ? 'Bug' : 'Comment'}</Chip>
        <span className="title">{bug ? d.summary : 'Comment on ' + d.ticket}</span>
        {d.sent && (<>
          <Chip kind="passed">{bug ? 'Created' : 'Posted'}</Chip>
          <a href={d.sent.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><b>{d.sent.key}</b></a>
          <span className="muted">{fmtDate(d.sent.at)}</span>
        </>)}
        {d.sent && d.type === 'bug' && d.live && <Chip kind={isOpen(d) ? 'flaky' : 'passed'}>{d.live.status}</Chip>}
        <button className="icon-btn" title="Delete this local draft file (does not touch Jira)" aria-label="Delete draft" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDel(true); }}>×</button>
      </summary>
      <div className="body">
        {confirmDel && (
          <div className="confirm">
            <span>Delete this draft file? This only removes the local file. It does not undo anything already sent to Jira.</span>
            <button className="danger" disabled={busy} onClick={del}>Delete file</button>
            <button onClick={() => setConfirmDel(false)}>Keep</button>
          </div>
        )}
        {d.sent && (
          <p className="lead">
            {d.type === 'bug' && d.live ? <>Jira status: <b>{d.live.status}</b> · {d.live.assignee}</> : null}
            {d.sent.problems.map((p, i) => <span key={i} className="problem"><Chip kind="failed">Not done</Chip> {p}</span>)}
          </p>
        )}
        {d.waitingFor && !d.sent && <p className="hint">{d.waitingFor}</p>}
        {bug && <label>Summary<input value={summary} disabled={!!d.sent} onChange={(e) => setSummary(e.target.value)} /></label>}
        <textarea className="mono" value={text} disabled={!!d.sent} onChange={(e) => setText(e.target.value)} aria-label="Text" />
        <dl className="kv">{fields.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {!d.sent && (
          <div className="review-bar">
            <button className="primary" disabled={busy} onClick={send}>{bug ? 'Create bug in Jira' : 'Post comment in Jira'}</button>
            <span className={`muted ${status.startsWith('Not') ? 'err' : ''}`}>{status || `One click sends it to ${site}.`}</span>
          </div>
        )}
      </div>
    </details>
  );
}
