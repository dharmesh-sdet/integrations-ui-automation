---
name: set-sender-settings-myself
description: "Claude sets sender email account settings (emails/day, interval) on staging itself instead of stopping to ask QA"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5997aea5-196d-4678-ad49-54544fb9606b
  modified: 2026-10-13T05:59:23.154Z
---

When a workflow account's sender email account has the wrong Sending Settings (for example 300 to 1200 s between emails, 15 per day), set them to QA's standard on staging myself, then verify after a reload. QA's standard: account 1 = 50/day, 50 inbox placement, 30-45 s; account 2 = 50, 50, 45-55 s.

**Why:** on 2026-10-12 I stopped and asked QA to fix it because the skill said to; QA answered "the main reason for giving you this information is because you can change those settings by yourself."

**How to apply:** do not stop for this on staging; fix, reload to confirm, note it in the workflow's progress file. Still ask before touching settings on production or accounts a test did not set up. Related: [[qa-only-runs-script]], [[no-unnecessary-stops]].

**Exception (QA, 2026-10-13):** on the `emailbounced` account, QA re-added and reconnected the senders Ritaellis1988+6 (Email Bounced) and +7 (Email Bounced2) and added their own account with sending settings, then said "DO NOT CHANGE THOSE SETTINGS, SO THAT WE CAN USE IT ANYTIME WE WANT." Read them only; never edit sender settings or attached senders on that account. If they look wrong, report and ask. Seen 2026-10-13: +6 50/day, 50 placement, 30-45 s; +7 50/day, placement blank, 45-55 s.
