---
name: pipedrive-hand-written-specs
description: "QA 2026-10-24: Pipedrive specs are hand-written like HubSpot/Salesforce, not built with planner/generator/healer; account is gpipedrive"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4dce9f83-4114-4f8a-b196-6982111b56c8
  modified: 2026-10-24T05:45:35.931Z
---

For Pipedrive, hand-write the specs (reuse flows and page objects). Do not use playwright-test-planner/generator/healer, although CLAUDE.md rule 12 says to.

**Why:** QA chose "Hand-write like HubSpot/Salesforce" when asked on 2026-10-24 (Pipedrive Email Sent). Same call as [[salesforce-hand-written-specs]].

**How to apply:** Pipedrive uses one account, `gpipedrive` (dharmesh+gpipedrive@saleshandy.com), sessions `auth/saleshandy-gpipedrive-chromium.json` and `auth/pipedrive-gpipedrive-chromium.json`, saved 2026-10-24. MCP browsers `playwright-pdemailsent` and `playwright-pipedrive-emailsent` in .mcp.json point at them. The pd<workflow> accounts stay unused for now. See [[pipedrive-resume]].
