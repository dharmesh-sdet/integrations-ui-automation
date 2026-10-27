---
name: salesforce-hand-written-specs
description: "For the Salesforce workflows, QA does not want the planner/generator/healer agents; hand-write the spec the way the HubSpot ones were built"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3cc35808-34aa-4aae-aab8-2e8251360468
  modified: 2026-10-19T10:39:56.483Z
---

For the Salesforce workflows (started with Email Sent, AL-4132), do NOT use the playwright-test-planner / generator / healer agents. Hand-write the spec following the same steps used for the HubSpot workflows, and only develop what is Salesforce-specific (page objects, flow, test data).

**Why:** QA said on 2026-10-19: "I do not want to use the planner and agent thing. I would use the same steps that I had used for the same workflow on Saleshandy with HubSpot." This overrides CLAUDE.md rule 12 for this work. Scope was said about Email Sent; treat it as applying to the other Salesforce workflows too unless QA says otherwise.

**How to apply:** Copy the shape of `tests/salesforce/reply-received.spec.ts` (fixtures, CSV rows by Scenario, markUsed, Logs polling). Add new page objects as new files, not edits to files another live session is working on. Run the spec and fix script failures yourself. Unconfirmed expected results are recorded as report annotations, not assertions, until QA confirms them. See [[use-playwright-agents-for-workflows]] for the rule this overrides.
