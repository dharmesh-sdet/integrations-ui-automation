---
name: qa-only-runs-script
description: Claude owns everything end to end, including running specs and fixing script failures; QA does not need to be waited on
metadata:
  type: feedback
---

Update 2026-10-09: Claude also runs the specs itself on staging and fixes script failures without waiting (all workflows; skill stage 3c/4, plan rule 7). Originally: QA's only job is to run the script. Everything else (generating CSVs, cleaning up data Claude used in a walkthrough, making fresh rows before a run) is Claude's job. Never hand QA a data step like "run data:generate before your run".

**Why:** QA said so on 2026-10-09 after Claude suggested QA regenerate rows before a run.
**How to apply:** after a walkthrough uses CSV rows, replace them with fresh ones yourself; prefer automating it so the spec run needs no prep. Related: [[no-unnecessary-stops]], [[resume-pointers]]
