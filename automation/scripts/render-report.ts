// Rebuilds reports/report.html from the kept run data and reports/failure-notes.json,
// without running tests. Used after writing the "Likely reason" of failures.
//   npm run report
import { renderReport } from '../reporter/render.ts';

renderReport('reports/report.html');
console.log('Plain-English report: reports/report.html');
