// Staging URLs, confirmed in context/project.md (section 4 answers).
export type Platform = 'saleshandy' | 'hubspot';
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
};

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
