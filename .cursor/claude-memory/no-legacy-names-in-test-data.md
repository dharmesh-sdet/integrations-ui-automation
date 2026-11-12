---
name: no-legacy-names-in-test-data
description: "Do not use \"Legacy Person\" or \"Legacy deal 1/2\" in manual scenarios or test data; use the prospect's real name and realistic deal titles"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f7572730-4d0e-4f95-affa-a16ed2f78b1c
  modified: 2026-10-28T07:07:00.774Z
---

QA 2026-10-28: stop using "Legacy Person" and "Legacy deal 1/2" when describing or building test data. Name the Pipedrive person like the prospect (First Last) and give deals realistic titles (company plus purpose, with a realistic value).

**Why:** QA found the labels odd and unrealistic. Fits [[realistic-test-data-dont-bend]].

**How to apply:** In manual scenarios given in chat, use realistic names. The automated spec `tests/pipedrive/prospect-unsubscribed.spec.ts` still creates the legacy names (`personFirst`, `legacyDeals`). QA was asked whether to change it; default proposed was the two deal rows only, because Create a Person 2 and Update a Person 1 use the old name as the old value that proves the update. Check QA's answer before editing.
