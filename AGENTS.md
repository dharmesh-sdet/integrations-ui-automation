# Saleshandy QA project: instructions for Cursor (and any non-Claude agent)

This project was run with Claude Code. Its instructions live in files Cursor does not load by itself. Read them in this order before doing anything:

1. `HANDOFF.md`: current state of every workflow, next commands, blockers. Start here.
2. `CLAUDE.md` and `automation/CLAUDE.md`: project rules. `plan.md` section 0 wins over everything else.
3. `.cursor/claude-memory/MEMORY.md`: the QA's standing preferences, one file per rule (copied from Claude's memory on 2026-10-23; the files in that folder are the rules, follow them).
4. `knowledge-base/README.md`: how the product works, how we test, reusable code, UI gotchas, lessons.
5. `automation/context/project.md`: answers QA already gave.
6. `automation/jira/CLAUDE.md`: Jira rules before any bug or comment.

## Skills (Claude-only feature, do the same by hand)

The folders under `.claude/skills/` are instructions, not tools. Open the `SKILL.md` and follow it:

- `saleshandy-knowledge`: before any product or testing work.
- `ui-test-from-workflow`: new workflow, scenarios, spec, failure summary.
- `learn-from-mistake`: when QA corrects you. Propose the change, apply it only after QA's OK.
- `kb-update`: add or refresh knowledge base pages.
- `no-ai-slop`: General Response Mode applies to every reply. Short, direct, no filler, no recap, no hedging. Run QA Test Case Mode on every test case file after drafting.

The Playwright agents (`.claude/agents/playwright-test-*.md`) are Claude subagents. Cursor has no equivalent. Rule 12 of `plan.md` and the memory note `use-playwright-agents-for-workflows.md` say new workflows use them; the memory note `salesforce-hand-written-specs.md` overrides that for Salesforce: hand-write Salesforce specs like the HubSpot ones. For anything not Salesforce, ask QA how to proceed.

## Ground rules that bite most often

- Ask before assuming. Put every open point in one round of questions, each with a suggested default, then work.
- Never rename or bend test data to make the product pass. Prove causes from logs.
- Product failures are logged in the workflow progress file; keep running, QA reviews later. Do not file Jira bugs without asking QA bug-or-not first.
- Do not open `report.html`. QA reviews it after the task.
- Send cap: real email sends are capped per day (`SEND_CAP`, default 40).
- Rerun failed rows only, with `KEEP_TEST_DATA=1` or `TEST_DATA_ONLY=<slug>`. Read `knowledge-base/testing/how-to-test.md` "Test data" before any `playwright test`.
- Kill a stuck run via the node `bin/playwright test` pid, then check `ps` for `workerProcessEntry`. Killing the npm/sh pid leaves workers sending mail.
- Keep the progress files current after every step, so the next agent can resume from files.
- Commit only when QA asks.
