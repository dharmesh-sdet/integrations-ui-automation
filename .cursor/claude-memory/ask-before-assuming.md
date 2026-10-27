---
name: ask-before-assuming
description: "QA wants questions asked before any assumption, including design/structure choices, not just missing facts"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1c95ac0f-ffc4-4beb-a5e0-bdeca4137534
  modified: 2026-10-08T09:47:04.317Z
---

Always ask before assuming anything: scope, file layout, naming, interpretation of a vague request, product behavior. Batch the questions in one AskUserQuestion round with suggested defaults, then proceed without further per-step stops.

**Why:** QA said so on 2026-10-08 while starting the knowledge base and skills work ("always ask questions before assuming anything").
**How to apply:** fits with [[no-unnecessary-stops]]: ask once up front about every open point, then do the work without asking for OK on each step.
