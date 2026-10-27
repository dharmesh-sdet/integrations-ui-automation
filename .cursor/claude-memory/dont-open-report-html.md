---
name: dont-open-report-html
description: Do not show or open reports/*/report.html during a task; always run specs with REPORT_OPEN=never because the reporter auto-opens it
metadata:
  node_type: memory
  type: feedback
  originSessionId: 515bc605-9ce8-41c8-8081-c61fe05b4e11
  modified: 2026-10-13T04:11:31.738Z
---

Do not open, display or quote the run's `report.html` while working. Always start spec runs with `REPORT_OPEN=never` (the reporter in `reporter/plain-report.ts` opens the report in the browser at the end of every run otherwise). Report results from the Playwright run log and results files instead.

**Why:** QA said on 2026-10-13 "I do not want you to show or open the report.html, we can look at it later once the task is completed", and again after runs without REPORT_OPEN=never popped report tabs open.
**How to apply:** prefix every `npx playwright test` / `npm test` with `REPORT_OPEN=never` (the skill's stage 3c already says so); mention the report only once the whole task is done. Related: [[qa-only-runs-script]].
