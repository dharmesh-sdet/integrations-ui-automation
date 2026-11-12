---
name: use-listed-senders-adapt
description: Setup specs must use the email accounts the Add dialog lists, not fixed addresses
metadata:
  type: feedback
---

QA 2026-11-03: when a smoke setup cannot add a hard-coded sender, adapt and use an account that the Add email accounts dialog actually lists. Do not stop and ask for an address, and do not rely on the old sender list in the README.

**Why:** production senders change. A fixed list failed the Zoho Email Bounced setup and wasted a run.

**How to apply:** in setup specs, try preferred senders first, then pick a listed account with the fewest active sequences. Done in `tests/setup/zoho-email-bounced-smoke-sequence.spec.ts` (addListedSender). Related: [[check-live-sessions-on-resume]].
