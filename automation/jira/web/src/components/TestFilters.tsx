import { Segmented } from './ui';
import { useStored } from '../util';
import type { Outcome, Review, Test } from '../types';

export type Filters = { outcome: Outcome | 'all' | 'unreviewed'; sort: 'order' | 'failed' | 'slow' };
export const useTestFilters = () => useStored<Filters>('test-filters', { outcome: 'all', sort: 'order' });

export function filterTests(tests: Test[], f: Filters, query: string, review: Review): Test[] {
  const q = query.trim().toLowerCase();
  const out = tests
    .filter((t) => (f.outcome === 'all' ? true : f.outcome === 'unreviewed' ? t.outcome === 'failed' && !review[t.id]?.mark : t.outcome === f.outcome))
    .filter((t) => !q || `${t.title} ${t.workflow} ${t.activity} ${t.ticket} ${t.expected} ${t.whatHappened}`.toLowerCase().includes(q));
  if (f.sort === 'failed') return [...out].sort((a, b) => Number(b.outcome === 'failed') - Number(a.outcome === 'failed'));
  if (f.sort === 'slow') return [...out].sort((a, b) => b.durationSec - a.durationSec);
  return out;
}

export default function TestFilters({ tests, filters, onChange, review }: { tests: Test[]; filters: Filters; onChange: (f: Filters) => void; review: Review }) {
  const n = (o: Outcome) => tests.filter((t) => t.outcome === o).length;
  return (
    <div className="toolbar">
      <Segmented<Filters['outcome']> label="Result" value={filters.outcome} onChange={(outcome) => onChange({ ...filters, outcome })}
        options={[{ id: 'all', label: 'All', n: tests.length }, { id: 'passed', label: 'Passed', n: n('passed') }, { id: 'failed', label: 'Failed', n: n('failed') },
          { id: 'unreviewed', label: 'Not reviewed', n: tests.filter((t) => t.outcome === 'failed' && !review[t.id]?.mark).length }, { id: 'did not run', label: 'Did not run', n: n('did not run') }]} />
      <span className="grow" />
      <Segmented<Filters['sort']> label="Sort" value={filters.sort} onChange={(sort) => onChange({ ...filters, sort })}
        options={[{ id: 'order', label: 'Run order' }, { id: 'failed', label: 'Failed first' }, { id: 'slow', label: 'Slowest' }]} />
    </div>
  );
}
