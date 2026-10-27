import fs from 'node:fs';
import path from 'node:path';

// Real emails go out through QA's own mailbox, which has a daily limit. Every
// successful "Send now" appends one line to test-data/sends-<date>.log. A one-line
// append is atomic, so parallel runs never lose a count (the old read, add 1, write
// of send-count.json could), and failed attempts are not counted. Past the cap the
// test fails before sending. Raise it with SEND_CAP=<n>.
// ponytail: check and send are two steps, so lanes that check at cap - 1 at the same
// moment can each send one more; fine below the mailbox's own 150 a day.
const DEFAULT_CAP = 80;

function logFile(): string {
  return path.resolve(import.meta.dirname, `../../test-data/sends-${new Date().toISOString().slice(0, 10)}.log`);
}

export function checkSendCap(): void {
  const cap = Number(process.env.SEND_CAP ?? DEFAULT_CAP);
  const file = logFile();
  const count = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;
  if (count >= cap) {
    throw new Error(`Send cap reached: ${count} of ${cap} emails sent today. Raise SEND_CAP or wait until tomorrow.`);
  }
}

// Called after POST .../emails/send answered 2xx.
export function recordSend(what: string): void {
  fs.mkdirSync(path.dirname(logFile()), { recursive: true });
  fs.appendFileSync(logFile(), `${new Date().toISOString()} ${what}\n`);
}
