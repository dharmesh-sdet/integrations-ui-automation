---
name: no-claude-in-chrome-realistic-cases
description: Never use Claude in Chrome (token heavy); use the project playwright MCP servers. Test case proposals must be realistic and doable.
metadata:
  node_type: memory
  type: feedback
  originSessionId: dc12f22b-ab56-4d8b-8f4d-4c818e837c98
  modified: 2026-10-20T07:21:31.674Z
---

QA, 2026-10-20: do NOT use Claude in Chrome (mcp__claude-in-chrome__*) for exploration; it burns tokens. Use the per-account Playwright MCP servers (e.g. playwright-sfreplyreceived), and prefer `browser_evaluate` to read small bits of text over full `browser_snapshot` (snapshots of Saleshandy pages are huge).

QA also wants test case proposals to be realistic: scenarios and steps a person can actually do (one prospect, one reply, records prepared in the UI, check in Salesforce), not invented edge cases. See [[minimal-accurate-updates]].

**Why:** token cost, and unrealistic rows waste run time and cannot be confirmed.
**How to apply:** pick the account's own MCP server; keep snapshots narrow; cut any row that needs data or states that cannot be set up by hand.
