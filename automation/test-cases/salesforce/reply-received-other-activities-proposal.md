# Reply is Received in Saleshandy: other activities, Regression proposal

For QA review. Not scripted yet. Environment: Staging (pyxis.lifeisgoodforlearner.com).
Account: `sfreplyreceived`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket
AL-4133 (parent AL-4131). No sub-bugs known, so Ticket is None for every row.
Scope: Update a Lead, Create a Contact, and Attach Note paired with Create a
Contact, all under the trigger "Reply is Received in Saleshandy". None of the
three has an Extra Configuration dialog (seen 2026-10-20).

Rows marked "(proposed, unconfirmed)" have an Expected result that is not
documented or seen. Run them and record what really happens; a different result
is not automatically a failure.

Only realistic rows are included: one prospect, one reply, a check in
Salesforce itself, and records that a person can prepare in the Salesforce UI.

## Test data setup

- Same as the Create a Lead file (`reply-received.md`): own brand-new prospect per
  row, added to the launched sequence with Add Prospects, wait for step 1 Sent,
  then "Mark as replied" (Emails tab > row > three dots).
- How a row is checked (QA's way, 2026-10-20): after Mark as Replied wait 15 s,
  then look for the record in Salesforce. If it is not there, wait 5 s, hard
  refresh and look again. Only if it is still missing, open Logs. Success in Logs:
  go back to Salesforce and verify. Error in Logs: do not fail the row; report it
  to QA with the scenario and the steps done. Create a Contact + Attach Note rows
  are the exception: they are checked from Logs only (see that section).
- Triggers: turn every other trigger off. For each section below, keep only the
  activities named in its heading selected, then Save.
- Records that must exist first (Lead, Contact) are created in the Salesforce UI
  with the prospect's email before the reply, with at least one value that
  differs from the prospect's, so a change is visible.
- Contact Properties mapping (seen 2026-10-20): First Name, Last Name, Email,
  Phone Number (Business Phone), Department, City (Other City), State, Country,
  Company HQ Location, Profile Picture. Job Title and Company are not mapped.

## Update a Lead in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead with the prospect's email exists with a different Job Title, Phone and Company | Mark as Replied | Success within 3 min. Still exactly one Lead for the email. Title, Phone, Company and Address show the prospect's values **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 2 | Lead exists, Lead Status set to "Working - Contacted" in Salesforce, prospect has new Job Title | Mark as Replied | Success. Title updated. Lead Status still "Working - Contacted" **(proposed, unconfirmed)** | None |
| 3 | Lead exists with a Phone, prospect has no Phone | Mark as Replied | Success. Lead Phone is unchanged or cleared. Record which **(proposed, unconfirmed)** | None |
| 4 | No Lead or Contact with the prospect's email in Salesforce | Mark as Replied | No Lead is created. Record the Logs status (Success or Error) **(proposed, unconfirmed)** | None |

## Create a Contact in Salesforce

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect (First Name, Last Name, Email, Phone, Department, City filled), not in Salesforce | Mark as Replied | Success within 3 min. Exactly one Contact with Name, Email, Business Phone, Department and Other Address matching the prospect. No Lead is created **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 2 | Prospect has Job Title and Company filled (not mapped for Contacts) | Mark as Replied | Success. Contact Title is empty and Account Name is empty **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 3 | Contact with the prospect's email already exists | Mark as Replied | Still exactly one Contact for the email. Record whether its values changed **(proposed, unconfirmed)** | None |
| 4 | A Lead with the prospect's email was created in Salesforce beforehand (by hand in Salesforce, not by the integration), no Contact. Only "Create a Contact" is selected | Mark as Replied | One Contact is created. The Lead is unchanged **(proposed, unconfirmed)** | None |

## Create a Contact in Salesforce + Attach Note in Salesforce

Extra Configuration: None.

Checked from Logs only (QA, 2026-10-20): open Logs and read the status of the new
"Reply is Received in Saleshandy" entry. Success or Error is recorded; neither is a
bug by itself. On Success, the Note is also looked up on the Contact in Salesforce.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect, not in Salesforce, outcome left as "Add Outcome" | Mark as Replied | Logs status recorded. On Success: one Contact created and one Note on it (Related > Notes & Attachments) with Title "reply-received" and a Body of sequence and email details. Latest Outcome is empty, as expected for "Add Outcome" (QA, 2026-10-20) **(observed 2026-10-20, awaiting QA confirmation)** | None |
| 2 | Contact with the prospect's email already exists | Mark as Replied | Logs status recorded. On Success: still exactly one Contact and one Note attached to it **(proposed, unconfirmed)** | None |
| 3 | Attach Note selected alone, no Create or Update Contact | Mark as Replied | Logs status recorded. On Success: no Note on any record **(proposed, unconfirmed)** | None |
| 4 | New prospect, not in Salesforce, prospect outcome changed in Saleshandy (for example to Interested) before the reply | Change the prospect outcome, then Mark as Replied | Logs status recorded. On Success: one Contact created and the Note's Body shows Latest Outcome with the outcome that was set **(proposed, unconfirmed)** | None |

## Pilot results, 2026-10-20 (observed on staging, one send each)

Account `sfreplyreceived`, sequence 196746, mapping as in Test data setup.

- Update a Lead 1: the Lead had Title "Legacy Title QA", Phone "+1 555-0100-0000"
  and Company "Pilot Legacy Co". After the reply it showed the prospect's
  Title "Sales Development Manager", Phone "+1 555-0817-4958", Company "AWS" and
  Address "Arequipa Arequipa Peru". Still one Lead. Lead Status unchanged
  ("Open - Not Contacted", never set to anything else, so row 2 is still
  untested). Logs: one new entry, Success, 3.0 s. Company was overwritten even
  though a person might expect it to stay.
- Create a Contact 1 and 2: Logs Success (4.2 s). One Contact for the email, no
  Lead. Contact header showed Name, Phone and Email; Title and Account Name
  empty (Job Title and Company are not mapped for Contacts).
- Contact + Attach Note 1: Logs Success (14.2 s, slower than the 4 to 6 s of the
  other runs). One Contact with Name, Business Phone, Email, Department "Design"
  and Other Address "Gulu, Northern, Uganda"; Title and Account Name empty.
  Notes & Attachments shows 1 Note. Note Title "reply-received", Parent = the
  Contact. Body: "Title: reply-received, Sequence: https://my.saleshandy.com/sequence/196746/steps,
  Sequence Name, Step: 1, Variant: A, Sender Email, Sent as a new thread? true,
  Contains Link? false, Latest Outcome: (empty), Prospect Email, User". There is
  no reply text in the Note.

Answered by QA, 2026-10-20:
- The Note's sequence link points to my.saleshandy.com on staging (pyxis): a bug.
  Draft: `jira/drafts/reply-received-sf-attach-note-sequence-link-production-host.json`
  (related to AL-4118, the same problem on HubSpot).
- Latest Outcome in the Note comes from the prospect's outcome. To fill it, change
  the prospect outcome first, then Mark as replied. With "Add Outcome" it is empty,
  as seen. Attach Note row 4 covers the filled case.

Still open for QA: the Note has no reply text after "Mark as replied". Is that
the intended content, or should the reply text appear?

## Regression set across the whole trigger

Run every release (must be able to fail, no unconfirmed item left):
- Baseline 1, 2, 3.
- Create a Lead 1, 2, 3, 7, 12, 13.
- Update a Lead 1, 4. Create a Contact 1, 2. Create a Contact + Attach Note 1.
  (After QA confirms their Expected results.)

Run on change or when QA asks (exploration until QA confirms the result):
- Create a Lead 4, 5, 6, 8, 9, 10, 11.
- Update a Lead 2, 3. Create a Contact 3, 4. Create a Contact + Attach Note 2, 3, 4.

Not covered, on purpose: Create or Update Account, Update a Contact, Create or
Update Opportunity, Record(log) an Email Activity. Each needs its own
exploration and QA's go.
