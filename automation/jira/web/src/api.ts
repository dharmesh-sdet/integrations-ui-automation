import { useCallback, useEffect, useRef, useState } from 'react';
import type { DraftsResponse, RunData } from './types';

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// Asks the server every `ms`, keeps the old value when a read fails, and only
// replaces the value when the answer changed (so typing in a card is not lost).
export function usePoll<T>(url: string, ms: number): { data: T | null; error: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const last = useRef('');
  const load = useCallback(async () => {
    try {
      const next = await getJson<T>(url);
      const snap = JSON.stringify(next);
      setError(false);
      if (snap !== last.current) { last.current = snap; setData(next); }
    } catch { setError(true); }
  }, [url]);
  useEffect(() => {
    load();
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, ms]);
  return { data, error, reload: load };
}

export const useDrafts = () => usePoll<DraftsResponse>('/api/drafts', 5000);
export const useTests = () => usePoll<RunData>('/api/tests', 15000);

export async function sendDraft(id: string, edits: { summary?: string; text: string }): Promise<void> {
  const res = await fetch(`/api/drafts/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edits) });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error);
}

export async function deleteDraft(id: string): Promise<void> {
  const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error);
}
