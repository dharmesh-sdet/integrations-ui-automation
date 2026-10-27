---
name: usage-limit-handoff
description: When QA says weekly usage is at 95%, write HANDOFF.md so work can continue in Cursor
metadata:
  type: feedback
---

QA runs several sessions and wants progress saved before the weekly limit runs out, so the work can continue in Cursor AI (2026-10-22).

**Why:** Claude cannot see weekly usage; QA does. Progress lives in files, so a handoff must be complete and current.
**How to apply:** keep the workflow progress files updated after every step. When QA says the limit is near ("handoff", 95%), write one `HANDOFF.md` at the project root: per workflow the state, last report path, next command, blockers. Also update the progress files. See [[resume-pointers]].
