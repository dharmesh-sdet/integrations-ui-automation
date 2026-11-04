import type { BrowserContext, Page } from 'playwright';

// Pages that load slowly because of files a test never reads: pictures, video, and tracking or chat scripts.
// A blocked request ends at once, so the page reaches "loaded" sooner. Scripts and styles of the app itself are never blocked.
const TRACKERS =
  /(google-analytics|googletagmanager|doubleclick|hotjar|fullstory|clarity\.ms|segment\.(io|com)|mixpanel|facebook\.net|connect\.facebook|linkedin\.com\/px|intercom|crisp\.chat|drift\.com|hs-analytics|hubspot\.com\/__ptq)/i;

export type BlockOptions = {
  // Also block pictures. Zoho text is read from the page, so pictures are not needed there. Leave it off for pages
  // whose toolbar icons are <img> files (Saleshandy), because a broken icon can break a click.
  images?: boolean;
};

// Set ASSET_BLOCK=0 to switch it off for a run, for example to see if a failure comes from the blocking.
export async function blockHeavyAssets(target: BrowserContext | Page, options: BlockOptions = {}): Promise<void> {
  if (process.env.ASSET_BLOCK === '0') return;
  const kinds = new Set(['media', ...(options.images ? ['image'] : [])]);
  await target.route('**/*', (route) => {
    const request = route.request();
    if (kinds.has(request.resourceType()) || TRACKERS.test(request.url())) return route.abort();
    return route.continue();
  });
}
