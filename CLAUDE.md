# Saleshandy QA project

- Rules: `plan.md` section 0. They win over everything else.
- Ask before assuming anything. Put every open point in one round of
  questions, each with a suggested default, then do the work.
- Knowledge base: `knowledge-base/README.md` (how the product works, how we
  test, reusable code, UI gotchas, lessons). Use the `saleshandy-knowledge`
  skill before product or testing work.
- Specs are hand-written, like the HubSpot ones, on every platform (QA,
  2026-11-12). Do not use `playwright-test-planner`, `playwright-test-generator`
  or `playwright-test-healer` unless QA asks for them. Full rule: `plan.md`
  section 0, rule 12.
- Mistakes: use the `learn-from-mistake` skill. Propose the change; apply it
  only after QA's OK.
- Replies: before the first reply of a session, Read
  `.claude/skills/no-ai-slop/SKILL.md` (the Skill tool is off for it), then
  follow its General Response Mode in every reply. Short, direct, no filler,
  no recap, no hedging.
- Automation project: `automation/` (its own `CLAUDE.md`).
