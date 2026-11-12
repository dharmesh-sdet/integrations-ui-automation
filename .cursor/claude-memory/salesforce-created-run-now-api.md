---
name: salesforce-created-run-now-api
description: "QA 2026-11-05: regression and production scripts for Salesforce-side workflows must use the developer's run-now API, create the data by script, and leave QA only to verify in Saleshandy"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 198e5cb7-6574-4578-9020-0570d17ac05e
  modified: 2026-11-05T11:25:32.249Z
---

For the four "... is created in Salesforce" workflows (Lead V1, Contact, Opportunity, Account), every regression and production script uses the developer's run-now API (`npm run sf:run-now -- <account> "<workflow name>"`, `src/flows/refold-run-now.ts`). It starts the workflow at once instead of waiting for the 3-hour cron. The script also creates the Salesforce data, so QA only verifies the prospect in Saleshandy.

**Why:** QA 2026-11-05. The cron runs every 3 hours (`0 */3 * * *`), so waiting for it is not a usable test. QA wants the Salesforce side automated and the check done on the Saleshandy side only. See [[qa-only-runs-script]].

**How to apply:**
- Never plan a wait of up to 3 hours, and never ask QA to create a Salesforce record by hand or to click Run.
- The run reads up to 200 org records (Lead keeps a cursor), so check only your own prospect. Never pick blacklist or unsubscribe while other tests run. Turn the trigger off afterwards.
- Open point, asked 2026-11-05: the repo has no script that creates Salesforce records through an API. The existing code creates them through the Salesforce screen (`src/pages/salesforce/*.page.ts`). Do not claim a record-creation API exists until QA names it. Facts: `knowledge-base/product/workflow-behaviour-dev-kit.md` section 3.
