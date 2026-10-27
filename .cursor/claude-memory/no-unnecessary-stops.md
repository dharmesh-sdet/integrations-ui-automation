---
name: no-unnecessary-stops
description: QA wants Claude to keep going once data is given; only ask when information is missing
metadata:
  type: feedback
---

Once QA has provided the data (context, CSV), do the work without stopping to confirm each step, create, update or trigger toggle on staging. Ask only when information is genuinely missing, or for data a test did not create, production, or Jira. Logs: for Email Bounced (QA 2026-10-14) the Logs tab is not looked at at all; the only verification is the HubSpot record matching the Saleshandy data. Elsewhere: don't open entries; refresh 15s then every 10s. Never ask to open an entry.

**Why:** QA (2026-10-08) was frustrated by per-step OK requests during the first MCP walkthrough.
**How to apply:** recorded as standing approval in plan.md rule 7 and the ui-test-from-workflow skill; see [[resume-pointers]].
