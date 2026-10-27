---
name: multi-account-plan
description: One Saleshandy account per workflow for parallel runs; built 2026-10-08
metadata:
  node_type: memory
  type: project
  originSessionId: b7523cf0-a34d-4cff-a21a-d906c39d77e8
  modified: 2026-10-08T12:00:37.412Z
---

QA wants one Saleshandy account per workflow (spec file), so each workflow can change settings and data without clashing with others when run in parallel. Accounts are named after the workflow, e.g. dharmesh+emailsent@saleshandy.com. Each one gets its own HubSpot portal (to be created). Chromium only for now.

Built 2026-10-08 at QA's request, so the email-sent session (automation-fc) wouldn't build on the old setup; that session was sent a note about it. Details are in automation/context/project.md (row "Accounts per workflow"). The old auth files hold dharmesh+ev (Saleshandy) and dharmesh+deal (HubSpot), not emailsent, so emailsent needs a fresh login. All 8 workflow accounts are listed in src/config/accounts.ts; contact-updated uses its own contactupdated account.

The machine is an i7-12650H (16 threads) with 15 GB RAM. RAM limits how many workers can run, not CPU. The estimate was about 3 workers with the usual Chrome load, or 4–5 with Chrome closed. This has not been measured.

Workers decision (2026-10-08): QA chose `workers: 4` for local runs; go back to 3 if runs swap or time out (`npm test -- --workers=3`). Set in playwright.config.ts.

Where we left off (end of 2026-10-08):
- Saved logins: only `auth/saleshandy-emailsent-chromium.json`. There is no HubSpot login for emailsent yet, and no logins for the other 7 accounts.
- QA's next steps: create the remaining accounts, each connected to its own HubSpot portal, then run `npm run login:saleshandy -- <name>` and `npm run login:hubspot -- <name>` for each.
- contact-updated.spec.ts won't run until both contactupdated logins exist.
- Not done yet: the memory test to confirm 4 workers (run 1, 2, then 3 specs while watching RAM).

**Why:** shared integration settings and connected portals make parallel workflows on one account interfere with each other.
**How to apply:** when building it, key session files by workflow, not by worker index. When adding a workflow, add its account to src/config/accounts.ts and test.use({ account }) in its spec. Related: [[ask-before-assuming]]
