# Zoho: field mapping and saved settings (account gzoho)

Date: 2026-10-29. Source: QA saved the mapping and ran Email Sent by hand on staging. Claude read the saved screens (Saleshandy, read-only) and the new Zoho contact (read-only, `playwright-zoho`). This is a manual exploration. Use it to set the same mapping again, on staging or on production.

## How to set the mapping

By script: the pairs are in `src/config/zoho-field-mapping.ts`. On a new account, after Zoho is connected, run `npm run not-emailsent-zoho` (account `notemailsentzoho`; for another account run the spec with `SETUP_ACCOUNT=<account>`; spec `tests/setup/zoho-field-mapping.spec.ts`). It sets all four types, saves, reloads and reads every pair back. Staging or production follows the account. Run on `notemailsentzoho` (staging) on 2026-10-29: all four types saved and read back. By hand:

1. Open API & Integrations > Integrations > Zoho > Field Mapping.
2. Click one of the four rows: Contact Fields, Lead Fields, Account Fields, Deal Fields. The page title is "Field Mapping" for all four. Nothing on the page names the type.
3. For each Saleshandy field in the lists below, pick the Zoho field from the dropdown. Leave every other row on "Select".
4. Click Save. Do this for each type that the chosen action uses.
5. Open Triggers & Activity, turn the trigger ON, pick the action, and click Save.

The mapping is per type. The action that the trigger runs uses only the mapping of its own type. A "Create/Update a Contact in Zoho" action does not use the Lead, Account or Deal mapping.

## Mapping on gzoho (Saleshandy field => Zoho field)

Left side: 43 Saleshandy rows plus "Prospect Overview" (it has a dropdown of its own, "Select" on Contact, Lead and Account, and "Description" on Deal). Only mapped rows are listed. Every row not listed reads "Select". [staging, 2026-10-29]

Contact Fields (11 mapped):

```
First Name            => First Name
Last Name             => Last Name
Email                 => Email
Phone Number          => Phone
Job Title             => Title
Department            => Department
Twitter               => Twitter
City                  => Mailing Address - City
State                 => Mailing Address - State / Province
Country               => Mailing Address - Country / Region
Company HQ Location   => Mailing Address - Zip / Postal Code
```

Lead Fields (18 mapped):

```
First Name            => First Name
Last Name             => Last Name
Email                 => Email
Phone Number          => Mobile
Job Title             => Title
Industry              => Industry
Twitter               => Twitter
Website               => Website
City                  => Address - City
State                 => Address - State / Province
Country               => Address - Country / Region
Company               => Company
Company Website       => Website
Company Industry      => Industry
Company Size          => No. of Employees
Company Revenue       => Annual Revenue
Company Phone         => Phone
Company HQ Location   => Address - Zip / Postal Code
```

Website and Industry each take two Saleshandy fields.

Account Fields (10 mapped):

```
Website               => Website
City                  => Billing Address - City
State                 => Billing Address - State / Province
Country               => Billing Address - Country / Region
Company Website       => Website
Company Industry      => Industry
Company Size          => Employees
Company Revenue       => Annual Revenue
Company Phone         => Phone
Company HQ Location   => Billing Address - Zip / Postal Code
```

Deal Fields (4 mapped, plus Prospect Overview):

```
Prospect Overview     => Description
Company Revenue       => Expected Revenue
Deal Value            => Amount
Closing Date          => Closing Date
```

## Triggers & Activity on gzoho

- Email Sent from Saleshandy: toggle ON, action "Create/Update a Contact in Zoho". [staging, 2026-10-29]
- The other six triggers: toggle OFF, action "Select". [staging, 2026-10-29]
- Only the Contact action is selected. So only the Contact mapping above is used. Lead, Account and Deal mappings are saved but not used by this run.

## Run on 2026-10-29 (Email Sent, Contact action, 11:39 AM)

Zoho contact `John Subtronics` (`/crm/org941113438/tab/Contacts/7636887000000930005`), created Thu, 29 Oct 2026 11:39 AM by rudra, modified 11:41 AM by rudra. [Zoho, 2026-10-29]

```
Contact Name   John Subtronics
Email          johntronics@mailinator.com
Phone          dasda
Title          Head of ULF
Department     Customer Success
Twitter        alejandrovega
Mailing Address  30303 Real Madrid Madrid Spain
Account Name, Mobile, Lead Source, Description: empty
```

Comparison with the mapping: all 11 mapped Contact fields have a value in Zoho (First and Last Name, Email, Phone, Title, Department, Twitter, City, State, Country, Zip). No mapped Contact field is missing. [Zoho, 2026-10-29]

## Notes

- Twitter: Zoho stores the text as it came, with no format check. The value here is `alejandrovega` (no `@`, no URL). QA says the Zoho field accepts a username such as `@dharmeshsaleshandy`. [QA, 2026-10-29]
- The email on the Zoho contact, `johntronics@mailinator.com`, is the prospect's email (QA, 2026-10-29). No mismatch.
- QA reports that "the rest of the fields" did not show in Zoho. This scan finds no missing field. The Contact action has 11 mapped fields, and all 11 are in Zoho. If only the Contact action is on, the Lead, Account and Deal mappings are not used.
- Open: which Saleshandy fields QA expected in Zoho, and the prospect's values for them.
- QA rule: Logs are not used as evidence for Zoho. Check the Zoho record only.
- QA's mapping choice (open question 4 in `RESUME.md`) is the one above.

## Prospect data against the Contact mapping (2026-10-29)

Prospect `John Subtronics`, `johntronics@mailinator.com`, in Saleshandy CRM > All Prospects, account gzoho. Read from the prospect dialog. Prospect Owner "Zoho Integration", Creation Source "Manually Created". [staging, 2026-10-29]

The 11 mapped Contact fields, Saleshandy value and Zoho value:

```
First Name            John                              John
Last Name             Subtronics                        Subtronics
Email                 johntronics@mailinator.com        johntronics@mailinator.com
Phone Number          - (empty)                         Phone = "dasda"
Job Title             Head of ULF                       Title = Head of ULF
Department            Customer Success                  Department = Customer Success
Twitter               alejandrovega                     Twitter = alejandrovega
City                  Real Madrid                       Mailing City = Real Madrid
State                 Madrid                            Mailing State = Madrid
Country               Spain                             Mailing Country = Spain
Company HQ Location   30303                             Mailing Zip = 30303
```

Result: ten fields match. Phone Number is empty on the prospect, so no value can sync. The Zoho Phone value "dasda" does not come from Saleshandy. [staging and Zoho, 2026-10-29]

Prospect fields that hold data and have no mapping on the Contact type (all read "Select" there): Company Website `https://en.atleticodemadrid.com/`, Company Industry `Football Club`, Company Size `12`, Company Revenue `5653`, Company Founded Year `2013`, Company Domain `mailinator.com`, Company Phone `+15483332153`, Company LinkedIn, LinkedIn, Facebook, Experience `9`, Person's Seniority Level `director`, Deal Value `$21,121`, Company `Real Madrid`. [staging, 2026-10-29]

Where these are mapped on other types: Company, Company Website, Company Industry, Company Size, Company Revenue and Company Phone on Lead and Account (Account has no Company row), and Deal Value on Deal. These types are not used while only the Contact action is on.

Other facts from the prospect timeline: Step 1 email sent 11:36 AM, "Profile fields updated by Zoho Integration" at 11:38 AM, Step 2 email sent 11:39 AM. The Zoho contact was created at 11:39 AM. The Prospect Overview field holds pasted chat text and is not mapped on Contact.
