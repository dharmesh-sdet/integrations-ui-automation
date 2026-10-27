---
name: log-product-issues-dont-wait
description: "When a run shows a product issue, write it in the workflow's progress file and keep going; do not stop to ask bug-or-not"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 51d3eee0-903f-41f8-9505-bf1c5e017e66
  modified: 2026-10-13T09:49:00.977Z
---

When a test fails because of the product (not the script), note it down in the workflow's progress file under "Product issues to review later" (row, what was expected, what was seen, evidence ids) and carry on with the next rows. Do not stop or wait for QA's bug-or-not call; QA reviews the list later.

**Why:** QA said on 2026-10-13: "if there is a product issue, then I want you to note down the issues, then we will do it later on. And do not wait."
**How to apply:** Keep the list per workflow in `automation/context/hubspot/<workflow>-progress.md`. Do not draft or send Jira from it until QA says so (see [[jira-verify-then-draft]]). Fits [[no-unnecessary-stops]].
