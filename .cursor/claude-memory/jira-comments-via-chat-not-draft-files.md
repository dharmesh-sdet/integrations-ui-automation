---
name: jira-comments-via-chat-not-draft-files
description: "Jira comments (verification, retest, etc.) are written as jira/drafts/*.json files and sent via npm run jira, not posted directly from chat"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a7211360-0b40-4f40-9ef5-7fb5b22121d9
  modified: 2026-10-19T09:29:06.380Z
---

For Jira **comments** (Verification, Retest still failing, Additional bug
found, Production deploy verified, etc.): write the draft as a
`jira/drafts/<slug>-comment.json` file (same shape as existing files like
`al-4127-verification-comment.json`: `type: "comment"`, `ticket`, `body`,
`waitingFor`). QA reviews/edits and sends it with one click from the local
review page (`npm run jira`, http://localhost:4317). Do not call
`addOrEditJiraIssueComment` directly from chat for these.

**Why:** QA corrected this twice on 2026-10-19, in opposite directions:
first said comments should go straight to Jira via chat confirm + MCP (not
draft files), then minutes later asked to use `npm run jira` for comments
after all and confirmed this should be the standing rule going forward,
superseding the first correction. Bug creation already worked this way
(see [[jira-verify-then-draft]]); comments now match it.

**How to apply:** treat comments the same as bugs for this purpose: ask
QA first whether the comment is wanted (per [[ask-before-assuming]]), then
write the `*-comment.json` draft, no direct MCP write and no need to show
the full text in chat for a "looks good" first, since QA reviews on the
local page before sending.
