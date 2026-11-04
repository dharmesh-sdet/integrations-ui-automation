import { Link } from 'react-router-dom';
import DraftList from '../components/DraftList';
import { Empty, OutcomeBar, Stat } from '../components/ui';
import { isOpen } from '../components/DraftCard';
import { useDrafts, useTests } from '../api';
import { useOutletContext } from 'react-router-dom';
import type { ShellCtx } from '../components/Shell';
import { NAMES, OUTCOMES, PLATFORM_KEYS, type Draft } from '../types';
import { count, plural, summaryText } from '../util';

export default function Dashboard() {
  const { query } = useOutletContext<ShellCtx>();
  const drafts = useDrafts();
  const tests = useTests();
  if (!drafts.data || !tests.data) return <><h1>Dashboard</h1><Empty>Loading.</Empty></>;
  const all = drafts.data.drafts;
  const other = all.filter((d) => d.platform === 'other');
  const testsOf = (key: string) => tests.data!.tests.filter((t) => tests.data!.workflows.some((w) => w.file === t.file && w.integration.toLowerCase() === key));
  const bugs = (list: Draft[]) => list.filter((d) => d.type === 'bug');
  const platformTests = PLATFORM_KEYS.flatMap(testsOf);
  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">Pick a platform to see its tests and its Jira drafts.</p>
      <div className="stats">
        <Stat label="Platform tests" value={platformTests.length} />
        <Stat label="Passed" value={count(platformTests, 'passed')} tone="passed" />
        <Stat label="Failed" value={count(platformTests, 'failed')} tone="failed" />
        <Stat label="Bugs still open" value={bugs(all).filter(isOpen).length} tone="flaky" />
        <Stat label="Waiting for a click" value={all.filter((d) => !d.sent).length} />
      </div>
      {all.some((d) => !d.sent) && (
        <>
          <h2 className="section">Waiting for one click</h2>
          <DraftList drafts={all} site={drafts.data.site} query={query} reload={drafts.reload} onlyWaiting bulk />
        </>
      )}
      <div className="grid">
        {PLATFORM_KEYS.map((key) => {
          const mine = all.filter((d) => d.platform === key);
          const t = testsOf(key);
          return (
            <Link key={key} to={'/' + key} className="card dash">
              <h2>{NAMES[key]}</h2>
              <OutcomeBar counts={Object.fromEntries(OUTCOMES.map((o) => [o, count(t, o)]))} />
              <p className="muted">{t.length ? summaryText(t) : 'No results yet'}</p>
              <dl className="kv">
                <dt>Jira bugs</dt><dd>{bugs(mine).length}{bugs(mine).some((d) => d.sent) ? ` · ${bugs(mine).filter(isOpen).length} still open` : ''}</dd>
                <dt>Comments</dt><dd>{mine.filter((d) => d.type === 'comment').length}</dd>
                <dt>Waiting for a click</dt><dd>{mine.filter((d) => !d.sent).length}</dd>
              </dl>
            </Link>
          );
        })}
      </div>
      {other.length > 0 && <p className="hint">{plural(other.length, 'draft')} could not be matched to a platform.</p>}
    </>
  );
}
