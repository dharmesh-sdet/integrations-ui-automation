---
name: jira-environment-production
description: "Jira bug drafts: Environment field = Production, and the description Note says 'Affected Environment - Staging'"
metadata:
  type: feedback
---

From 2026-10-13, every bug draft sets the Jira Environment field to `Production` (not Staging) and the description's Note section includes the line "Affected Environment - Staging." (the environment where it was actually seen).

**Why:** QA wants the ticket to flow to "QA Approved" instead of "Done" (Production-environment workflow). The Environment field drives that, so the field is Production while the note keeps the real test environment. QA said: "from here onwards".
**How to apply:** applies to all new bug drafts in `automation/jira/drafts/`, overriding the "Staging for Staging sources" default in `jira/docs/jira-reference.md`. Fits [[jira-verify-then-draft]].
