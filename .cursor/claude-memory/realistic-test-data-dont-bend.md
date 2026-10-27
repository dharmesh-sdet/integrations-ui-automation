---
name: realistic-test-data-dont-bend
description: Never change test data (e.g. deal names) so the product passes; keep realistic data so the test can show the bug
metadata:
  node_type: memory
  type: feedback
  originSessionId: c4df3bd5-6c52-4e2b-b2dd-b8d1f7758e4a
  modified: 2026-10-14T05:20:56.187Z
---

Do not propose or run probes that bend test data to the product's behavior (for example naming a pre-created HubSpot deal with the prospect's email so Update a Deal finds it). Keep realistic CSV data (deal names like "Figma Deal 1") and let the product failure show.

**Why:** 2026-10-14, Email Opened. The Update a Deal search matched deals by name = prospect email (AL-4128). I floated a probe with an email-named deal. QA objected: "it is better use something that we can really test." Changing the data would hide the bug.

**How to apply:** If a cause needs proving, read the log execution detail (read only) instead of altering test data. Offer data changes only when QA asks. See [[no-unnecessary-stops]] and [[log-product-issues-dont-wait]].
