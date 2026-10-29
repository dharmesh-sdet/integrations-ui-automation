import { chromium } from 'playwright';
const root = '/home/dharmesh/Desktop/Dharmesh/Saleshandy/repo/local project/automation';
const ctx = await chromium.launchPersistentContext(root + '/auth/mcp-zoho-profile', { headless: false, viewport: { width: 1440, height: 900 } });
const p = ctx.pages()[0] ?? await ctx.newPage();
for (const spec of process.argv.slice(2)) {
  const [url, needle] = spec.split('@@');
  await p.goto(url); await p.waitForTimeout(12000);
  const out = await p.locator('a').evaluateAll((as, n) => as.filter(a => (a.textContent || '').toLowerCase().includes(n)).map(a => (a as HTMLAnchorElement).href.split('/tab/')[1] + ' | ' + a.textContent?.trim()), needle);
  console.log('== ' + needle + '\n' + [...new Set(out)].join('\n'));
}
await ctx.close();
