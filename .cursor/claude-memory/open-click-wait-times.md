---
name: open-click-wait-times
description: "Seconds to wait before the first and later open or click; staging 10 s each, production 60/120 (open) and 90/180 (click); the spec must wait before every open"
metadata:
  node_type: memory
  type: reference
  originSessionId: 15d72812-095b-45dd-bc61-e54b99182034
  modified: 2026-10-29T11:40:06.882Z
---

Saleshandy config pasted by QA on 2026-10-29. The commented lines are the production values.

```
opened:  first 10 (production 60), later 10 (production 120)
clicked: first 10 (production 90), later 10 (production 180)
```

Staging is 10 s for a first and a later open or click. Production: open 60 s after the send, then 120 s after the previous open; click 90 s, then 180 s. Same as `knowledge-base/product/saleshandy.md` line 48 and `context/hubspot/email-opened.md`.

**Why:** the Pipedrive Email Opened spec opened the email with no wait on 2026-10-29. Rows after "Trigger behavior 3" failed: no "Email is Opened" run, nothing in Pipedrive. After a 10 s wait before each open, Create a Person 1 created the person. See [[pipedrive-email-opened-smoke-ready]].

**How to apply:** every spec that opens an email or clicks a link waits the time for its environment first, from the send for a first event and from the previous event for a later one. Do not assume that no wait is fine because a row once passed. The Pipedrive Email Opened spec has `OPEN_AFTER_MS = 10_000`. The production smoke notes (60 s, 120 s) match.
