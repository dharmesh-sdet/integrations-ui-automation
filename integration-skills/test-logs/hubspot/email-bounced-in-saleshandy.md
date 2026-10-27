# HubSpot — Email is Bounced in Saleshandy (staging)

- Direction **SH → CRM**. Export `681368981acc0cbcd16295ad`, slug `hubspot`, trigger `64647656c7f3ab6e2bf5b134`.
- `v1-original.json` = definition pasted by the user, 2026-10-13 (101 nodes).
- Report: update-company ran with status Success (node 10 returned 200, `city: abcd` on 351296561884), but the company the user was looking at did not change.

## v1 audit vs live Email Sent (`../link-is-clicked-in-saleshandy/email-sent-live.json`)
B1 update-company: name search, oldest match (9/113), instead of the latest company associated with the contact · B2 update-deal: dealname search, oldest match (22/90), the AL-4119 bug ·
B3 fallback create deal/company (105/112) have no note/log · B4 `log_email` without headers ("Unknown Contact") · B5 notes on a new deal not linked to the contact ·
B6 merge order lets the mapping overwrite fixed fields, and empty values are not dropped · B7 dates lack T12 · B8 `hs_email_domain` not stripped · B9 raw prospect phone/city/... on update-contact ·
B10 task status "" + empty association · B11 dead node 23.

## v2 — `v2-email-sent-copy.json` (patch `patches/v2_email_sent_copy.py`, same approach as Link Clicked v3)
Graph = live Email Sent; top level + start trigger = Bounce v1. Bounce-specific changes only:
- `emailSentAt` → `emailBouncedAt`
- 11 notes: Email Sent text + `Raw Bounce Reason`
- 9 email logs: subject `Email Bounced - Saleshandy`, `hs_email_status: BOUNCED`
Checks: 114 nodes / 113 edges, same as Email Sent; every other node identical to Email Sent apart from the time field; top level == v1; every `node.X` reference is upstream; every `workflow.fields.*` exists in Bounce config.

## v3 — `v3-log-contact-link.json` (patch `patches/v3_log_contact_link.py`, base = v2), 2026-10-15
**Problem (in plain words):** when a customer chooses "Update a Deal" + "Record (log) an Email Activity", the bounced email shows up on the deal in HubSpot, but the person on it says **"Unknown Contact"**.

**Why it happens:** the step that logs the email only attaches the email to the **deal** (or company). It never attaches it to the **contact**. HubSpot takes the person's name from the contact that is attached, so with no contact attached it shows "Unknown Contact". The workflow had already found the contact earlier in the same path; it just never passed the contact on to the log step.

**What I changed:** in 3 log-email steps, I attached the email to the contact as well. Nothing else changed.

| Node | When it runs | Contact it now uses |
|---|---|---|
| 88 | Update Deal + log email | contact found at the start of update-deal (node 110) |
| 80 | Update Company + log email | contact found at the start of update-company (node 153) |
| 146 | Create Company, when a new contact had to be created + log email | the newly created contact (node 141) |

Technically: one extra entry in the `associations` list of the `POST /crm/v3/objects/emails` body, `associationTypeId: 198` (email → contact). This is the same way the create-deal log steps (63, 109) already do it, and those work fine.

**Result:** the logged email shows the prospect's name and also appears on the contact's timeline. Emails logged before the fix stay "Unknown Contact".

**Not the Reply Received (AL-4129) problem:** that one was caused by email headers being escaped twice by code nodes. This workflow has no such code nodes, so that problem cannot happen here.

Checks (offline only, not run live yet): only nodes 80, 88, 146 differ from v2; node and edge counts unchanged; every log-email step now has a contact; each contact reference points to a step that runs earlier; all 3 bodies are valid JSON.
Retest: trigger a bounce with Update Deal + Record Email Activity and check that the HubSpot timeline shows the prospect's name.

### v3 live run R1 — 2026-10-15 06:06 (real bounce)
Setup: test sequence 196718 "HS Email Bounced test" (`2AwrMQlEzQ`, step `klw693dgz1`), sender rudra@ (369550), linked account 80121.
Config: create = Sales Pipeline / Qualified Lead / newbusiness / high / 30 days; update = Negotiation / existingbusiness / low / 45 days; Lead Status NEW, Lifecycle lead; Update Lead Status CONNECTED, Lifecycle opportunity; task "Bounce follow-up" / TODO / HIGH / 3 days.
App mappings: Contact `{jobTitle:jobtitle, city:city, phoneNumber:phone}`, Company `{city, state}`, Deal `{annualRevenue:amount}` (unchanged).
Prospect `sh.bounce.zq7x.r1.113615@gmail.com` → Gmail 550 5.1.1 → SH status Bounced 06:06:40 → run `6ad06d776e7ef68d28016f78` (all nodes Success).
Actions `["update-deal","update-company","update-contact","create-note","record-email-activity"]`; HubSpot probes contact 569709256439, company 352462106353, deal 354544820949.

| Check | Result |
|---|---|
| Update Deal (25) | **PASS** Negotiation / existingbusiness / low / close 2026-11-29 |
| Update Contact (20 + 55) | **PASS** jobtitle, city, phone mapped; lifecycle opportunity; lead status CONNECTED |
| Update Company (10) | **PASS** city Ahmedabad, state Gujarat |
| Notes 79 / 83 / 87 | **PASS** created; 79 on company, 83 on contact, 87 on contact + deal; body has bounce reason |
| Log emails 80 / 84 / 88 | **PASS** all three linked to the contact (contact → emails = 407137060549, 407151425210, 407160408793); 88 sent contact 198 + deal 210, 80 sent contact 198 + company 186. "Unknown Contact" fixed |

Observations (same as production, not changed): update-company sets `domain` = prospect email domain (`r1bounce.example.com` → `gmail.com`); dealname rewritten to `{{first}}{{last}}` ("BouncyR1Test").
HubSpot token can't read email objects (MISSING_SCOPES), so email links were checked from the contact/deal/company side.

## v4 — `v4-note89-contact-path.json` (patch `patches/v4_note89_contact_path.py`, base = v3), 2026-10-15
**Problem (plain words):** with "Create Task" + "Create Note" for a prospect who is already a HubSpot contact, the note after the task was not attached to the contact.
**Why:** node 89 read the contact id from `{{node.92.body.contactID}}`. Node 92 is a transform, and a transform puts its output under `result`, so that path is always empty. The task node right before it (45) already uses the correct path.
**Change:** node 89 `contact_id` → `{{node.92.body.result.contactID}}`. Nothing else.
Checks (offline): only node 89 differs from v3; edges and top level identical; node 92 runs before 89.
Not changed on purpose (user decision): nodes 20, 55, 52 still skip the `hs_email_domain` strip — only fails if Contact Properties maps `hs_email_domain`.
Retest: Create Task + Create Note for an existing contact → note linked to the contact.
