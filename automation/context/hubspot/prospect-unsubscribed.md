# Prospect is Unsubscribed in Saleshandy

Readiness for scenario generation: Nearly. Activity list, both ways to
unsubscribe, log row and timing are seen on staging (2026-10-15) with Create a
Contact only. Extra Configuration values, the other 8 activities and the
HubSpot-side results are not yet seen.

Jira sub-task: AL-4015 (under AL-3984)

Account: `unsubscribed` (`dharmesh+unsubscribed@saleshandy.com`, session
saved 2026-10-14) [project: `src/config/accounts.ts`].

Direction: Saleshandy to HubSpot. The trigger is a Saleshandy event, the
activities act on HubSpot records [docs: HubSpot Integration article
8644260].

## What it does

The trigger "Prospect is Unsubscribed in Saleshandy" is listed on the
Saleshandy-to-HubSpot side of the HubSpot integration page [docs]. The page
does not say when it fires or what each activity does for an unsubscribe.
Not documented yet.

Not to be confused with the HubSpot-side activity "Mark Prospect as
Unsubscribed in Saleshandy", which runs when a HubSpot trigger fires
[docs]. That one is not this workflow.

## Activities

The docs list one shared set of activities for the Saleshandy-side
triggers, not one set per trigger [docs]. The staging dropdown for this
trigger was opened on 2026-10-15 and lists the same 9 [staging].

| # | Activity | Extra Configuration [docs] |
|---|---|---|
| 1 | Create a Contact in Hubspot | Lead Status, Lead Lifecycle |
| 2 | Update a Contact in Hubspot | Lead Status, Lead Lifecycle |
| 3 | Create a Deal in Hubspot | Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date |
| 4 | Update a Deal in Hubspot | Same as Create a Deal |
| 5 | Create a Company in Hubspot | Not documented |
| 6 | Update a Company in Hubspot | Not documented |
| 7 | Create a Task in Hubspot | Task Title, Task Type, Task Priority, Due Date |
| 8 | Create a Note in Hubspot | None; must be paired with a Contact or Deal activity |
| 9 | Record(log) an Email Activity in Hubspot | None; must be paired with a Contact or Deal activity |

## How to trigger an unsubscribe

Two ways, as agreed with QA on 2026-10-14 [QA]. Both seen on staging
2026-10-15, account `unsubscribed`, trigger with Create a Contact [staging]:

- **Real unsubscribe link.** The sequence's Settings > Unsubscribe >
  "Include Unsubscribe Option in Emails" is on by default as "Unsubscribe as
  Text" (reply 'Stop'). Choosing "Unsubscribe as Link" and Save puts
  "If you'd prefer not to receive email from me, Unsubscribe here." in the
  email. The link is in the delivered email (Mailinator inbox, LINKS tab),
  not in Preview email (href empty there). It points to
  `unsub.shengage02.com/c/...`. Opening it unsubscribes at once, with no
  confirm step; the page says "You will no longer receive emails from us"
  and offers "Subscribe here" and "Report spam".
- **"Mark as Unsubscribe" in the UI.** Sequence > Prospects tab > tick the
  prospect > toolbar icon "Mark as Unsubscribe" (tooltip text; icon is a
  ban circle). No confirm dialog; toast "Prospect(s) status updated
  successfully". The Emails tab row menu has only Preview email, Mark as
  replied and Mark as bounced, no unsubscribe action.

Result of both, seen the same way [staging]:

- Prospects tab shows the prospect as "Unsubscribed".
- Logs tab: one new row "Prospect is Unsubscribed in Saleshandy ... Success"
  at the first refresh 15 s after the action (3.4 s and 2.8 s run time).
  No extra waiting was needed.
- Real link: the contact beatriz.valente@mailinator.com exists in HubSpot
  (Create Date 2026-10-15 2:15 PM, same minute as the log). Its properties
  were not read. HubSpot result of the UI action: not checked yet.
- The Emails tab row stays "Sent" (not changed by the unsubscribe).

### Second click and resubscribe (seen 2026-10-15) [staging]

- **Same unsubscribe link opened again:** the page is the same and the
  trigger fires again, one new Success log row per open (3:22 PM and 3:23 PM
  rows). So a link opened twice gives two log rows. The HubSpot effect of the
  repeat is not checked.
- **"Subscribe here" on that page:** the link goes to
  `unsub.shengage02.com/d/...` and the page says "You have successfully
  subscribed and added to our list for future communication. If you want to
  unsubscribe from our list, unsubscribe here". The prospect moved from
  "Unsubscribed" back to "Completed" on the Prospects tab (the status it had
  before). No new "Prospect is Unsubscribed" row was seen for the subscribe
  step itself, but a row appeared for the link open just before it, so this
  is not separated cleanly. No subscribe event or trigger exists on the
  trigger list.
- **Sender in the app, "Mark as Resume" on an unsubscribed prospect:** opens
  "Resume Prospects ... start receiving emails that are scheduled or yet to
  be scheduled", Apply changes shows the toast "Prospect(s) status updated
  successfully", but the prospect stays "Unsubscribed" (UI-unsubscribed
  prospect, reloaded). The toast says success while nothing changes. Not
  judged as a bug (knowledge base: Unsubscribed cannot be paused); QA decides.
- An unsubscribe log row at 2:55 PM was not triggered by me; cause not known.

Sender used: `dharmesh+unodost@saleshandy.com` (SMTP), 150 per day, 40 to 55 s
between emails, step 1 sent within about 6 s of activating the sequence.

## Unclear: expected functionality (proposed)

- Expected result per activity for an unsubscribe: proposed to mirror the
  same activity on Email Sent from Saleshandy (`email-sent.md`), as QA
  confirmed for Email Bounced on 2026-10-12. Not confirmed for this trigger.
- Does the prospect's unsubscribed status reach HubSpot (a property)? Not
  documented.
- Does the UI action fire the trigger the same way as the real link?
  Proposed: yes. Not confirmed.

## Open

- Seed `tests/seeds/unsubscribed.seed.spec.ts` now loads in the
  `playwright-test` MCP (`planner_setup_page`, project chromium, 2026-10-15)
  and opens Triggers & Activity. The earlier "did not expect test.use()"
  error did not come back; cause not proven (seed file unchanged since
  2026-10-14 21:13).
- Seen: Create a Contact opens Extra Configuration with Lead Status and
  Lead Lifecycle (both "Select"). Cancel keeps the activity selected and
  Save works (Extra Configuration skipped, QA's rule).
- Not seen yet: Extra Configuration values of the other activities, results
  in HubSpot for each activity (and of a repeated link open), Unsubscribed
  text format ('Stop' reply: public Mailinator cannot send a reply),
  "Include Unsubscribe in Email Header", a prospect unsubscribed before any
  email is sent.
