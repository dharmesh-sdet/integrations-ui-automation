---
name: saleshandy-knowledge
description: How Saleshandy and its integrations work and how this team tests them. Use before answering a product or testing question, writing scenarios or test code, exploring a screen, or starting a new integration (e.g. Salesforce), so existing knowledge and reusable code are used instead of guessed or rebuilt.
---

# Saleshandy knowledge

The knowledge base is `knowledge-base/` at the project root (paths below are
relative to it). Start at `README.md` for the page index.

## Steps

1. Pick the pages the task needs from `README.md`. Usually:
   - product question: `product/saleshandy.md`, and for the HubSpot
     integration `product/hubspot-integration.md` plus
     `../automation/context/hubspot/00-overview.md`;
   - writing scenarios or a test: `testing/how-to-test.md`;
   - writing code: `testing/reusable-building-blocks.md` and
     `testing/ui-gotchas.md` before creating any helper or locator;
   - new integration: the checklist at the end of
     `testing/reusable-building-blocks.md`.
2. Skim `lessons.md` headings. If one matches the task, follow its change.
3. Answer or act from what the pages say, and name the source tag:
   - `[staging]` and `[project]` facts can be relied on.
   - `[public docs]` facts may differ on staging. Say so, and check on staging
     before a test depends on them.
4. If the KB does not cover it, say "not in the knowledge base" and ask QA
   (one round, AskUserQuestion, with what you know as the default). Never fill
   the gap from general knowledge of Saleshandy, HubSpot or Salesforce.
5. If you learned something new and confirmed (QA answer, staging walkthrough,
   test run), offer to add it with the `kb-update` skill.

`../plan.md` section 0 rules always apply and win over the KB.
