# Zoho reads without a window (2026-10-29)

Zoho CRM cannot be read headless (it ends on "Verify your identity") and a visible MCP window takes the user's focus. A headed browser on a virtual display does neither: the saved profile `auth/mcp-zoho-profile` keeps the login and no window shows.

```
xvfb-run -a -s "-screen 0 1440x900x24" node scripts/zoho-read/rows.ts   <list url> <text>        # rows of a list that contain the text
xvfb-run -a -s "-screen 0 1440x900x24" node scripts/zoho-read/ids.ts    "<list url>@@<text>"...  # record ids behind the matching links
xvfb-run -a -s "-screen 0 1440x900x24" node scripts/zoho-read/detail.ts "<record url>@@<regex>@@<length>"...  # text of a record page from the regex on
```

- List URLs on org 941113438: Contacts `/crm/org941113438/tab/Contacts/custom-view/7636887000000087529/list`, Accounts `.../Accounts/custom-view/7636887000000087515/list`, Deals `.../Potentials/custom-view/7636887000000087545/list`, Tasks `.../Tasks/custom-view/7636887000000331292/list`. The bare `/tab/Tasks` and `/tab/Potentials` open a Kanban view with no rows.
- `rows.ts` shows each record twice (table and row role). Use `ids.ts` to count records.
- Sort a list by newest: add `?sort_by=<created time field id>&sort_order=desc` (Accounts: `7636887000000002457`).
- Close any MCP Zoho window first. The profile cannot be open twice.
- Not tested: whether the login lasts across days.
