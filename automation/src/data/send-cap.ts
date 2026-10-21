import fs from 'node:fs';
import path from 'node:path';

// Real emails go out through QA's own mailbox, which has a daily limit. Every
// "Send now" counts here, per calendar day, in test-data/send-count.json. Past
// the cap the test fails before sending. Raise it with SEND_CAP=<n>.
const DEFAULT_CAP = 40;

function countFile(): string {
  return path.resolve(import.meta.dirname, '../../test-data/send-count.json');
}

export function claimSend(): void {
  const cap = Number(process.env.SEND_CAP ?? DEFAULT_CAP);
  const today = new Date().toISOString().slice(0, 10);
  const file = countFile();
  let state: { date: string; count: number } = { date: today, count: 0 };
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.date === today) state = saved;
  }
  if (state.count >= cap) {
    throw new Error(`Send cap reached: ${state.count} of ${cap} emails sent today. Raise SEND_CAP or wait until tomorrow.`);
  }
  state.count += 1;
  fs.writeFileSync(file, JSON.stringify(state));
}
