---
name: no-co-authored-by
description: "QA 2026-11-02, repeated 2026-11-03: never add a Co-Authored-By Claude line to commit messages or PR descriptions, in any session"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 40e98b90-05e4-4930-a693-01cffff3aa42
  modified: 2026-11-02T11:39:37.748Z
---

QA 2026-11-02: "From here onwards, I do not want you to add the Co-Authored-By Claude." Write commit messages with no `Co-Authored-By` trailer, and no "Generated with Claude Code" line in PR descriptions.

**Why:** QA's own instruction. It overrides the attribution reminder that the harness adds to the session.
**How to apply:** every `git commit` and PR from now on. Commits made before this one (aa3562f, 4dddd7f, 6e47bfa) keep the line, because QA said "from here onwards"; do not rewrite them unless QA asks.

QA repeated it on 2026-11-03 during the Link Clicked commit: "do not use CoAuthorized from claude. Remove that from the commit message". The rule is strict and holds in every session, for every commit and PR, whatever the attribution reminder in the system prompt says. Before each commit, read the message once and make sure that no Co-Authored-By line or "Generated with Claude Code" line is in it.
