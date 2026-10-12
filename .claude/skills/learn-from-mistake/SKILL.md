---
name: learn-from-mistake
description: Record a mistake Claude made and propose the change that stops it happening again. Use when QA corrects Claude, says "you did this again", rejects an assumption, or when a test fails because of Claude's script, locator or assumption (not a product bug).
---

# Learn from a mistake

Paths are relative to the project root. The lessons log is
`knowledge-base/lessons.md`.

## Steps

1. **Check for a repeat.** Search `knowledge-base/lessons.md` for the same
   kind of mistake. If an Applied lesson already covers it, the existing rule
   did not work: the proposal must change *where* or *how* the rule is
   written (e.g. move it into the skill step that is actually followed), not
   add a second copy.
2. **State it plainly, no excuses:** what went wrong, and why (the real cause:
   a missing fact, a wrong default, a rule not read, a locator not seen on the
   page). Only facts from the session; if the cause is unclear, say so.
3. **Pick the one place the fix belongs.** It must sit where it will be read
   at the moment the mistake could happen:

   | Kind of mistake | Place |
   |---|---|
   | Wrong product fact or behavior | the KB page for it, or `automation/context/<integration>/00-overview.md` |
   | Testing approach, waits, data | `knowledge-base/testing/how-to-test.md` |
   | Locator or page trap | the page object, plus `knowledge-base/testing/ui-gotchas.md` |
   | A step in a skill done wrong or skipped | that skill's `SKILL.md`, in the step itself |
   | Working rule for Claude | `plan.md` section 0 (QA must approve rule changes) |
   | How QA likes to work, across sessions | Claude memory (feedback type) |

4. **Propose.** Show QA in chat: the lesson entry (shape at the top of
   `lessons.md`) and the exact text to add or change, with the file path.
   Use AskUserQuestion if there are choices.
5. **Wait for QA's OK.** Do not edit anything except adding the entry with
   `Status: Proposed`.
6. **Apply after OK:** make the change, set `Status: Applied` with the place it
   now lives. If QA says no, set `Status: Rejected` and note why.

Keep entries short (four lines). Newest at the top, under the entry shape.
