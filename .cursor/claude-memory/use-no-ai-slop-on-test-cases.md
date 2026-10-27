---
name: use-no-ai-slop-on-test-cases
description: Run no-ai-slop QA Test Case Mode on all test case files after drafting
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8b4a929-0a3b-4283-9232-c9166c4d644c
  modified: 2026-10-17T11:21:21.730Z
---

Run the no-ai-slop skill (QA Test Case Mode) on every test case file after the planner drafts it.
**Why:** QA approved the writing-quality pass on Reply Received Salesforce test cases (2026-10-17) and said "from here onwards lets use this one."
**How to apply:** After the planner outputs test cases and before QA review, run no-ai-slop in QA Test Case Mode. Show the before/after change summary. Do not save until QA says "looks good." Apply to all existing and new test case files in test-cases/.
