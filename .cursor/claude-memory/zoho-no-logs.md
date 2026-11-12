---
name: zoho-no-logs
description: "Zoho work: do not read the Saleshandy Logs tab as evidence, check the Zoho record only"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 40e98b90-05e4-4930-a693-01cffff3aa42
  modified: 2026-11-02T10:32:52.089Z
---

QA 2026-10-29, during the Zoho manual exploration: "we do not look at logs". Do not read the Saleshandy Logs tab, its Error rows or its status for Zoho results. Look at the Zoho record itself.

**Why:** QA judges a run by what appears in Zoho, not by Logs rows.
**How to apply:** Zoho exploration, test cases and specs check the Zoho record only. This narrows [[check-crm-first-logs-fallback]] for Zoho: no Logs fallback unless QA asks.
**Exception (QA 2026-11-02):** when QA asks for execution ids in a Zoho bug, read the Logs tab for those runs (read only). Each run shows a 24-character execution id and a step list; the contact step's Request holds the prospect email, so it ties a run to a prospect. Used for AL-4218.
