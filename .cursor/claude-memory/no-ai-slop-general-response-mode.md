---
name: no-ai-slop-general-response-mode
description: "no-ai-slop skill now has 3 operating modes; General Response Mode is the default for Claude's ordinary replies, not just drafts/test cases"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 004846e7-e311-4171-8eb8-7c12f1c181ca
  modified: 2026-10-19T11:37:45.616Z
---

The `no-ai-slop` skill (`.claude/skills/no-ai-slop/SKILL.md`) was extended on
2026-10-18 at QA's request to cover three modes, not just drafts and QA test
cases:

- **General Response Mode** (new, default) — applies the no-slop writing
  principles (lead with the answer, cut banned words/patterns, no forced
  headings/bullets, preserve technical precision and code/commands
  verbatim) to Claude's own ordinary chat responses in this project, not
  just to pasted drafts.
- **Draft Editing Mode** — the pre-existing "Two jobs" (edit/detect) for a
  pasted draft the user wants fixed or audited.
- **QA Test Case Mode** — unchanged guardrails: five-column template, row
  count/order, ticket IDs, suffixes, QA approval gate before saving.

**Why:** QA wants responses in this project to read direct and concise by
default, not just test-case tables and documents, while never touching code
blocks, commands, file paths, or exact technical content for style, and
never losing debugging/plan detail the user needs to act on.

**How to apply:** In this project, apply General Response Mode's writing
discipline to normal replies (explanations, debugging, plans, status
updates) unless QA Test Case Mode or Draft Editing Mode is clearly active.
See [[use-no-ai-slop-on-test-cases]] for the QA-specific trigger, which is
unchanged.

**Strict rule (QA, 2026-10-19):** QA opens new sessions and was not seeing
the skill's style, because only the one-line MEMORY.md index loads and
Claude did not always open this file. Fix: a "Replies" bullet in the project
`CLAUDE.md` (loaded in full every session), and a message to all other live
sessions to follow it. QA said it is STRICT: every reply, every session. If
replies drift, propose a `UserPromptSubmit` hook as the next step.
