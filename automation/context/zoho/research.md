# Saleshandy <> Zoho CRM: public research

Date: 2026-10-28. Method: web search and page fetch only. No account was used.
Tags: [C] confirmed on the page named. [V] vendor marketing claim. [U] could not confirm.

## 1. Main sources
- Help: Zoho integration. https://docs.saleshandy.com/en/articles/8372758-zoho-integration
- Help: Zoho triggers and activities. https://docs.saleshandy.com/en/articles/8408322-zoho-triggers-activities
- Help: Zoho configuration and mapping. https://docs.saleshandy.com/en/articles/8423913-zoho-configuration-mapping-fields
- Blog: Introducing Saleshandy X Zoho Integration. https://www.saleshandy.com/blog/saleshandy-zoho-integration/
- Old method (Chrome extension): https://support.saleshandy.com/article/258-how-to-move-contact-from-zoho-crm-to-saleshandy (page returned HTTP 525 on fetch; only the search snippet was seen)
- Third party: https://zapier.com/apps/saleshandy/integrations/zoho-crm/1462335/create-saleshandy-prospects-from-new-or-updated-zoho-crm-contacts , https://integrately.com/integrations/saleshandy/zoho-crm , https://albato.com/connect/saleshandy-with-zoho
- G2 compare: https://www.g2.com/compare/saleshandy-vs-zoho-crm

## 2. Connect and disconnect
- Open Settings, find the "Integration" app, click "Connect Now", follow the prompts to link both accounts. [C] https://docs.saleshandy.com/en/articles/8372758-zoho-integration
- Auth method (OAuth, scopes, which Zoho data center): [U]. The docs do not name it.
- Disconnect steps: [U]. No article gives them. The FAQ only says "disconnect and reconnect" when you cannot connect or cannot see fields to map; if that fails, contact Support. [C] same URL.
- Plan: only the Outreach Pro plan. [C] same URL.

## 3. Triggers (Saleshandy events)
The page lists nine triggers. Each has a toggle. [C] https://docs.saleshandy.com/en/articles/8408322-zoho-triggers-activities
1. Email Sent from Saleshandy
2. Reply is Received in Saleshandy
3. Sequence Email is Opened
4. Link is Clicked in Saleshandy
5. When a Prospect is Unsubscribed
6. When an Email is Bounced
7. When a Prospect is Finished
8. When a Conversation Category is Updated (this is the "outcome updated" event; the name match is my reading, not stated)
9. Sequence Email is Opened (listed twice on the page; the reason is not explained)

Covered: sent, opened, link clicked, reply, bounce, unsubscribe, outcome (item 8), finished.
Saleshandy default triggers and activities cannot be changed. [C] same URL.

## 4. Activities (what is done in Zoho)
The page lists nine activities in a separate column. Which trigger gives which activity is chosen by you in a drop-down per trigger. [C] same URL
Create/Update Lead, Create/Update Deal, Create/Update Contact, Create/Update Account, Create Task.
- Example on the page: "When an Email is Sent from Saleshandy, a Deal is Created in Zoho."
- Pick the activity in the drop-down, then Save. [C]
- Deal: a pop-up asks closing date, pipeline, pipeline stage. [C]
- Task: Due Date, Subject, Status (Not Started, Deferred, In Progress, Completed, Waiting on someone else), Priority (High, Highest, Low, Lowest, Normal). [C]
- Settings for Lead, Contact, Account pop-ups: [U].
- Modules used: Leads, Deals, Contacts, Accounts, Tasks. [C] https://docs.saleshandy.com/en/articles/8372758-zoho-integration . The blog also says "Leads or Opportunities". [V]

## 5. Notes, tags, bounce and unsubscribe
- Each Saleshandy action is saved as a note on the matching Zoho record. [C] https://docs.saleshandy.com/en/articles/8372758-zoho-integration
- Unsubscribed and bounced contacts get the tag "Unsubscribed-Saleshandy" in Zoho. [C] same URL
- Exact note text, one note per event or grouped: [U].

## 6. Matching and duplicates
- If the contact, lead or deal is missing in Zoho, Saleshandy creates it. If it exists, Saleshandy adds the new notes or info. [C] https://docs.saleshandy.com/en/articles/8372758-zoho-integration
- A duplicate check runs automatically in the background. [C] same URL
- Match key (email? name?), which module wins when a person is both Lead and Contact, duplicate rules inside Zoho: [U]. The mapping article says duplicate rules are not covered. https://docs.saleshandy.com/en/articles/8423913-zoho-configuration-mapping-fields

## 7. Field mapping
- Path: account menu (top right) > Configure. Pick Zoho fields from drop-downs for each Saleshandy field, save. [C] https://docs.saleshandy.com/en/articles/8423913-zoho-configuration-mapping-fields
- Pre-mapped: first name, last name, email. [C] https://docs.saleshandy.com/en/articles/8372758-zoho-integration
- Saleshandy fields in the config: First Name, Last Name, Email, Phone Number, Job Title, Industry, Company, Company Domain, Linkedin, Twitter, Facebook, Website, City, State, Country. These default fields cannot be changed. [C] mapping URL
- Zoho fields listed are Deal fields (Deal Owner, Amount, Deal Name, Closing Date, Pipeline, Account Name, Stage, Type, Next Step, Probability, Lead Source, Contact Name, Tag, and others). Lead/Contact/Account field lists: [U]. Exact pairs: [U]. [C] mapping URL
- Custom fields: create under Prospect fields > Add Custom Field in Saleshandy, then map. [C] mapping URL
- Zoho custom fields in the drop-down, field types, required fields: [U].

## 8. Sync direction
- Main flow is Saleshandy to Zoho (events create/update records and notes). [C by the triggers page]
- Zoho to Saleshandy natively: [U]. Only manual: Saleshandy Connect Chrome extension. Open a Zoho lead, use the email finder, toggle a sequence, click "Save Prospect". [C] mapping URL
- Zapier/Integrately/Albato offer Zoho contact to Saleshandy prospect. Zapier says paid Zoho plans should use the instant module-entry trigger, not polling. [V] https://zapier.com/apps/saleshandy/integrations/zoho-crm/1462335/create-saleshandy-prospects-from-new-or-updated-zoho-crm-contacts

## 9. Limits and known problems
- Rate limits, delay between event and record, retry on failure: [U].
- Only known fix on the page: if connect fails or fields are missing, disconnect and reconnect, then contact Support. [C] https://docs.saleshandy.com/en/articles/8372758-zoho-integration
- Reddit, Zoho community, G2/Capterra/Trustpilot reviews about this connector: none found. [U] The Zoho community hits found were about Zoho CRM in general, not Saleshandy.
- G2 compare only says Saleshandy may not match Zoho CRM in CRM and task management. Not a connector bug. https://www.g2.com/compare/saleshandy-vs-zoho-crm
- Zoho Marketplace listing for Saleshandy: not found. [U]
- YouTube descriptions: not searched in depth. [U]

## 10. Common user scenarios (vendor stated) [V]
SDR team sends cold sequences, each email sent creates a Lead/Deal in Zoho, opens, clicks and replies show as notes, bounced or unsubscribed people are tagged, engaged leads get follow-up. https://www.saleshandy.com/blog/saleshandy-zoho-integration/

## Ideas for test cases
Run by hand on staging with a Zoho sandbox or test org. Use real-looking names, not "test".
1. Connect: Settings > Integration > Zoho > Connect Now. Sign in. Check status shows connected.
2. Plan gate: try the same on a non-Outreach-Pro account. Check what shows.
3. Reconnect: disconnect, connect again. Check mapping still shows.
4. Mapping defaults: open Configure. Check first name, last name, email are mapped and the 15 default Saleshandy fields show.
5. Custom field: add a Saleshandy custom prospect field, map it to a Zoho field, send. Check the value in Zoho.
6. Email Sent + Create Lead: prospect not in Zoho. Send. Check a Lead appears with mapped fields and a note.
7. Email Sent + Create Deal: set closing date, pipeline, stage. Check the Deal values in Zoho.
8. Email Sent + Create Contact / Create Account: check each record.
9. Existing record: person already in Zoho. Send. Check no second record and a new note is added (duplicate check).
10. Same person sent twice (two emails): check one record, two notes.
11. Email Opened + Update Lead/Deal: open the email. Check the update and note.
12. Link Clicked: click a tracked link. Check the Zoho record changes.
13. Reply Received: reply from the prospect mailbox. Check note and update.
14. Bounce: send to an invalid address. Check tag "Unsubscribed-Saleshandy" and note.
15. Unsubscribe: click unsubscribe link. Check the tag.
16. Prospect Finished: finish a sequence. Check the chosen activity runs.
17. Outcome update: change the conversation category (for example Interested). Check Zoho.
18. Task: set Create Task with subject, due date, status, priority. Check the Task in Zoho.
19. Trigger toggle off: turn a trigger off. Fire the event. Check nothing is created.
20. Change the activity in the drop-down and save. Check the new activity is used.
21. Missing fields: prospect with no company or phone. Check the record is still created.
22. Special characters in names (accents, apostrophe). Check they show right in Zoho.
23. Two Saleshandy users with different Zoho owners: check record owner.
24. Zoho side removed: delete the Lead in Zoho, then trigger again. Check recreate or error.
25. Bulk: 20 prospects in one sequence. Check all records and notes arrive.
26. Chrome extension: save a Zoho lead to a sequence. Check name, email, custom fields.
