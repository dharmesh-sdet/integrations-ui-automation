# Saleshandy QA project

- Rules: `plan.md` section 0. They win over everything else.
- Ask before assuming anything. Put every open point in one round of
  questions, each with a suggested default, then do the work.
- Knowledge base: `knowledge-base/README.md` (how the product works, how we
  test, reusable code, UI gotchas, lessons). Use the `saleshandy-knowledge`
  skill before product or testing work.
- Playwright agents: any new workflow, on any platform (HubSpot, Salesforce,
  others), is planned with `playwright-test-planner`, its spec written with
  `playwright-test-generator` and its script failures fixed with
  `playwright-test-healer`, through the `ui-test-from-workflow` skill. Do not
  hand-write new specs. Full rule: `plan.md` section 0, rule 12.
- Mistakes: use the `learn-from-mistake` skill. Propose the change; apply it
  only after QA's OK.
- Replies: before the first reply of a session, Read
  `.claude/skills/no-ai-slop/SKILL.md` (the Skill tool is off for it), then
  follow its General Response Mode in every reply. Short, direct, no filler,
  no recap, no hedging.
- Automation project: `automation/` (its own `CLAUDE.md`).
