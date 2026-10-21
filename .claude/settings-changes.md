# Settings changes and how to undo them

Changes made to `.claude/settings.json` on purpose, so each can be reverted if it
causes trouble. Default behavior returns when the entry is removed.

## 2026-10-20: update-config skill hidden from Claude (QA's request, token cost)

Why: the built-in `update-config` skill loads a very large settings schema every
time Claude invokes it, and it stays in the conversation. Settings edits are
small and can be made directly in `settings.json`.

Added:

```json
"skillOverrides": { "update-config": "user-invocable-only" }
```

Effect: Claude no longer loads the skill on its own. `/update-config` still works
when QA types it. Claude edits `settings.json` directly with the Edit tool and
checks the file parses afterwards.

Undo (back to the default): delete the whole `skillOverrides` block, or set the
value to `"on"`. Open `/hooks` or restart the session to reload.

## 2026-10-20: reply-style hooks (QA's request)

Added `UserPromptSubmit` and `SessionStart` hooks that inject the no-ai-slop
General Response Mode reminder (see `CLAUDE.md`, "Replies"). The
`UserPromptSubmit` entry sits next to the existing superpowers hook.

Undo: delete the second command in `hooks.UserPromptSubmit[0].hooks` and the
whole `hooks.SessionStart` block.
