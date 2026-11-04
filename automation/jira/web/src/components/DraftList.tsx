import { useMemo, useState } from 'react';
import DraftCard, { isOpen } from './DraftCard';
import { Empty, Segmented } from './ui';
import { sendDraft } from '../api';
import type { Draft } from '../types';

const DAY = 86400000;
type Status = 'all' | 'waiting' | 'sent' | 'open';
type Sort = 'new' | 'old';
const sentAt = (d: Draft) => (d.sent ? new Date(d.sent.at).getTime() : 0);
const text = (d: Draft) => (d.type === 'bug' ? `${d.summary} ${d.description} ${d.sent?.key ?? ''}` : `${d.ticket} ${d.body} ${d.sent?.key ?? ''}`).toLowerCase();

type Props = { drafts: Draft[]; site: string; query: string; reload: () => Promise<void>; onlyWaiting?: boolean; bulk?: boolean };

export default function DraftList({ drafts, site, query, reload, onlyWaiting, bulk }: Props) {
  const [status, setStatus] = useState<Status>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkState, setBulkState] = useState<{ confirm: boolean; log: string[]; running: boolean }>({ confirm: false, log: [], running: false });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts
      .filter((d) => (onlyWaiting ? !d.sent : true))
      .filter((d) => status === 'all' || (status === 'waiting' ? !d.sent : status === 'sent' ? !!d.sent : isOpen(d)))
      .filter((d) => !q || text(d).includes(q));
  }, [drafts, status, query, onlyWaiting]);

  const waiting = shown.filter((d) => !d.sent);
  const sent = shown.filter((d) => d.sent).sort((a, b) => (sort === 'new' ? sentAt(b) - sentAt(a) : sentAt(a) - sentAt(b)));
  const recent = sent.filter((d) => Date.now() - sentAt(d) < 7 * DAY);
  const past = sent.filter((d) => Date.now() - sentAt(d) >= 7 * DAY);
  const counts = { all: drafts.length, waiting: drafts.filter((d) => !d.sent).length, sent: drafts.filter((d) => d.sent).length, open: drafts.filter(isOpen).length };

  const card = (d: Draft) => (
    <DraftCard key={d.id} d={d} site={site} onChanged={reload} onSend={(x, e) => sendDraft(x.id, e)}
      selected={picked.has(d.id)} onSelect={bulk ? (on) => setPicked((s) => { const n = new Set(s); on ? n.add(d.id) : n.delete(d.id); return n; }) : undefined} />
  );

  const chosen = waiting.filter((d) => picked.has(d.id));
  const runBulk = async () => {
    setBulkState({ confirm: false, log: [], running: true });
    const log: string[] = [];
    // One at a time, in order. The first failure stops the run and nothing is retried.
    for (const d of chosen) {
      try { await sendDraft(d.id, { summary: d.type === 'bug' ? d.summary : undefined, text: d.type === 'bug' ? d.description : d.body }); log.push(`Sent: ${d.type === 'bug' ? d.summary : 'Comment on ' + d.ticket}`); setBulkState((s) => ({ ...s, log: [...log] })); }
      catch (e) { log.push(`Stopped. Not sent: ${d.type === 'bug' ? d.summary : 'Comment on ' + d.ticket}. ${(e as Error).message}`); break; }
    }
    setPicked(new Set());
    setBulkState({ confirm: false, log, running: false });
    await reload();
  };

  return (
    <div className="list">
      <div className="toolbar">
        {!onlyWaiting && (
          <Segmented<Status> label="Status" value={status} onChange={setStatus}
            options={[{ id: 'all', label: 'All', n: counts.all }, { id: 'waiting', label: 'Waiting', n: counts.waiting }, { id: 'sent', label: 'Sent', n: counts.sent }, { id: 'open', label: 'Still open', n: counts.open }]} />
        )}
        <span className="grow" />
        {!onlyWaiting && <Segmented<Sort> label="Sort" value={sort} onChange={setSort} options={[{ id: 'new', label: 'Newest' }, { id: 'old', label: 'Oldest' }]} />}
        {bulk && waiting.length > 0 && (<>
          <button onClick={() => setPicked(new Set(picked.size === waiting.length ? [] : waiting.map((d) => d.id)))}>{picked.size === waiting.length ? 'Clear selection' : 'Select all'}</button>
          <button className="primary" disabled={!chosen.length || bulkState.running} onClick={() => setBulkState((s) => ({ ...s, confirm: true }))}>Send selected ({chosen.length})</button>
        </>)}
      </div>
      {bulkState.confirm && (
        <div className="confirm block">
          <b>Send {chosen.length} to Jira?</b>
          <ul>{chosen.map((d) => <li key={d.id}>{d.type === 'bug' ? 'Bug: ' + d.summary : 'Comment on ' + d.ticket}</li>)}</ul>
          <span className="muted">They go one at a time. The first failure stops the rest. A failed one is never retried.</span>
          <div className="actions"><button className="primary" onClick={runBulk}>Yes, send</button><button onClick={() => setBulkState((s) => ({ ...s, confirm: false }))}>Cancel</button></div>
        </div>
      )}
      {bulkState.log.length > 0 && <div className="confirm block">{bulkState.log.map((l, i) => <div key={i} className={l.startsWith('Stopped') ? 'err' : ''}>{l}</div>)}</div>}
      {waiting.map(card)}
      {recent.map(card)}
      {past.length > 0 && <details className="past"><summary>Past ({past.length})</summary>{past.map(card)}</details>}
      {!shown.length && <Empty>{drafts.length ? 'No draft matches the filter.' : 'Nothing here yet.'}</Empty>}
    </div>
  );
}
