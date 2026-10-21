# HubSpot Link Clicked Smoke: one-time sequence setup

## Application Overview

One-time setup (not a trigger workflow): create sequence "HubSpot Link Clicked Smoke" with one Email step (step 1, Variant A) containing 2 tracked links, Track link clicks ON, Track email opens OFF, Send emails as text only OFF, sender attached, then activate. Explored on staging 2026-10-15, account linkclick, in two walkthroughs: "HubSpot Link Clicked Smoke Plan" (id 196733, incomplete) and "HubSpot Link Clicked Smoke Plan 2" (id 196734, steps 1 to 4 confirmed, activation BLOCKED because the only sender, Ritaellis1988+3@gmail.com, is paused on /email-accounts). No custom tracking domain picker exists in the sequence flow (not needed). Data rule KEEP_TEST_DATA=1. Production run must be guarded like tests/setup/email-bounced-smoke-sequence.spec.ts (env flag, skip if name exists, no retries). HARD RULES: never click any button inside the Email Accounts row of the sequence Settings tab (last button removes the sender); read the sender only.

## Test Scenarios

### 1. Setup: Link Clicked smoke sequence

**Seed:** `tests/seeds/linkclick.seed.spec.ts`

#### 1.1. Create HubSpot Link Clicked Smoke, add step 1 with 2 links, enable link tracking, activate

**File:** `tests/setup/link-clicked-smoke-sequence.spec.ts`

**Steps:**
  1. Open /sequence. Wait for the row group (getByRole('row').nth(1)). If a row filtered by getByText(name,{exact:true}) exists, stop (skip).
    - expect: List shows sequences with a status word (Active/Draft) in the name cell. SEEN.
  2. Click getByRole('button',{name:'Create Sequence'}). Wait for URL /sequence/<id>/steps. Capture id (staging run 2: 196734). Skip button did not appear.
    - expect: Steps tab opens at once (URL changed right after the click). SEEN.
  3. Rename: locator('.sequence-name--input'): click, fill the name, press Enter. Wait for getByRole('alert') with 'Sequence renamed successfully'.
    - expect: Toast shown and input value is the new name. Took about 2 s. SEEN.
  4. Click getByRole('button',{name:'Email',exact:true}). getByRole('dialog') opens. Wait for window.tinymce.editors.length === 2.
    - expect: Dialog Step 1 / A / Email with Subject and body editors; editors ready in about 1 s. SEEN.
  5. Subject: click dialog.locator('.editor-editable-content.single-line-content') then page.keyboard.type('HubSpot Link Clicked Smoke').
    - expect: Subject editor getContent() = '<div>HubSpot Link Clicked Smoke</div>...'. SEEN.
  6. Body with 2 links: page.evaluate to find the tinymce editor whose element lacks class single-line-content, call ed.setContent('<p>Hello, please see <a href="https://www.saleshandy.com">Saleshandy home</a> and <a href="https://www.saleshandy.com/pricing/">Saleshandy pricing</a>.</p>'), wait 1.5 s, read getContent() back; loop (max 10) until both hrefs are present.
    - expect: Run 2: first attempt stuck (both anchors read back after 1.5 s). Run 1 needed a retry about 15 s later, so keep the read-back loop. SEEN.
  7. Click getByRole('dialog').getByRole('button',{name:'Save',exact:true}). Wait for alert 'Sequence step created successfully' and dialog count 0.
    - expect: Run 2: ONE click was enough (toast and dialog closed within about 2 s). Run 1 needed two clicks, so keep a guarded second click if no toast within 3 s and the dialog is still open. SEEN.
  8. Click getByRole('tab',{name:'Settings'}); wait for URL /settings and about 1.5 s. Click getByRole('button',{name:'Safety Settings'}).
    - expect: Left nav buttons: Email Account, ESP Matching, Sending Schedule, Prospect Enrollment, Safety Settings, Sending Priority, Deal Value, Email Verification, Cc & Bcc, Unsubscribe. SEEN.
  9. Click getByRole('button',{name:'Track link clicks'}); in getByRole('dialog') ('Enable Link Tracking in Emails?') click getByRole('button',{name:'Enable Anyway'}). Wait for alert 'Sequence settings updated successfully'. Read state: locator('label',{hasText:'Track link clicks'}).first().locator('xpath=..').locator('input').first().isChecked().
    - expect: Before: all three unchecked. After: Track link clicks true, Track email opens false, Send emails as text only false. Whole step about 6.6 s. SEEN.
  10. READ ONLY: on the Settings tab read the Email Accounts table (page.evaluate over document.querySelectorAll('table') innerText, or getByText('Ritaellis1988+3@gmail.com')). Do NOT click any button in the row.
    - expect: First table: Sender Email / Tags / Signature / Active Sequence / Daily Limit / Setup Score / Owner; row: Link Clicked tag, SMTP, Ritaellis1988+3@gmail.com, signature 'Add', 0, 0/50, 79/100, LC. Sender is attached with no selection step. Header shows 'Start Sequence' (note: the header text shows a Start Sequence button). SEEN.
  11. Activate: page.goto(/sequence/<id>/steps); wait getByRole('button',{name:'Add Step'}).first(); click locator('.switchToggle').first(); dialog filtered by 'Activate Sequence' appears ('Are you sure you want to activate the Sequence?' No / Yes); click getByRole('button',{name:'Yes',exact:true}).
    - expect: Run 2 result on staging: toast (role alert) 'Email accounts in this sequence are either paused or disconnected, Activate them to resume the sequence.' Toggle stayed unchecked, no 'Sequence resumed successfully' toast. Cause read from /email-accounts: sender Ritaellis1988+3@gmail.com (tag Default) has its Switch checkbox UNCHECKED (paused); Ritaellis1988+4@gmail.com has it checked. FAILED/BLOCKED, needs QA to unpause the sender (account data change, not done). Activation success path (toast 'Sequence resumed successfully', Active in list) is (proposed, unconfirmed).
  12. Open /sequence; getByRole('row').filter({has: getByText(name,{exact:true})}).
    - expect: Row text after the failed activation: 'HubSpot Link Clicked Smoke Plan 2 Draft 0% 0 /0 51 - - - - - 1 - LC Link Clicked'. Status is a word (Draft/Active) in the name cell paragraph under the name link; Prospect column 51. Active text for the new sequence is (proposed, unconfirmed); existing sequence 196221 row shows 'Active'.
