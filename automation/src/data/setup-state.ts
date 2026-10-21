import fs from 'node:fs';
import path from 'node:path';

// What a setup already did for each CSV row, kept next to the CSV in
// test-data/<csv name>.setup.json (test-data is not committed). A rerun in a new process
// (-g, or the worker restart after a failed test) reads it and skips finished work, so it
// never makes a second record, prospect or send. Rows are keyed by Email: a refreshed CSV
// has new emails, so old entries stop matching and need no cleanup.
export type SetupStage = 'record' | 'added' | 'sent';

type State = Record<string, Partial<Record<SetupStage, true>>>;

const fileOf = (csvFile: string): string =>
  path.resolve(import.meta.dirname, '../../test-data', csvFile.replace(/\.csv$/, '.setup.json'));

function read(csvFile: string): State {
  const file = fileOf(csvFile);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as State) : {};
}

export function stageDone(csvFile: string, email: string, stage: SetupStage): boolean {
  return read(csvFile)[email]?.[stage] === true;
}

export function markStage(csvFile: string, email: string, stage: SetupStage): void {
  const state = read(csvFile);
  state[email] = { ...state[email], [stage]: true };
  fs.writeFileSync(fileOf(csvFile), JSON.stringify(state, null, 2));
}
