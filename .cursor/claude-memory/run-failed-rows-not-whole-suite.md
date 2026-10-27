---
name: run-failed-rows-not-whole-suite
description: "After a spec is written, run it once to learn every error; then fix and rerun only the failed rows, never restart the whole chain; QA runs the full script at the end"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fef147fc-0eb1-4481-b5d4-510c94a2bddd
  modified: 2026-10-15T10:16:21.843Z
---

When a new spec is written, run it so each error is seen first-hand. Once errors are fixed, rerun only the specific failed (and not-yet-run) rows, continuing from where it stopped. Do not start the whole suite over, and do not start a full run on my own again once one has been run.

**Why:** QA (2026-10-15) stopped a repeated full chain run ("Do not do that", "Do not start over"). A full chain is about 45 minutes and each run refreshes the CSV people, which loses the state earlier rows built.

**How to apply:** Use `KEEP_TEST_DATA=1` and `-g` for the failed/unrun rows so the people (and their Saleshandy/HubSpot state) stay. The full-suite run is QA's own step once everything is fixed and no product issue is open, then the workflow is marked as staging-verified. Related: [[qa-only-runs-script]], [[no-unnecessary-stops]].
