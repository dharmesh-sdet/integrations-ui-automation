---
name: no-pipedrive-cleanup
description: "QA 2026-10-26: Pipedrive specs do not delete records after a row; no afterEach cleanup, no by-hand cleanup"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f65d3290-1ee8-47c1-b746-62b5b8fede39
  modified: 2026-10-26T10:00:37.847Z
---

Pipedrive specs must not clean up after a row: no `afterEach` that deletes persons, deals, leads or organizations, and no by-hand deletion in Pipedrive. What a row creates stays. Setup that creates records (Legacy Person, Legacy deal) stays.

**Why:** QA said "I do not want to do the clean up" on 2026-10-26 after seeing the account hold only a few records (cleanup had also removed records other sessions made, and timed out in several rows).

**How to apply:** removed from `tests/pipedrive/email-sent.spec.ts`; all five peer sessions were told (Unsubscribed and Outcome Updated specs must drop their `wipe()` hook). Keep assertions per-row (own prospect and company). Lists will grow, so a reader that only looks at the first page (`idsByName`, `idsByEmail`) can miss a record later. Related: [[pipedrive-one-account-parallel]], [[pipedrive-resume]].
