import { useMemo } from 'react';
import { Navigate, NavLink, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import type { ShellCtx } from '../components/Shell';
import DraftList from '../components/DraftList';
import { WorkflowBlock } from '../components/TestCards';
import TestFilters, { filterTests, useTestFilters } from '../components/TestFilters';
import { Empty } from '../components/ui';
import { useDrafts, useTests } from '../api';
import { NAMES, PLATFORM_KEYS, type PlatformKey } from '../types';
import { summaryText, useReview } from '../util';

export default function PlatformPage() {
  const { platform } = useParams();
  const [params] = useSearchParams();
  const { query } = useOutletContext<ShellCtx>();
  const key = platform as PlatformKey;
  const valid = PLATFORM_KEYS.includes(key);
  const tab = params.get('tab') === 'drafts' ? 'drafts' : 'test';
  const drafts = useDrafts();
  const tests = useTests();
  const [review, mark] = useReview(undefined);
  const [filters, setFilters] = useTestFilters();
  const mine = useMemo(() => (tests.data && valid ? tests.data.tests.filter((t) => tests.data!.workflows.some((w) => w.file === t.file && w.integration.toLowerCase() === key)) : []), [tests.data, key, valid]);
  const shown = useMemo(() => filterTests(mine, filters, query, review), [mine, filters, query, review]);
  if (!valid) return <Navigate to="/" replace />;
  const wfs = tests.data?.workflows.filter((w) => w.integration.toLowerCase() === key).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) ?? [];
  const list = drafts.data?.drafts.filter((d) => d.platform === key) ?? [];
  return (
    <>
      <h1>{NAMES[key]}</h1>
      <div className="tabs">
        <NavLink to={`/${key}?tab=test`} className={tab === 'test' ? 'on' : ''}>Test</NavLink>
        <NavLink to={`/${key}?tab=drafts`} className={tab === 'drafts' ? 'on' : ''}>Drafts <span className="n">{list.length}</span></NavLink>
      </div>
      {tab === 'test' ? (
        <>
          <p className="muted">Latest result of each {NAMES[key]} test, most recent first. {mine.length ? summaryText(mine) : ''}</p>
          {mine.length > 0 && <TestFilters tests={mine} filters={filters} onChange={setFilters} review={review} />}
          {wfs.map((wf) => {
            const t = shown.filter((x) => x.file === wf.file);
            return t.length ? <WorkflowBlock key={wf.file} wf={wf} workflows={wfs} tests={t} review={review} mark={mark} forceOpen={!!query} /> : null;
          })}
          {tests.data && !shown.length && <Empty>{mine.length ? 'No test matches the filter.' : `No test results for ${NAMES[key]} yet.`}</Empty>}
        </>
      ) : drafts.data ? (
        <>
          <h2 className="section">Jira bugs</h2>
          <DraftList drafts={list.filter((d) => d.type === 'bug')} site={drafts.data.site} query={query} reload={drafts.reload} bulk />
          <h2 className="section">Comments</h2>
          <DraftList drafts={list.filter((d) => d.type === 'comment')} site={drafts.data.site} query={query} reload={drafts.reload} bulk />
        </>
      ) : <Empty>Loading drafts.</Empty>}
    </>
  );
}
