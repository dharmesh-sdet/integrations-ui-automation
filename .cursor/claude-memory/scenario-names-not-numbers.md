---
name: scenario-names-not-numbers
description: "QA 2026-10-27: describe test cases by their real scenario, not by row number; leave Trigger behavior 2, 4 and 5 out of every report"
metadata:
  node_type: memory
  type: feedback
  originSessionId: aade25dd-504c-4fa5-8076-b0157a1b31ef
  modified: 2026-10-27T07:37:43.323Z
---

In every status, result or summary, describe a test case by its real scenario (for example "Create a Person with the Extra Configuration skipped, outcome Not Now"), never only by its number or a label like "Trigger behavior 3". Do not mention Trigger behavior 2, 4 and 5 (the weak passes) in reports or counts.

**Why:** QA said on 2026-10-27 that answers based on numbers are hard to use, and that those three rows must not be shared.

**How to apply:** Use the Scenario and Do columns of the test case file for the wording. Keep this together with [[simple-english-replies]] and [[minimal-accurate-updates]]. The rows stay in the spec and the test case file; only reports leave them out.
