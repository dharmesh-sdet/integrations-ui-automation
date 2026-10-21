import { chromium, devices } from 'playwright';
import path from 'path';

const PROJECT = path.resolve(import.meta.dirname, '..');
const SESSION = path.join(PROJECT, 'auth/saleshandy-sfreplyreceived-chromium.json');
const BASE = 'https://pyxis.lifeisgoodforlearner.com';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    storageState: SESSION,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const objects = ['Lead Properties', 'Contact Properties', 'Opportunity Properties', 'Account Properties'];

  for (const objName of objects) {
    console.log(`\n========== ${objName} ==========`);

    // Navigate fresh each time
    await page.goto(`${BASE}/settings/integrations`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await page.locator('text=Salesforce').first().click();
    await page.waitForTimeout(4000);

    // Click the object card
    const card = page.locator(`text=${objName}`).first();
    await card.click();
    await page.waitForTimeout(3000);

    const safeName = objName.replace(/\s+/g, '-').toLowerCase();
    await page.screenshot({ path: `/tmp/sf-${safeName}.png`, fullPage: true });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const startIdx = bodyText.indexOf('Prospect Overview');
    const endIdx = bodyText.indexOf('Save', startIdx > -1 ? startIdx : 0);
    if (startIdx > -1 && endIdx > -1) {
      console.log(bodyText.substring(startIdx, endIdx));
    } else {
      console.log('Could not find mapping section');
      console.log(bodyText.substring(0, 3000));
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
