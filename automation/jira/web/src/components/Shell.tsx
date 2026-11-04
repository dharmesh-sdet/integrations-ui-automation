import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NAMES, PLATFORM_KEYS } from '../types';
import { useDrafts } from '../api';

export type ShellCtx = { query: string };

const SHORTCUTS: [string, string][] = [['/', 'Focus search'], ['g then d', 'Go to Dashboard'], ['g then s / h / p / z', 'Go to Salesforce / HubSpot / Pipedrive / Zoho'], ['t', 'Switch theme'], ['?', 'Show this list'], ['Esc', 'Close a dialog']];
const GO: Record<string, string> = { d: '/dashboard', s: '/salesforce', h: '/hubspot', p: '/pipedrive', z: '/zoho' };

export default function Shell() {
  const [query, setQuery] = useState('');
  const [help, setHelp] = useState(false);
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme ?? '');
  const search = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const { data, error } = useDrafts();
  const waiting = data?.drafts.filter((d) => !d.sent).length ?? 0;

  const applyTheme = (t: string) => {
    setTheme(t);
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    try { t ? localStorage.setItem('theme', t) : localStorage.removeItem('theme'); } catch { /* not saved */ }
  };
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

  useEffect(() => {
    let g = false;
    let timer: number;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (g && GO[e.key]) { nav(GO[e.key]); g = false; return; }
      g = false;
      if (e.key === '/') { e.preventDefault(); search.current?.focus(); }
      else if (e.key === '?') setHelp((h) => !h);
      else if (e.key === 't') applyTheme(dark ? 'light' : 'dark');
      else if (e.key === 'g') { g = true; clearTimeout(timer); timer = window.setTimeout(() => (g = false), 1200); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [nav, dark]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo">J</span><div><b>Jira</b><small>Tests and drafts</small></div></div>
        <nav aria-label="Pages">
          <NavLink to="/dashboard">Dashboard{waiting > 0 && <span className="badge">{waiting}</span>}</NavLink>
          <div className="nav-label">Platforms</div>
          {PLATFORM_KEYS.map((k) => <NavLink key={k} to={'/' + k}>{NAMES[k]}</NavLink>)}
        </nav>
        <div className="side-foot">
          <span className={`dot ${error ? 'bad' : 'ok'}`} />{error ? 'Server not reachable' : data ? data.site : 'Connecting'}
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <input ref={search} className="search" type="search" placeholder="Search tests, drafts and tickets   ( / )" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
          <button className="ghost" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts">?</button>
          <button className="ghost" onClick={() => applyTheme(dark ? 'light' : 'dark')} aria-label="Switch theme">{dark ? 'Light' : 'Dark'}</button>
        </header>
        <main><Outlet context={{ query } satisfies ShellCtx} /></main>
      </div>
      {help && (
        <div className="overlay" onClick={() => setHelp(false)}>
          <div className="modal" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard shortcuts</h2>
            <dl className="keys">{SHORTCUTS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
            <div className="actions"><button onClick={() => setHelp(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
