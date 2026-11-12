---
name: smoke-cover-latest-deal-update
description: QA rule from 2026-11-02 - every next production smoke must include an update check for the latest (newest) deal
metadata:
  node_type: memory
  type: feedback
  originSessionId: 36d546e5-a2a1-4bcd-86b3-71632e1aefc2
  modified: 2026-11-02T16:29:29.993Z
---

From the next production smoke on, add a check that updates the latest (newest) deal of an existing contact, not only create cases.

**Why:** The Zoho Email Sent and Email Opened smokes (2 Nov 2026) covered only the Contact update. Lead, Account and Deal updates were staging-only. QA asked for the newest-deal update to be covered.

**How to apply:** When planning or writing any smoke (any platform), include one row where the contact already has 2 deals and only the newest deal is updated. Plan it with QA first because each row sends a real email. Staging rows to copy: "Contact has 2 deals: only the newest deal updated". See [[zoho-email-opened-smoke-ready]].
