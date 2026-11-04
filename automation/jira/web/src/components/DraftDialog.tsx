import { useEffect, useState } from 'react';

export type DialogSeed = { title: string; keyLabel: string; key: string; summary: string | null; body: string };

// Copy-only dialog for the bug and comment text built from a test result.
// Sending happens from a saved draft card, never from here.
export default function DraftDialog({ seed, onClose }: { seed: DialogSeed; onClose: () => void }) {
  const [key, setKey] = useState(seed.key);
  const [summary, setSummary] = useState(seed.summary ?? '');
  const [body, setBody] = useState(seed.body);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const copy = async () => {
    const text = `${seed.keyLabel}: ${key}\n${seed.summary === null ? '' : summary + '\n\n'}${body}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* user can select the text */ }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-label={seed.title} onClick={(e) => e.stopPropagation()}>
        <h2>{seed.title}</h2>
        <label>{seed.keyLabel}<input value={key} onChange={(e) => setKey(e.target.value)} /></label>
        {seed.summary !== null && <label>Summary<input value={summary} onChange={(e) => setSummary(e.target.value)} /></label>}
        <label>Description<textarea value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <p className="hint">Review and edit, then copy. To send with one click, ask Claude to draft it: after you confirm it is a bug, it appears under Review as a draft.</p>
        <div className="actions">
          <button onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
