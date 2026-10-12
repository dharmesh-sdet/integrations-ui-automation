// Opens a visible browser on an MCP server's profile at the page where the
// headless MCP browser got stuck (login, CAPTCHA, ...), so QA can finish that
// step by hand (QA, 2026-10-09). Whatever QA does (e.g. a login) is saved in
// the profile; the headless MCP browser uses it afterwards.
// Close the MCP browser first (browser_close): a profile can be open in only
// one browser at a time. The script ends when QA closes the window.
//   npm run mcp:open -- <profile folder name in auth/> <url> [chrome|msedge]
//   npm run mcp:open -- mcp-companycreated-profile https://app-na2.hubspot.com/login
import path from 'node:path';
import { chromium } from '@playwright/test';

const [profile, url, channel = 'chrome'] = process.argv.slice(2);
if (!profile || !url || !profile.startsWith('mcp-')) {
  console.error('Use: npm run mcp:open -- <mcp-...-profile> <url> [chrome|msedge]');
  process.exit(1);
}

const context = await chromium.launchPersistentContext(path.resolve(import.meta.dirname, '../auth', profile), {
  channel,
  headless: false,
  viewport: null,
  args: ['--window-size=1440,900'],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(url);
console.log(`Opened ${url} in ${profile}. Finish the step, then close the window.`);
// Done when QA closes the last tab or the window.
await new Promise<void>((resolve) => {
  context.on('close', () => resolve());
  context.on('page', (p) => p.on('close', () => context.pages().length === 0 && resolve()));
  page.on('close', () => context.pages().length === 0 && resolve());
});
await context.close().catch(() => {});
console.log('Window closed; the profile is saved.');
