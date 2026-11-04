# Zoho: exploration of the unconfirmed rows, resume

Saved 2026-10-30, 13:36. QA asked to explore every row marked "proposed, unconfirmed". QA also asked to record the findings in each workflow. Nothing from this work is committed.

## Rules QA gave

- Use one sequence for all exploration: https://pyxis.lifeisgoodforlearner.com/sequence/197387/settings (id 197387, account `notemailsentzoho`).
- That sequence is the "Zoho Reply Received QA" sequence. Its step subjects start with "Zoho Reply Received QA". The bodies have no links.
- Do not edit its steps, subjects, bodies, senders or schedule.
- Use the sequence's own 10 senders. Run two workflows at a time.
- Real sends are allowed: 1 real bounce and 3 real unsubscribe links. The cap is 40 a day.
- Record the findings in the progress file, the context file, the cases file and the spec of each workflow.
- Never read the Logs tab for Zoho. Read the Zoho record only, 15 s after the event.

## The 16 rows

| Workflow | Rows | Batch |
|---|---|---|
| Email Opened | Trigger and setup 4, Combined actions 2 | 1, agent 1 |
| Email Bounced | Trigger and setup 3 and 4 (real bounce), Contact 1 | 1, agent 1 |
| Prospect Unsubscribed | Trigger and setup 4, 5, 6 (real links), Lead 1 | 1, agent 2 |
| Conversation Category Updated | Trigger and category gate 3 | 1, agent 2 |
| Conversation Category Updated | Trigger and category gate 5 (needs a reply) | 2, not started |
| Link Clicked | Trigger and setup 4 (needs a second link, the sequence has none) | 2, not started, QA decides |
| Reply Received | Contact 2, 4, 6, 7 | 2, not started |

Batch 2 is not paired with batch 1 on purpose. A click also fires Opened, and a reply also fires Conversation Category.

## State at 13:36

- Two background agents were running. They started about 12:45.
- Agent 1 (Email Opened, Email Bounced) was on case `P3`. Agent 2 (Prospect Unsubscribed, Conversation Category) was on case `PU-LINK`.
- No finding was written yet. The four progress files have no "Findings (exploration" section.
- The cases files still carry the markers: Email Opened 3, Email Bounced 4, Prospect Unsubscribed 5, Conversation Category 3. These counts include a few lines outside the explored rows.
- The agents run only while the Claude Code session stays open. If the session closes, they stop and write nothing.

## What the agents can leave changed

If the agents stopped before they finished, check these on `notemailsentzoho` and sequence 197387.

- Triggers & Activity: these four triggers can be ON with an action: "Email is Opened in Saleshandy", "Email is Bounced in Saleshandy", "Prospect is Unsubscribed in Saleshandy" and "Conversation Category is Updated in Saleshandy". Email Sent must stay OFF. Reply Received is not touched.
- Sequence 197387 > Settings > Safety Settings > "Track email opens" can be ON.
- Sequence 197387 > Settings > Unsubscribe can be on "Unsubscribe as Link". The spec has a `RESTORE-TEXT` case that saves "Unsubscribe as Text" again, so the original was text. Make sure that this is true before you run it.
- New prospects with `@mailinator.com` addresses stay in sequence 197387.

## Run it by hand

The two throwaway specs are `tests/setup/zoho-explore-eo-eb.spec.ts` and `tests/setup/zoho-explore-pu-cc.spec.ts`. They are not regression specs. Do not commit them. Each case sends real email, so read the case first. Run from `automation/`, one at a time.

```
ZOHO_EXPLORE_EOEB=1 KEEP_TEST_DATA=1 xvfb-run -a npx playwright test tests/setup/zoho-explore-eo-eb.spec.ts -g "E1" --project=chromium --workers=1
ZOHO_PUCC_EXPLORE=1 KEEP_TEST_DATA=1 xvfb-run -a npx playwright test tests/setup/zoho-explore-pu-cc.spec.ts -g "PU-LINK" --project=chromium --workers=1
```

Case names in `zoho-explore-eo-eb.spec.ts`:

- `P1`: Track email opens ON, records the original state.
- `E1`: Email Opened Trigger and setup 4.
- `E2`: Email Opened Combined 2.
- `P2`: switch the triggers for Bounced.
- `B1`: Bounced Trigger and setup 3.
- `B2`: Bounced Contact 1.
- `B3`: real bounce, 1 send.
- `P3`: tag probe, needs `EXPLORE_ID`, a Zoho contact id.
- `R`: restore.

Case names in `zoho-explore-pu-cc.spec.ts`:

- `P0`, `P1`, `P2`: probes.
- `SET-LINK`: save "Unsubscribe as Link".
- `RESTORE-TEXT`: save "Unsubscribe as Text".
- `CFG-PU`: turn Prospect Unsubscribed ON.
- `PU-LINK`: rows 4, 5 and 6.
- `PU-LEAD`: Lead 1.
- `CFG-CC`: turn Conversation Category ON.
- `CC-GATE3`: gate 3.
- `RESTORE-TRIGGERS`: turn both triggers OFF.

Zoho CRM is read in a headed browser on its own profile copy. Eo-eb uses `auth/zoho-explore-a-profile`. Pu-cc uses `auth/zoho-explore-b-profile`. When a case ends, close every browser.

## After the runs

1. Write what you saw into the four `<workflow>-progress.md` files, under "Findings (exploration 2026-10-30)".
2. Update the "Unclear" list of each `<workflow>.md`.
3. In each cases file, replace "(proposed, unconfirmed)" with what was seen and "(seen 2026-10-30)". Change nothing else in the file.
4. Fix the matching lines and `TODO(needs-input)` in each spec. Run `npm run typecheck`.
5. Update `PROGRESS.md`. Then commit the cases, specs and progress files. Leave the throwaway explore specs out.
6. Start batch 2.
