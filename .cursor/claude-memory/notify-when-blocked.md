---
name: notify-when-blocked
description: "During development, send a desktop notification (PushNotification) whenever Claude needs QA, e.g. a login page or a decision"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d8a0fdfc-a455-47f3-ab60-f2e029ce2f86
  modified: 2026-10-14T10:26:10.500Z
---

While the project is in development, whenever Claude is blocked on QA (a login page in the MCP browser or a test, a permission block, a decision Claude cannot make), send a PushNotification right away (one line, what QA must do), then ask in chat.

**Why:** QA asked for it on 2026-10-09 after being asked to log in to HubSpot repeatedly without noticing the request in time.
**How to apply:** one notification per blocker, not for routine progress. Also send one when a background run QA is waiting on finishes. Related: [[no-unnecessary-stops]], [[qa-only-runs-script]]

**PushNotification is skipped while the terminal is active** ("Not sent, this terminal is active"). On 2026-10-14 QA asked for a system notification and saw none. Fix: also run `notify-send "<title>" "<one line>"` in Bash (installed at /usr/bin/notify-send, DISPLAY=:0 and the D-Bus session are set; QA confirmed the popup appeared). Send both every time; do not rely on PushNotification alone.
