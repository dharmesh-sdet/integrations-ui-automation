// Replaces every person in test-data/pipedrive/prospect-outcome-updated.csv with a new one
// (src/data/generate.ts, Pipedrive industry values) and clears its .used.txt. Rows keep their Scenario.
//   node scripts/make-pipedrive-outcome-updated-data.ts
import { refreshAll } from '../src/data/generate.ts';

const CSV = 'pipedrive/prospect-outcome-updated.csv';
const replaced = refreshAll(CSV);
console.log(`Replaced ${replaced.length} people in test-data/${CSV}.`);
