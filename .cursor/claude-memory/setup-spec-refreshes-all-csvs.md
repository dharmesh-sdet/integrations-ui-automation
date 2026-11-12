---
name: setup-spec-refreshes-all-csvs
description: 2026-11-02 incident: setup spec runs without KEEP_TEST_DATA=1 refreshed every CSV and used up the name pool
metadata:
  type: feedback
---

Any `playwright test` run, including a setup spec that creates a sequence, needs `KEEP_TEST_DATA=1`. Without it a spec with no CSV of its own replaces the rows of every workflow's CSV and empties the `*.used.txt` files.

**Why:** 2026-11-02 about 7 setup runs did this (HubSpot, Pipedrive, Zoho CSVs rewritten, name pool used up, a live Reply Received run lost its CSV mid-run, its later failures can be false). 24 countries were added to `src/data/countries.ts` (QA OK). Lesson entry in knowledge-base/lessons.md is Proposed; QA has not yet approved the `global-setup.ts` change or the setup-header change.
**How to apply:** put `KEEP_TEST_DATA=1` in every run line. Ask QA about the Proposed lesson changes. See [[global-setup-csv-refresh]].
