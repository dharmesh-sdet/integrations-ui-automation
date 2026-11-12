---
name: zoho-read-without-focus
description: How to read Zoho CRM with no window on QA's screen and no relogin (xvfb + saved profile); never open a visible browser window
metadata:
  type: feedback
---

QA 2026-10-29: a visible browser window takes their focus and disturbs their work. Headless Zoho ends on "Verify your identity" every time, and the API token lasts 10 minutes, so neither is an option. Do not open the `playwright-zoho` MCP window while QA works.

Use a headed browser on a virtual display with the persistent profile: `xvfb-run -a -s "-screen 0 1440x900x24" node automation/scripts/zoho-read/rows.ts <url> <text>` (also `ids.ts`, `detail.ts`). It kept the login, showed no window, and asked for nothing.

**Why:** QA said "it is taking control over the focus from me, be respectful", and "it won't work headless, it asks for login again and again".
**How to apply:** read Zoho yourself, never hand the reads to QA ("YOU need to do it yourself"). Close any MCP Zoho window first because the profile cannot be open twice. Method and list URLs: `automation/scripts/zoho-read/README.md`. Same rule for any other browser tool: prefer headless or xvfb.
