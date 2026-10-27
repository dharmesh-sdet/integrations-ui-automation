---
name: compact-at-130k-cheap-subagents
description: "At 120K context tokens notify QA (both channels), stop running subagents, ask QA to switch to a low-token model and /compact; subagents on cheaper models"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e50cf51a-4ec9-427e-b64e-0044f0ab15bd
  modified: 2026-10-16T04:25:58.487Z
---

When the session context reaches about 120K tokens: (1) send PushNotification and notify-send, (2) stop running subagents (TaskStop) after their progress is saved to the progress file, (3) ask QA to switch the main model to a low-token one (/model) and run /compact. Before that, and after, subagents use cheaper models (`model: "sonnet"` for planner/generator/healer, `"haiku"` for read-only lookups).

**Why:** QA asked on 2026-10-16 (first at 130K, changed to 120K) to keep token use down on long sessions.
**How to apply:** Claude cannot run /compact or change its own model, and has no exact context counter, so estimate from the conversation size and act a little early. Write the progress file first so nothing is lost. Related: [[notify-when-blocked]], [[minimal-accurate-updates]], [[resume-pointers]]
