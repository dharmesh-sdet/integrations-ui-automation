import { useState } from 'react';
import { OUTCOMES, type Outcome, type Review, type Test } from './types';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const unique = <T,>(list: T[]) => [...new Set(list)];
export const cls = (o: string) => o.replace(/\s+/g, '-');
export const count = (tests: Test[], o: Outcome) => tests.filter((t) => t.outcome === o).length;

export function summaryText(tests: Test[]): string {
  const parts = OUTCOMES.filter((o) => count(tests, o)).map((o) => `${count(tests, o)} ${o}`);
  let text = `${plural(tests.length, 'test')}: ${parts.join(', ')}.`;
  if (count(tests, 'did not run') && count(tests, 'failed')) text += ' Tests in a workflow run in order, so the ones after a failure do not run.';
  return text;
}

export const shotUrl = (p: string) => (/^(https?:|\/)/.test(p) ? p : '/' + p);
export const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// Small localStorage-backed state. Every access is wrapped: private windows throw.
export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  const set = (v: T) => { setValue(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* not saved */ } };
  return [value, set];
}

// Review marks live only in this browser, per run (same key as the old page).
export function useReview(runId: string | undefined): [Review, (id: string, patch: Review[string]) => void] {
  const key = 'report-review:' + (runId ?? 'all');
  const [review, setReview] = useStored<Review>(key, {});
  return [review, (id, patch) => setReview({ ...review, [id]: { ...(review[id] ?? {}), ...patch } })];
}
