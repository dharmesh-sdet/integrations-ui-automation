# Email Sent from Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-02. Spec: tests/zoho/email-sent-smoke.spec.ts. Command: npm run smoke:zoho-email-sent.

Environment: Production Saleshandy, account `emailopenedprod`. Zoho CRM org crm.zoho.com. This is a baseline. No fixed bug exists for this workflow. It uses only rows that passed on staging (22 of 24, 2026-11-02). 8 checks, 8 sends.

Not covered, still open: AL-4198, AL-4199 and AL-4218 (status To Do). Also not covered: Task with an empty Subject, step 2 email, five actions saved together, Expected Close Date and Custom Workflow. Z-5 (a deal creates its own account) is known, so row 5 states it. If a row ends with two records for one prospect, report it to QA. Do not file it again.

Test data and setup:
- Each row uses a new prospect. The script sends step 1 with Send now and waits for Sent. SEND_CAP is 20.
- After Sent, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min. Do not open Logs for Zoho.
- For row 3, the script first creates a contact with an old Phone and Title. It never edits existing Zoho records.
- Turn on "Email Sent from Saleshandy" with only the action of the row. Reload and read it back before the send. QA makes sure that "Email is Opened in Saleshandy" and "Link is Clicked in Saleshandy" are off.
- Do not run at the same time as another smoke run on `emailopenedprod`.
- No cleanup in Zoho after a row.
- The gate runs first (`tests/setup/zoho-prod-gate.spec.ts`). If Zoho shows Re-connect, the run stops.
- The sequence "Zoho Email Sent Smoke <date>" has one email step. Track email opens and Track link clicks are off.

| # | Action | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Create/Update a Lead | Prospect not in Zoho | Send the step 1 email | One lead with the mapped Lead Fields and the prospect company. One note | None |
| 2 | Create/Update a Contact | Prospect not in Zoho | Send the step 1 email | One contact with the 11 mapped Contact fields. One note | None |
| 3 | Create/Update a Contact | Contact exists with an old Phone and Title | Send the step 1 email | Same contact updated. Still 1 contact. One note | None |
| 4 | Create/Update Account | Prospect has a company, no contact, no account | Send the step 1 email | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |
| 5 | Create/Update a Deal (Closing date 0) | Prospect not in Zoho, has a company | Send the step 1 email | One deal named after the prospect, no contact created. Amount is Deal Value, Closing Date empty, Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 6 | Create a Task (Subject "Follow up after step 1", Not Started, Normal, Due In 3) | Prospect not in Zoho | Send the step 1 email | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 7 | Contact and Lead together | Prospect not in Zoho | Send the step 1 email | 1 contact and 1 lead. No duplicate contact | None |
| 8 | Trigger OFF | Email Sent trigger OFF | Send the step 1 email | Nothing created or changed in Zoho | None |
