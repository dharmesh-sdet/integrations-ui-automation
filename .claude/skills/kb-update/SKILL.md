---
name: kb-update
description: Add or refresh knowledge base pages from a source (public Saleshandy help docs, a project file, a QA answer, a staging walkthrough or test run), tagging where each fact came from. Use when QA asks to document something, after a walkthrough or run taught something new, or when a KB page is out of date.
---

# Update the knowledge base

The KB is `knowledge-base/` at the project root. Read its `README.md` first
(page index, source tags, style).

## Steps

1. **Find the home.** Search before writing (`grep -ri "<term>" knowledge-base automation/context`).
   - If the fact already exists, update it in place. One fact, one place.
   - Integration workflows, activities, intended behavior, field mapping go
     to `automation/context/<integration>/00-overview.md`, not the KB.
   - Otherwise use the page from the README index. Create a new page only if
     no page fits, and add it to the index.
2. **Only what the source says.** Every bullet gets a tag: `[project]`,
   `[staging, <date>]`, `[public docs]` (link the article), `[QA, <date>]`.
   Unknown parts are written as "Not documented yet", never guessed.
3. **Conflicts.** If a new fact contradicts an existing one, do not overwrite.
   Show both with their sources and ask QA which is right. Staging beats
   public docs, but ask anyway when a test depends on it.
4. **Public docs.** Read docs.saleshandy.com only (help.saleshandy.com returned a server error on 2026-10-08). Summarise; do not copy
   long text. A public-docs fact becomes `[staging, <date>]` only after it is
   seen on staging.
5. **Style.** Short bullets or tables, no em-dashes, " > " for UI paths.
6. **Propose, then apply.** Show in chat what will be added or changed and in
   which file. Apply only after QA's OK. Batch several updates into one
   proposal.
