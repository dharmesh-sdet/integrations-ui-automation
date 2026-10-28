# Reply is Received in Saleshandy (Pipedrive): product issues found on staging

Date: 2026-10-28. Status: evidence only. QA has not said bug or not bug for any item. No Jira ticket exists.
Cases: `test-cases/pipedrive/reply-received.md`. Progress and run details: `reply-received-progress.md`.

## Environment

- Saleshandy staging: https://pyxis.lifeisgoodforlearner.com, account gpipedrive (dharmesh+gpipedrive@saleshandy.com).
- Pipedrive company: saleshandy.pipedrive.com. Pipeline: "Pipeline" (stages Qualified, Contact Made, and others).
- Workflow: Reply is Received in Saleshandy, version v2. API & Integrations > Integrations > Pipedrive > Triggers & Activity.
- Sequence: "Pipedrive Reply Received QA" (id 197377), 2 steps. Email Sent trigger was OFF. Only this trigger was ON, with one activity selected per row.
- Comparison: the same activities on the Email Sent trigger pass every one of these rows (`test-cases/pipedrive/email-sent.md`). Email Sent progress: all 33 rows passed.

## Steps that apply to every scenario below

1. Open API & Integrations > Integrations > Pipedrive > Triggers & Activity.
2. Turn ON "Reply is Received in Saleshandy". Select only the activity named in the scenario. Click Save.
3. In Pipedrive, make the records that the scenario needs (a person with two deals, for example). Use the prospect email.
4. In Saleshandy, add a prospect with that email to sequence 197377. Click Send now on step 1.
5. Wait until the email shows Sent. Open the Emails tab of the sequence and use Mark as Replied for the prospect.
6. Wait 15 seconds, then look in Pipedrive every 10 seconds for 90 seconds.
7. Open Settings > Integrations > Pipedrive > Logs. Read the newest "Reply is Received in Saleshandy" entry.

## Issue 1: Update a Deal does not change a deal when the person has two deals

- Activity selected: Update a Deal in Pipedrive (Pipeline, stage Contact Made).
- Records made in step 3: a person with two deals, "Legacy deal 1" (value 100) and "Legacy deal 2" (value 200), both in Pipeline and Qualified.
- Expected (same as Email Sent): only the newest deal changes. Its title becomes the prospect email and its stage becomes Contact Made. The older deal stays.
- Actual: neither deal changes. Both keep their title and stage, 90 seconds and several hours later. Logs shows status Success.
- Seen on: patience.gaye@mailinator.com, person 344, deals 156 and 157. The same result in the full run and in the rerun.
- Also, take a prospect that is not in Pipedrive. Select Create a Deal in slot 1 and Update a Deal in slot 2. The new deal is not renamed to the prospect email.

## Issue 2: Delete Deal does not delete a deal when the person has two deals

- Activity selected: Delete Deal in Pipedrive.
- Records made in step 3: a person with two deals, "Legacy deal 1" and "Legacy deal 2".
- Expected (same as Email Sent): only the newest deal is deleted. The older deal stays.
- Actual: both deals stay. Logs shows status Success.
- Seen on: ravi.ramdeen@mailinator.com, person 357, deals 169 and 170. The same result in the full run and in the rerun.

## Issue 3: no activity is added to the person

- Activities selected, one scenario each: Create a Person (prospect not in Pipedrive), Create a Person (person exists), and Update a Person (person exists).
- Two more scenarios use two activities: Create a Person then Update a Person, and Create Organization then Create a Person.
- Expected: the case file expects one done activity of type Email with the subject "Reply is Received in Saleshandy". This expectation is "proposed, unconfirmed". It comes from Email Sent, which adds "Email sent from Saleshandy". Create a Lead and Create a Deal rows expect no activity.
- Actual: the person is created or found, and the run shows Success. In the run detail, the steps "Create a person" and "Log Activity" both show Success. On the person page, the Focus list is empty and History shows Activities (0). There is no planned and no done activity.
- Seen on: jamal.alleyne@mailinator.com (person 307, created 11:31) and hanna.karpovich@mailinator.com. Logs entries: 11:30 (23.3 s, Success), 11:34 (8.3 s, Success), ids 6ae18f92c01fd209cc33f34b and 6ae190577dccc2ef45ddaf6c.
- Open question for QA: is "no activity" the intended result for Reply Received? If yes, the case is wrong. If no, this is a bug.

## Issue 4: a second person is created when the person already exists

- Activity selected: Create a Person in Pipedrive. Step 3: create the person with the prospect email.
- Expected: still one person with that email.
- Actual: the event adds a second person with the same email.
- Seen on: hanna.karpovich@mailinator.com, persons 308 (made in step 3) and 310 (made by the event). Earlier: farhana.salleh@mailinator.com, persons 244 and 245.
- Related: the prospect is not in Pipedrive. Create a Lead, Create a Deal and Create a Person are all selected. One prospect got three persons (kauna.pato@mailinator.com, persons 260, 261 and 262). Ticket AL-4177 covers duplicate runs from one event (Email Sent evidence, two organizations per send). Not confirmed that this is the same cause.

## Issue 5: Create Organization with free-text Industry still creates the organization

- Activity selected: Create Organization in Pipedrive. The prospect has a free-text Industry that is not an option of the Pipedrive Industry picklist.
- Expected (case, proposed): Pipedrive rejects the record and no organization is created. The run status is recorded.
- Actual: one organization is created (count of organizations with the company name went from 3 to 4).
- Open question for QA: is the case wrong, or does Pipedrive accept free text here?

## What is not known

- What each step in the run detail did. The View Details panel of the "Log Activity" step did not show its input and output. A developer can read it.
- Whether issues 1 to 4 come from the Reply Received workflow version v2 itself, because the same activities pass on Email Sent.

## Not product issues (script and environment, fixed or handled)

- Organizations list read only 48 rows: fixed by scroll and merge in `organizations.page.ts`.
- Deal title reader counted the value "₨ 0" as a deal: fixed in `people.page.ts`.
- Reused test data: rerun with `REFRESH_USED_ONLY=1`.
- Sender daily limit reached (50 of 50): a third sender was added.
