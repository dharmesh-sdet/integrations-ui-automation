---
name: cap-real-email-sends
description: "Real emails go out through QA's own mailbox; sends are capped per day (SEND_CAP, default 80 since 2026-10-21, of the 150 a day the mailbox allows)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: af81afe8-e8a5-4ecb-8162-600dd06a817d
  modified: 2026-10-20T10:33:44.772Z
---

QA's own mailbox (rudra@saleshandy.com sender on sfemailsent) was exhausted by a full Salesforce Email Sent run on 2026-10-20 and the sequence turned off after a failed send.

**Why:** the test sends real emails through QA's account; an uncapped run burns the daily limit and pauses the sequence.

**How to apply:** `claimSend()` in `automation/src/data/send-cap.ts` counts every Send now per day (test-data/send-count.json). Default 80 (raised from 40 by QA on 2026-10-21 for the 35-send Reply Received suite), override with `SEND_CAP=<n>`. Plan runs and reruns around it; rerun only failed rows. See [[run-failed-rows-not-whole-suite]].
