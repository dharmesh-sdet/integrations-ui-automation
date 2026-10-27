---
name: drafts-human-readable
description: Show drafts (smoke checklists, Jira text, scenarios) as rendered plain text, not inside a code block
metadata:
  type: feedback
---

Show every draft to QA as normal rendered markdown, not wrapped in a code block.

**Why:** QA asked for "human readable format" after the Email Opened production smoke checklist was shown in a code fence (2026-10-14), then said to use that format from then on.

**How to apply:** Put the draft directly in the reply (headings, bullets), after a `---` line, and end with a one-line "reply looks good to save". Raw markdown in a code block only when QA asks for the file text. Related: [[ask-before-assuming]].
