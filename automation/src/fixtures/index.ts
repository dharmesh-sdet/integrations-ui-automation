import { test as base, devices, type Browser as PlaywrightBrowser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { accounts, type Account } from '../config/accounts.ts';
import { browsers, isBrowser, platforms, type Browser, type Platform } from '../config/environments.ts';
import { HubSpotCompaniesPage } from '../pages/hubspot/companies.page.ts';
import { HubSpotContactsPage } from '../pages/hubspot/contacts.page.ts';
import { HubSpotDealsPage } from '../pages/hubspot/deals.page.ts';
import { HubSpotPage } from '../pages/hubspot/hubspot.page.ts';
import { MailinatorPage } from '../pages/mailinator.page.ts';
import { SaleshandyCrmPage } from '../pages/saleshandy/crm.page.ts';
import { FieldMappingPage } from '../pages/saleshandy/field-mapping.page.ts';
import { SequenceBuilderPage } from '../pages/saleshandy/sequence-builder.page.ts';
import { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { HubSpotIntegrationPage } from '../pages/saleshandy/hubspot-integration.page.ts';
import { assertSessionFresh } from '../utils/session.ts';

type Options = {
  // The workflow's account (src/config/accounts.ts). Each spec sets it with
  // test.use({ account: '<name>' }); there is no default, so a spec never
  // silently runs on another workflow's account.
  account: Account | undefined;
};

type WorkerFixtures = {
  sessionContexts: SessionContexts;
};

type Fixtures = {
  hubspotPage: Page;
  saleshandyPage: Page;
  hubspotContacts: HubSpotContactsPage;
  hubspotDeals: HubSpotDealsPage;
  hubspotCompanies: HubSpotCompaniesPage;
  saleshandyIntegration: HubSpotIntegrationPage;
  saleshandyCrm: SaleshandyCrmPage;
  saleshandySequence: SaleshandySequencePage;
  saleshandyFieldMapping: FieldMappingPage;
  saleshandySequenceBuilder: SequenceBuilderPage;
  // A tab in the Saleshandy context for the prospects' Mailinator inboxes.
  mailinator: MailinatorPage;
};

// One logged-in browser context per platform, account and browser, kept for
// the whole worker (a spec file's tests run in order in one worker), so the
// app code and cookies are loaded once per workflow, not once per test. Every
// test still gets its own fresh page, and the pages are closed after the test.
class SessionContexts {
  private contexts = new Map<string, BrowserContext>();

  private browser: PlaywrightBrowser;

  constructor(browser: PlaywrightBrowser) {
    this.browser = browser;
  }

  async get(platform: Platform, account: Account, browserName: Browser): Promise<BrowserContext> {
    const key = `${platform}:${account}:${browserName}`;
    let context = this.contexts.get(key);
    if (!context) {
      context = await this.browser.newContext({
        ...devices[browsers[browserName].device],
        baseURL: platforms[platform].baseURL,
        storageState: assertSessionFresh(platform, account, browserName),
      });
      this.contexts.set(key, context);
    }
    return context;
  }

  async closeAll(): Promise<void> {
    for (const context of this.contexts.values()) await context.close();
    this.contexts.clear();
  }
}

// A logged-in page for one platform, in the worker's context for the spec's
// account. Fails early with a login hint if the account is not set, or the
// session is missing or older than a week. Only created when a test asks for it.
async function loggedInPage(
  sessions: SessionContexts,
  platform: Platform,
  account: Account | undefined,
  testInfo: TestInfo,
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const browserName = testInfo.project.metadata.browser;
  if (!isBrowser(browserName)) {
    throw new Error(`Project "${testInfo.project.name}" needs metadata.browser`);
  }
  if (!account) {
    throw new Error(
      `No account for this spec. Add test.use({ account: '<name>' }) at the top; ` +
        `accounts: ${Object.keys(accounts).join(', ')} (src/config/accounts.ts)`,
    );
  }
  const context = await sessions.get(platform, account, browserName);
  await use(await context.newPage());
  // The page and any tab the test opened (e.g. Mailinator); the context stays.
  for (const page of context.pages()) await page.close();
}

export const test = base.extend<Options & Fixtures, WorkerFixtures>({
  account: [undefined, { option: true }],
  sessionContexts: [
    async ({ browser }, use) => {
      const sessions = new SessionContexts(browser);
      await use(sessions);
      await sessions.closeAll();
    },
    { scope: 'worker' },
  ],
  hubspotPage: async ({ sessionContexts, account }, use, testInfo) =>
    loggedInPage(sessionContexts, 'hubspot', account, testInfo, async (page) => {
      await HubSpotPage.closePopups(page);
      await use(page);
    }),
  saleshandyPage: async ({ sessionContexts, account }, use, testInfo) =>
    loggedInPage(sessionContexts, 'saleshandy', account, testInfo, use),
  hubspotContacts: async ({ hubspotPage }, use) => use(new HubSpotContactsPage(hubspotPage)),
  hubspotDeals: async ({ hubspotPage }, use) => use(new HubSpotDealsPage(hubspotPage)),
  hubspotCompanies: async ({ hubspotPage }, use) => use(new HubSpotCompaniesPage(hubspotPage)),
  saleshandyIntegration: async ({ saleshandyPage }, use) => use(new HubSpotIntegrationPage(saleshandyPage)),
  saleshandyCrm: async ({ saleshandyPage }, use) => use(new SaleshandyCrmPage(saleshandyPage)),
  saleshandySequence: async ({ saleshandyPage }, use) => use(new SaleshandySequencePage(saleshandyPage)),
  saleshandyFieldMapping: async ({ saleshandyPage }, use) => use(new FieldMappingPage(saleshandyPage)),
  saleshandySequenceBuilder: async ({ saleshandyPage }, use) => use(new SequenceBuilderPage(saleshandyPage)),
  mailinator: async ({ saleshandyPage }, use) => use(new MailinatorPage(saleshandyPage.context())),
});

export { expect } from '@playwright/test';
