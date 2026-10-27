---
name: use-playwright-agents-for-workflows
description: "From 2026-10-14 every new workflow uses the Playwright test agents (planner, generator, healer) for planning and spec files, not hand-written specs"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6ae02db3-c6f1-4e09-ae83-8cd5d9688a06
  modified: 2026-10-14T15:37:10.316Z
---

QA rule (2026-10-14): from now on, invoke the Playwright test agents
(`playwright-test-planner`, `playwright-test-generator`, `playwright-test-healer`,
installed in `.claude/agents/`, seed `automation/tests/seed.spec.ts`, plans in
`automation/specs/`) for all remaining workflows, both planning and generating
the spec files. Link Clicked, Email Opened and Email Bounced were done by hand
before this and stay as they are. Reply Received is active and was started by
hand.

**Why:** QA wants the most out of the Playwright test agents and wants real
walkthrough-seen locators instead of specs adapted by hand. Email Bounced smoke
was hand-written on 2026-10-14 and QA asked how it was made (not with the agents).

**How to apply:** for a new workflow, start with the planner (explore in the MCP
browser, save the plan to `specs/`), QA reviews, then the generator writes the
spec (reuse helpers in `src/flows/`), the healer fixes script and locator
failures only (product failures are logged, not bent). Keep QA's gates between
stages as in [[unsubscribed-workflow-plan]] and [[ask-before-assuming]].

**Status 2026-10-14:** QA chose Prospect is Unsubscribed (AL-4015) as the first workflow for the agents. The `unsubscribed` account is NOT ready and the workflow context comes tomorrow (2026-10-15). Do not start the planner until QA says the account is ready and gives the context. Reply Received is finished by hand; Link Clicked, Email Opened and Email Bounced are left as they are.

**Applied 2026-10-14 night:** rule is in `CLAUDE.md`, `plan.md` section 0 rule 12 and the `ui-test-from-workflow` skill. One seed per account in `automation/tests/seeds/`, passed as `seedFile` (project `chromium`); the single `playwright-test` MCP server runs one workflow at a time. Resume 2026-10-15: QA gives the Unsubscribed context, logs in the accounts headed, and decides the Email Bounced production sequence (see `automation/context/hubspot/email-bounced-progress.md`, last section).
