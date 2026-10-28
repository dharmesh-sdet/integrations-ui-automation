// Staging URLs, confirmed in context/project.md (section 4 answers).
import { accounts, type Account } from './accounts.ts';

export type Platform = 'saleshandy' | 'hubspot' | 'salesforce' | 'pipedrive';
export type Browser = 'chromium' | 'edge';

export const platforms: Record<Platform, { baseURL: string; loginPath: string }> = {
  saleshandy: {
    baseURL: 'https://pyxis.lifeisgoodforlearner.com',
    loginPath: '/crm/list',
  },
  hubspot: {
    // To verify: plan gave https://app-na2.hubspot.com/home-beta; trying without /home-beta.
    baseURL: 'https://app-na2.hubspot.com',
    loginPath: '/',
  },
  // Developer Edition org (QA, 2026-10-15). The browser login asks for a code, so the
  // tests log in through the API instead, no code (src/utils/salesforce-login.ts).
  salesforce: {
    baseURL: 'https://saleshandy-dev-ed.develop.lightning.force.com',
    loginPath: '/lightning/page/home',
  },
  // Login page given by QA, 2026-10-23. One saved session per account
  // (npm run login:pipedrive -- <account>). The company is saleshandy.pipedrive.com
  // (seen 2026-10-24: app.pipedrive.com/auth/login sends a logged-in session there).
  pipedrive: {
    baseURL: 'https://saleshandy.pipedrive.com',
    loginPath: '/auth/login',
  },
};

// HubSpot is one common portal for every account, so it has one session per
// browser and needs no account in the login command. Salesforce is the same
// org for every workflow (`saleshandy-dev-ed`), but each workflow still gets
// its own saved session so parallel runs/sessions don't block each other or
// overwrite one another's login (QA, 2026-10-19), same as Saleshandy.
export function isSharedPlatform(platform: Platform): boolean {
  return platform === 'hubspot';
}

// Saleshandy production (QA, 2026-10-14: my.saleshandy.com). PROD_URL in
// automation/.env overrides it. Used only by accounts marked
// `environment: 'production'` in src/config/accounts.ts; HubSpot is the same
// portal for both.
const PRODUCTION_SALESHANDY_URL = (process.env.PROD_URL ?? 'https://my.saleshandy.com').replace(/\/+$/, '');

export function isProduction(account: Account | undefined): boolean {
  return account !== undefined && 'environment' in accounts[account] && accounts[account].environment === 'production';
}

// Base URL of a platform for an account: staging unless the account is a
// production one. Specs, fixtures and the login script use this, never
// `platforms[...].baseURL` directly.
export function baseUrlFor(platform: Platform, account: Account | undefined): string {
  return platform === 'saleshandy' && isProduction(account) ? PRODUCTION_SALESHANDY_URL : platforms[platform].baseURL;
}

// chromium = Playwright's bundled Chromium; edge = the installed Microsoft Edge.
// device is a Playwright device preset name, so each browser sends its own user agent.
export const browsers: Record<Browser, { device: string; channel?: string }> = {
  chromium: { device: 'Desktop Chrome' },
  edge: { device: 'Desktop Edge', channel: 'msedge' },
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && value in platforms;
}

export function isBrowser(value: unknown): value is Browser {
  return typeof value === 'string' && value in browsers;
}
