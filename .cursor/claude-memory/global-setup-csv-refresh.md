---
name: global-setup-csv-refresh
description: Playwright global setup refreshes every workflow CSV when the spec name matches no CSV; use KEEP_TEST_DATA=1
metadata:
  type: feedback
---

`src/data/global-setup.ts` refreshes the people in every CSV under `test-data/` when the spec being run has no CSV with the same slug (for example `tests/setup/zoho-explore.spec.ts`). On 2026-10-29 this replaced people in other workflows' CSVs, and it can break a peer session mid-run. It also fails with "Could not find a fresh name after 600 tries" when the name pool is used up.

**Why:** my first exploration run did it by accident.
**How to apply:** for throwaway or setup specs, run with `KEEP_TEST_DATA=1`. For a real spec, name it after its CSV. Never run a spec without checking this when other sessions are live.

Second case (2026-10-29): the Zoho Email Sent script sets `TEST_DATA_ONLY=zoho/email-sent`, so each run refreshes only its own CSV with new people. Adding `KEEP_TEST_DATA=1` to a rerun of a real row reuses the prospect already added to the sequence, and the Create & Add Prospect dialog stays open. Rerun real rows without `KEEP_TEST_DATA`.
