# QA knowledge base

How Saleshandy works, how we test it, and what we learned the hard way.
Read the page you need, not all of them.

## Pages

| Need | Page |
|---|---|
| What a Saleshandy area does and what to test in it | [product/saleshandy.md](product/saleshandy.md) |
| HubSpot integration: screens, names, URLs seen on staging | [product/hubspot-integration.md](product/hubspot-integration.md) |
| HubSpot integration: workflows, activities, intended behavior, field mapping | [../automation/context/hubspot/00-overview.md](../automation/context/hubspot/00-overview.md) (single source, not copied here) |
| How we test: environments, data, timing, verification, false failures | [testing/how-to-test.md](testing/how-to-test.md) |
| Reusable test code and the checklist for a new integration (Salesforce next) | [testing/reusable-building-blocks.md](testing/reusable-building-blocks.md) |
| UI traps that broke tests or walkthroughs | [testing/ui-gotchas.md](testing/ui-gotchas.md) |
| Mistakes made and the rule each one produced | [lessons.md](lessons.md) |

Rules for working in this project are in `../plan.md` section 0 (they win
over anything here). Jira rules are in `../automation/jira/CLAUDE.md`.

## Where facts come from

Every fact carries its source, so a reader knows how far to trust it:

| Tag | Meaning |
|---|---|
| `[project]` | From a project file (context, test case, page object, QA answer). Path given when useful. |
| `[staging]` | Seen on staging in an MCP walkthrough or a test run, with the date. |
| `[public docs]` | From docs.saleshandy.com (Saleshandy help center). Not yet checked on staging; the product may differ. |
| `[QA]` | Told by QA in chat, with the date. |
| `[dev kit]` | From the developer's kit in `../integration-skills/` (next to this folder). Found through API calls and workflow JSON, not the UI: rely on what it says happens, check it on staging before a UI test depends on it, and never copy its wait values. |

A fact with no source is not allowed. When something is not known, write
"Not documented yet" instead of filling the gap.

## Keeping it current

- New knowledge: use the `kb-update` skill.
- A mistake (QA corrects Claude, or a test fails because of Claude's script or
  assumption): use the `learn-from-mistake` skill. It logs the mistake in
  `lessons.md`, proposes the exact change, and applies it only after QA's OK.
- One fact lives in one place. Link to it instead of copying it.
- Style: short bullets, no em-dashes, " > " for UI paths.
