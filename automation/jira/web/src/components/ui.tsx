import type { ReactNode } from 'react';
import { cls } from '../util';

export const Chip = ({ kind, children }: { kind: string; children: ReactNode }) => <span className={`chip ${cls(kind)}`}>{children}</span>;

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; n?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}{o.n !== undefined && <span className="n">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return <div className={`stat ${tone ?? ''}`}><div className="stat-v">{value}</div><div className="stat-l">{label}</div></div>;
}

// Stacked bar of test outcomes.
export function OutcomeBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return <div className="bar empty-bar" />;
  return (
    <div className="bar" role="img" aria-label={Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}>
      {Object.entries(counts).filter(([, v]) => v).map(([k, v]) => <i key={k} className={cls(k)} style={{ width: `${(v / total) * 100}%` }} />)}
    </div>
  );
}
