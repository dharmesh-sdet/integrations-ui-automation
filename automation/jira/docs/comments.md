# Writing Jira comments

Every comment goes through the confirmation gate in [../CLAUDE.md](../CLAUDE.md):
show the full text, name the ticket it goes on, get an explicit "looks good",
then post it with `addOrEditJiraIssueComment`. Editing an existing comment
(for example, adding a row to a retest table) needs the gate too.

## 1. Pick the comment type

| Situation | Type | Template |
|---|---|---|
| Retested several scenarios (an activity, or a fix with variations) | Retest table | [01-retest-table.md](../templates/comments/01-retest-table.md) |
| A fix is confirmed, one scenario or a short sign-off | Verification | [02-verification.md](../templates/comments/02-verification.md) |
| A bug is confirmed fixed on Production after deploy | Production deploy verified | [03-production-deploy-verified.md](../templates/comments/03-production-deploy-verified.md) |
| Production smoke test of a whole workflow is done | Production smoke summary | [04-production-smoke-summary.md](../templates/comments/04-production-smoke-summary.md) |
| Retested and it still fails, or fails differently | Retest still failing | [05-retest-still-failing.md](../templates/comments/05-retest-still-failing.md) |
| The same bug also shows up in other activities or workflows | Additional observation | [06-additional-observation.md](../templates/comments/06-additional-observation.md) |
| A new, smaller bug was found while retesting, and is kept on this ticket | Additional bug found | [07-additional-bug-found.md](../templates/comments/07-additional-bug-found.md) |
| Behavior reported as a bug turns out to be intended | Intended-behavior clarification | [08-intended-behavior.md](../templates/comments/08-intended-behavior.md) |
| A related ticket was fixed, so this one can be closed | Closing the loop | [09-closing-the-loop.md](../templates/comments/09-closing-the-loop.md) |
| The fix is deferred until after the release | Post-release deferral | [10-post-release.md](../templates/comments/10-post-release.md) |
| A ticket cannot be retested until other bugs are fixed | Blocked | [11-blocked.md](../templates/comments/11-blocked.md) |
| Test case record on a workflow's tracking sub-task (for QMetry import) | Test case table | [12-test-case-subtask.md](../templates/comments/12-test-case-subtask.md) |

If more than one type fits, or none does, ask the user.

## 2. Pick the ticket

- A retest or verification of one bug's fix goes on **that bug**.
- A retest covering every scenario of one activity goes on that activity's
  umbrella bug, or on the workflow's tracking sub-task. Ask which one, since
  both have been used.
- A Production smoke summary goes on the **workflow's tracking ticket**
  (for example AL-4012 for Prospect Outcome is updated in Saleshandy).
- An additional observation goes on the **original bug** for that root cause.
- Check the ticket key against the source before posting. A comment posted
  to the wrong ticket cannot be deleted through the MCP; the user has to
  delete it by hand.

## 3. Staging vs Production

**Staging** (testing a fix, or exploring a workflow):
- Fix confirmed, one scenario: Verification ("Retested on Staging after the
  fix.").
- Several scenarios: Retest table, saying Staging in "What I did".
- New problem found: file a separate bug (see
  [bug-creation.md](bug-creation.md)), or, only if the user says so, an
  Additional bug found comment on the current ticket.
- Do not change the ticket status unless the user asks.

**Production** (after deploy):
1. On each fixed bug: the Production deploy verified one-liner.
2. Then, only if the user asks, move the bug to Done. See "Release
   transitions" in [jira-reference.md](jira-reference.md). Each transition
   is a Jira write and goes through the gate. Batch the drafts into one
   confirmation, for example "these 14 tickets: comment X, then Approved for
   Release (Resolution Fixed), then Released".
3. On the workflow ticket: the Production smoke summary.
4. If something fails on Production: Retest still failing on the bug (or a
   new bug if it is a different problem; ask).

## 4. Style rules (all types)

- Start with a bold label: `**What I did:**`, `**Verification:**`,
  `**Additional observation:**`, `**Additional bug found:**`,
  `**Retested on Production (<date>):**`. The one-line Production deploy
  comment and short notes have no label.
- Always state the environment (Staging or Production).
- Name the trigger before the activity: "Prospect Outcome is updated in
  Saleshandy trigger, Update a deal in HubSpot activity".
- Be short and precise: the thing tested and the result. Don't repeat what
  the ticket already says. Use the table shape only for several scenarios,
  or when the user asks for detail.
- Describe scenarios generically ("Prospect in Sequence 1, Latest Status
  Paused"), not by real prospect names from the raw notes.
- Status cell values: `Pass`, `Pass, working as intended`, `Fail, AL-XXXX`,
  `Needs clarification`. Use "Pass" for edge cases only when the user
  decides that.
- Leave evidence JSON out of comments; the bug ticket carries it. Add it only
  if the user asks.
- Use "@Name" mentions only when the user asks to tag someone (for example
  when reopening a ticket).
- Never mark something Pass, or "Verified correct", without the user having
  confirmed that exact result.
- No em-dashes. Use " > " in UI paths.
