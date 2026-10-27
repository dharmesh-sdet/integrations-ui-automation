# Pipedrive: Industry dropdown values (Organization)

Source: [QA 2026-10-26] copied from the Industry dropdown of the Pipedrive organization form on gpipedrive. Not read by me in the UI.

The field is a single-select, so a value that is not on this list is not stored. The list has 20 values plus "(None)".

| # | Value |
|---|---|
| 0 | (None) |
| 1 | Accommodation services |
| 2 | Administrative and support services |
| 3 | Construction |
| 4 | Consumer services |
| 5 | Education |
| 6 | Entertainment providers |
| 7 | Farming, ranching, forestry |
| 8 | Financial services |
| 9 | Government administration |
| 10 | Holding companies |
| 11 | Hospitals and health care |
| 12 | Manufacturing |
| 13 | Oil, gas, and mining |
| 14 | Professional services |
| 15 | Real estate and equipment rental services |
| 16 | Retail |
| 17 | Technology, information and media |
| 18 | Transportation, logistics, supply chain and storage |
| 19 | Utilities |
| 20 | Wholesale |

## Why it matters for the Prospect Outcome Updated workflow

QA found on 2026-10-26 that Create Organization 1 failed because the prospect's Company Industry was "Work Management", which is not on this list. The Saleshandy contact data for the Company Industry column of `test-data/pipedrive/prospect-outcome-updated.csv` must use one of these values wherever the Organisation Fields map it to Industry. Rows that create or update an organization (Create Organization, Update Organization) are affected. Other workflows that map Company Industry to the Pipedrive organization are affected the same way.

The earlier failure with company "Brex" and the failure with "TaskForce 141" are explained by this. Trigger behavior 3 and 6 are not (they create a person and a lead, not an organization); their cause is still open.
