import { useState } from 'react';
import { MARKS } from './marks';
import { Chip } from './ui';
import DraftDialog, { type DialogSeed } from './DraftDialog';
import { OUTCOMES, type Mark, type Review, type Test, type Workflow } from '../types';
import { count, plural, shotUrl, summaryText, unique } from '../util';

type Props = { review: Review; mark: (id: string, patch: Review[string]) => void; workflows: Workflow[]; tests: Test[] };

function bugSeed(t: Test, wf: Workflow | undefined, note: string | undefined): DialogSeed {
  const body = [
    `Workflow: ${t.workflow}`, `Scenario: ${t.title}`, `Browser: ${t.browser}`, `Run: ${wf?.startedAt ?? ''}`, '',
    'Steps:', ...t.steps.map((s, i) => `${i + 1}. ${s.title}`), '',
    `Expected: ${t.expected || '(fill in)'}`, `Actual: Failed at "${t.failedStep}". ${t.whatHappened}`,
    note ? `\nQA note: ${note}` : '', '', 'Screenshots:', ...t.shots.map((s) => `- reports/${s.path}`), t.trace ? `\nReplay: ${t.trace}` : '',
  ].join('\n').replace(/\n{3,}/g, '\n\n');
  return { title: 'Jira bug draft', keyLabel: 'Related ticket', key: t.ticket || wf?.ticket || '', summary: `${t.workflow}: ${t.title.replace(/^.*?:\s*/, '')} fails at "${t.failedStep}"`, body };
}

function commentSeed(wf: Workflow, tests: Test[], review: Review): DialogSeed {
  const line = (t: Test) => {
    const r = review[t.id] ?? {};
    return `- ${t.title}: ${t.outcome}${t.outcome === 'failed' ? ` (review: ${r.mark}${r.note ? ', ' + r.note : ''})` : ''}`;
  };
  const body = [`Tested "${wf.title}" on staging, ${tests[0]?.browser ?? ''}, ${wf.startedAt}.`, '', summaryText(tests), '', ...tests.map(line)].join('\n');
  return { title: 'Tested comment draft', keyLabel: 'Ticket to comment on', key: wf.ticket, summary: null, body };
}

export function TestCard({ t, review, mark, onBug, defaultOpen }: { t: Test; review: Review; mark: Props['mark']; onBug: (t: Test) => void; defaultOpen?: boolean }) {
  const r = review[t.id] ?? {};
  const failed = t.outcome === 'failed';
  const [note, setNote] = useState(r.note ?? '');
  return (
    <details className={`card test ${failed ? 'is-failed' : ''}`} open={defaultOpen ?? failed}>
      <summary>
        <Chip kind={t.outcome}>{t.outcome}</Chip>
        <span className="title">{t.title}</span>
        {failed && r.mark && <Chip kind={r.mark === 'Bug' ? 'failed' : 'flaky'}>{r.mark}</Chip>}
        <span className="muted">{t.durationSec}s · {t.browser}</span>
      </summary>
      <div className="body">
        <dl className="kv">
          <dt>Expected</dt><dd>{t.expected || <span className="muted">Not found in the scenarios file</span>}</dd>
          {t.ticket && (<><dt>Ticket</dt><dd>{t.ticket}</dd></>)}
          <dt>Result</dt><dd>{t.outcome}</dd>
          {failed && (<>
            <dt>Failed at step</dt><dd>{t.failedStep}</dd>
            <dt>What happened</dt><dd>{t.whatHappened}</dd>
            <dt>Likely reason</dt><dd>{t.likelyReason || <span className="muted">Not written yet</span>}</dd>
          </>)}
        </dl>
        <div className="sub">Steps</div>
        {t.steps.length ? (
          <ol className="steps">{t.steps.map((s, i) => <li key={i} className={s.status}>{s.title}{s.status === 'failed' && ' (failed here)'}</li>)}</ol>
        ) : <span className="muted">No steps ran.</span>}
        {t.shots.length > 0 && (
          <div className="shots">
            {t.shots.map((s, i) => (
              <a key={i} href={shotUrl(s.path)} target="_blank" rel="noopener noreferrer">
                <img loading="lazy" src={shotUrl(s.path)} alt={`Screenshot ${i + 1}`} />
                <span>{s.failed ? 'At failure' : 'At the end'}, page {i + 1}</span>
              </a>
            ))}
          </div>
        )}
        {t.trace && <p className="muted">Step-by-step replay: <code>{t.trace}</code></p>}
        {failed && (
          <div className="review-bar">
            <span className="muted">Your review:</span>
            {MARKS.map((m: Mark) => <button key={m} className={r.mark === m ? 'on' : ''} onClick={() => mark(t.id, { mark: r.mark === m ? undefined : m })}>{m}</button>)}
            <input className="note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => mark(t.id, { note })} />
            <button disabled={r.mark !== 'Bug'} title={r.mark === 'Bug' ? '' : 'Mark it as Bug first'} onClick={() => { mark(t.id, { note }); onBug({ ...t }); }}>Create Jira bug</button>
          </div>
        )}
      </div>
    </details>
  );
}

// One workflow: header with counts, then its activities and test cards.
export function WorkflowBlock({ wf, tests, review, mark, workflows, forceOpen }: Props & { wf: Workflow; forceOpen?: boolean }) {
  const [dialog, setDialog] = useState<DialogSeed | null>(null);
  const unreviewed = tests.filter((t) => t.outcome === 'failed' && !review[t.id]?.mark).length;
  const failed = count(tests, 'failed');
  return (
    <section className={`card wf ${failed ? 'is-failed' : ''}`}>
      <details open={forceOpen || failed > 0}>
        <summary>
          <h3>{wf.title}</h3>
          {OUTCOMES.filter((o) => count(tests, o)).map((o) => <Chip key={o} kind={o}>{count(tests, o)} {o}</Chip>)}
          <span className="muted">Run {wf.startedAt}{wf.durationMin ? ` · ${wf.durationMin} min` : ''}</span>
        </summary>
        <div className="body">
          <div className="wf-meta">
            <span className="muted">{summaryText(tests)}{wf.ticket ? ` · Ticket ${wf.ticket}` : ''}</span>
            <button className="primary" disabled={unreviewed > 0} title={unreviewed ? `Review ${plural(unreviewed, 'failure')} first` : ''} onClick={() => setDialog(commentSeed(wf, tests, review))}>Draft tested comment</button>
          </div>
          {unique(tests.map((t) => t.activity)).map((a) => {
            const cards = tests.filter((t) => t.activity === a);
            return (
              <div key={a} className="activity">
                <h4>{a} <span className="muted">· {summaryText(cards)}</span></h4>
                {cards.map((t) => <TestCard key={t.id} t={t} review={review} mark={mark} onBug={(x) => setDialog(bugSeed(x, wf, review[x.id]?.note))} />)}
              </div>
            );
          })}
        </div>
      </details>
      {dialog && <DraftDialog seed={dialog} onClose={() => setDialog(null)} />}
    </section>
  );
}
