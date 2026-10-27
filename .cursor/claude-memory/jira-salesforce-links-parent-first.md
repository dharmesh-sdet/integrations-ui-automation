---
name: jira-salesforce-links-parent-first
description: "Salesforce bug drafts link AL-4131 first, then the trigger's tracking ticket (e.g. AL-4132)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b9f710a8-5671-4b0c-aaca-028b8ae2b586
  modified: 2026-10-21T10:44:09.320Z
---

Every Salesforce bug draft sets Linked Work Items to AL-4131 (parent "[SalesForce] Triggers and Activity") first, then the workflow's sub-task (Email Sent = AL-4132, Reply Received = AL-4133, Prospect Outcome = AL-4134, and so on), then any sibling bugs.

**Why:** QA, 2026-10-21: AL-4168 and AL-4169 were drafted with only AL-4132 (plus siblings). QA wants every Salesforce bug to point to the parent AL-4131, then the trigger ticket.

**How to apply:** in `jira/drafts/*.json` write `"links": ["AL-4131", "AL-4132", ...]`. Rule is also in `automation/jira/docs/jira-reference.md` (Field defaults and Salesforce tracking tickets). Adding a link to an already sent bug is a Jira write: ask QA first. Related: [[jira-verify-then-draft]].
