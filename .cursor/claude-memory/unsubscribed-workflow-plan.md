---
name: unsubscribed-workflow-plan
description: "Prospect is Unsubscribed (AL-4015) agreed plan: MCP browsers explore, Playwright test agents plan/generate/heal, QA gates before any script"
metadata:
  node_type: memory
  type: project
  originSessionId: 0c04fe73-9423-4b23-b684-75e5d9b27e49
  modified: 2026-10-17T18:05:20.205Z
---

Prospect is Unsubscribed in Saleshandy (AL-4015) was started 2026-10-14. Nothing existed for it before.

Agreed with QA (2026-10-14):
- Account: new `unsubscribed` Saleshandy account (`dharmesh+unsubscribed@saleshandy.com`, address still to confirm). QA creates it, turns OTP off, connects HubSpot, then saves the session with `npm run login:saleshandy -- unsubscribed`. Only the `accounts.ts` line has been added so far.
- Trigger: test both the real unsubscribe link and the UI "Mark as Unsubscribed" action.
- Stages: (1) MCP browsers explore staging in the background and write the context and progress files; (2) Playwright test agent planner writes scenarios, QA reviews; (3) generator writes the spec using existing helpers (`saleshandy-to-hubspot.ts`, `activity-rows.ts`), only after QA says generate; (4) healer fixes script and locator failures only, product failures are logged.
- Playwright test agents need `npx playwright init-agents`; check the installed Playwright version first and run it on a branch.

**Why:** QA wants to get the most out of the Playwright test agents and wants to approve each stage before the next.
**How to apply:** do not explore, generate a spec or run init-agents until QA says the account is ready and says go. See [[ask-before-assuming]] and [[resume-pointers]].

**Update 2026-10-17:** QA dropped the original 63-row full spec
(`unsubscribed.spec.ts` / `test-cases/hubspot/unsubscribed.md`) as not
feasible to run and not the focus. The 27-scenario lite spec
(`unsubscribed-lite.spec.ts` / `test-cases/hubspot/unsubscribed-lite.md`,
built 2026-10-17 to cut duplicated "real link" rows and chained prospects)
is now the only regression suite for this workflow. Do not propose
finishing or running rows 16-63 of the full spec; it stays as history only.
