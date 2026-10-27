---
name: salesforce-tab-must-stay-open
description: Keep a Salesforce browser tab open throughout Salesforce script testing; closing it can break the Saleshandy<->Salesforce connection
metadata:
  node_type: memory
  type: project
  originSessionId: ba9d1940-165d-49b0-978a-abed8fbd25b2
  modified: 2026-10-19T11:00:13.355Z
---

QA: keep a Salesforce tab open in the browser for the whole duration of
Salesforce script testing. Do not close it until testing is done.

**Why:** On 2026-10-19, during Reply Received > Create a Lead testing
(`sfreplyreceived` account), the Saleshandy-side Salesforce integration
dropped to "Re-connect" (disconnected) mid-session, right after QA re-ran
`npm run login:salesforce -- sfreplyreceived` to refresh an expired browser
storage-state session. The Saleshandy<->Salesforce OAuth connection appears
tied to having a live Salesforce session/tab, separate from the Playwright
storage-state file used for automation. Losing that open tab/session is the
suspected trigger for the integration disconnecting, which then breaks
*everything* downstream (Logs tab fails to load, workflows don't fire, no
Leads get created) with confusing, unrelated-looking symptoms.

**How to apply:** Before starting any Salesforce workflow test run, confirm
a Salesforce tab is open and logged in, and leave it open for the whole run.
If the Saleshandy Salesforce integration card ever shows "Re-connect"
instead of "Connected" (Settings > Integrations > Salesforce), stop and
reconnect before continuing — do not keep debugging downstream symptoms
(Logs hangs, missing Leads) as if they were script or timing issues; check
the connection state first. See [[unsubscribed-workflow-plan]] for how
Salesforce workflow testing is otherwise scoped.
