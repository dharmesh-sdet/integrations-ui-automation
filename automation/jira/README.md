# Jira QA kit

A portable set of rules and templates for filing Jira bugs and writing Jira
comments (Staging and Production) with Claude Code. It was built from how the
Bug Creation workspace actually worked (Mode 2, bugs created directly in Jira
through the Atlassian MCP), and every template has a real posted example.

## Setup in this project

1. The kit lives in `jira/` at the `automation/` root.
2. `automation/CLAUDE.md` loads it with the line `@jira/CLAUDE.md`. Start
   Claude Code from `automation/` (or a folder inside it) so it loads.
3. The Atlassian MCP server is in `automation/.mcp.json` (the content is in
   [docs/jira-reference.md](docs/jira-reference.md)). Approve it and sign in
   the first time Claude Code asks; `/mcp` shows its status.
4. When values change (people, epic, tracking tickets, transition ids),
   update [docs/jira-reference.md](docs/jira-reference.md). Add a new
   integration's epic and tracking tickets there before filing its first bug.

The local Jira server planned in `../plan.md` section 10 will also live in
this folder. Keep its code in a subfolder (for example `jira/server/`) so
the docs and templates stay separate from code.

To reuse the kit in another project: copy this folder to that project's
root, add `@<folder>/CLAUDE.md` to its root `CLAUDE.md`, add the same
`.mcp.json`, and drop the "How this fits the automation project" section
from [CLAUDE.md](CLAUDE.md).

## Contents

```
jira/
  CLAUDE.md                     core rules + which file to open for each task
  README.md                     this file
  docs/
    bug-creation.md             steps to file a bug, Summary pattern, content rules
    comments.md                 picking the comment type and ticket, Staging vs Production, style
    jira-reference.md           site, accountIds, field defaults, payloads, transitions, JQL
    automation-mapping.md       report drafts and local Jira server: failed case to bug, run to comment, REST notes
  templates/
    bug-description.md          description shape, gate field table, 2 real examples
    comments/
      01-retest-table.md        several scenarios, What I did / Steps / table
      02-verification.md        fix confirmed, plus the sign-off and "not a bug" variants
      03-production-deploy-verified.md   one-liner on each fixed bug after deploy
      04-production-smoke-summary.md     whole workflow on Production, per-activity table
      05-retest-still-failing.md
      06-additional-observation.md       same root cause seen elsewhere
      07-additional-bug-found.md         mini bug kept on the current ticket
      08-intended-behavior.md            reported bug is actually by design
      09-closing-the-loop.md
      10-post-release.md
      11-blocked.md
      12-test-case-subtask.md            QMetry-ready table on the workflow tracking ticket
```

## Example prompts

- "File a bug: <paste notes>. Staging."
- "Retest comment for AL-4062 from these results: <paste>."
- "Production is done for Prospect Outcome. Post the deploy comment on the
  fixed bugs and the smoke summary on AL-4012."
- "File a bug for the failed case in reports/failures.md (Trigger only > 1).
  Staging."
- "Retest comment on AL-4007 from today's Contact Updated run."
