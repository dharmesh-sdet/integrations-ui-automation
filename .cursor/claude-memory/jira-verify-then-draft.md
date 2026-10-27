---
name: jira-verify-then-draft
description: "Jira bug creation (not comments) - ask QA \"bug or not\" first, then draft from the kit template, QA sends with one click"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a7211360-0b40-4f40-9ef5-7fb5b22121d9
  modified: 2026-10-19T09:27:57.213Z
---

For a possible **bug**: first ask QA to verify whether it is a bug. Only
after a yes, draft it from the template in `automation/jira/templates/`;
if no template fits, ask QA for one. Write the draft to
`automation/jira/drafts/<slug>.json`; QA sends it with one click from the
review page (`npm run jira`, http://localhost:4317).

This does NOT apply to **comments** (verification, retest, additional bug
found, etc.) - those go through chat draft + confirm + a direct
`addOrEditJiraIssueComment` call, never a `jira/drafts/*.json` file. See
[[jira-comments-via-chat-not-draft-files]] (QA corrected this 2026-10-19
after I mistakenly wrote comment JSON drafts, reasoning from existing
comment-type files in that folder that actually came from the automated
report pipeline, not from a chat request).

**Why:** QA (2026-10-09) wants bug creation to be one button click, and
does not want drafts for things that turn out not to be bugs.

**How to apply:** never draft or file a bug straight from a walkthrough
observation or a failed test; ask first. See
`automation/jira/docs/bug-creation.md` ("One-click route"). Related:
[[ask-before-assuming]].
