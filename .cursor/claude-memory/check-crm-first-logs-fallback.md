---
name: check-crm-first-logs-fallback
description: "How QA verifies a workflow run: wait 15s, look in the CRM first; Logs only as a fallback; Error is reported, not auto-failed"
metadata:
  node_type: memory
  type: feedback
  originSessionId: dc12f22b-ab56-4d8b-8f4d-4c818e837c98
  modified: 2026-10-20T11:33:34.619Z
---

QA, 2026-10-20: do not poll Logs after every action. QA's own flow: after the trigger event (e.g. Mark as replied) wait 15 s, open the CRM (Salesforce or HubSpot) and look for the record. If it is not there, wait 5 s, hard refresh, look again. Only if it is still missing, open Logs. Logs Success: go back to the CRM and verify. Logs Error: do not fail the row; ask QA with the scenario and the steps done.

Exception: rows that QA says are "checked from Logs only" (e.g. Salesforce Create a Contact + Attach Note): read the Logs status, record Success or Error, neither is a bug by itself.

Also: scripts must stay short (QA does not want ~80 min specs). Batch setup, group rows by trigger configuration, wait once per group. See [[run-failed-rows-not-whole-suite]] and [[no-claude-in-chrome-realistic-cases]].

**Why:** Logs polling adds minutes per row, and a Logs Success does not prove the record is right.
**How to apply:** in new specs, check the CRM record first; open Logs only as a fallback; record Error as a question for QA. The older ui-test-from-workflow wording (Refresh Logs 15 s after the action) still says Logs first; propose updating it, do not edit the skill without QA's OK.
