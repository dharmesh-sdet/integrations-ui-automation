# Handoff

This file points to the state. It holds no status, because status goes stale.
State of a workflow: read its progress file. Find the newest with
`ls -lt automation/context/*/*progress*.md`.
Platform overview: `automation/context/<platform>/00-overview.md` or `RESUME.md`.
When QA's Claude usage runs out, Claude rewrites this file with the current state.
