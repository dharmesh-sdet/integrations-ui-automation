---
name: zoho-progress-table
description: QA wants Zoho progress shown as the 7-workflow table in automation/context/zoho/PROGRESS.md
metadata:
  type: feedback
---

When QA asks for Zoho progress, re-check the case counts, spec test counts and commits, update automation/context/zoho/PROGRESS.md, then show its table (Workflow, Context, Test cases, Script, Run status).

**Why:** QA gave this exact format on 2026-10-30 and wants one view of all 7 workflows.
**How to apply:** update the file after every case file, spec or run change. Verify counts with grep, not from memory. See [[zoho-email-opened-progress]], [[zoho-email-bounced-progress]], [[zoho-link-clicked-progress]].
