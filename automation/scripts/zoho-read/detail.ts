import { chromium } from 'playwright';
const root = '/home/dharmesh/Desktop/Dharmesh/Saleshandy/repo/local project/automation';
const ctx = await chromium.launchPersistentContext(root + '/auth/mcp-zoho-profile', { headless: false, viewport: { width: 1440, height: 900 } });
const p = ctx.pages()[0] ?? await ctx.newPage();
for (const spec of process.argv.slice(2)) {
  const [url, pattern, len] = spec.split('@@');
  await p.goto(url);
  await p.waitForTimeout(12000);
  const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  const i = pattern ? t.search(new RegExp(pattern)) : 0;
  console.log('== ' + url.split('/tab/')[1] + ' | total', (t.match(/Total Records\s*(\d+)/) || [])[1]);
  console.log(i < 0 ? '(pattern not found)' : t.slice(Math.max(i, 0), Math.max(i, 0) + Number(len || 900)));
}
await ctx.close();
