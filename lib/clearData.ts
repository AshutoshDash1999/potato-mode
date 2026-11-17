// Clear one site's cookies and storage through the CDP session — never anything browser-wide.
import * as cdp from './cdp';

export type ClearKind = 'cookies' | 'storage' | 'serviceWorkers';

export interface ClearResult {
  origin: string;
  cookies: number;
  cleared: ClearKind[];
}

interface Cookie {
  name: string;
  domain: string;
  path: string;
  partitionKey?: unknown;
}

const STORAGE_TYPES = 'local_storage,indexeddb,cache_storage,websql,file_systems,shader_cache,storage_buckets';

export async function clearSiteData(tabId: number, pageUrl: string, kinds: ClearKind[]): Promise<ClearResult> {
  const origin = new URL(pageUrl).origin;
  let cookies = 0;

  if (kinds.includes('cookies')) {
    // Every cookie this page would send, including ones set on a parent domain.
    const res = await cdp.send<{ cookies: Cookie[] }>(tabId, 'Network.getCookies', { urls: [pageUrl] });
    for (const c of res.cookies) {
      await cdp
        .send(tabId, 'Network.deleteCookies', {
          name: c.name,
          domain: c.domain,
          path: c.path,
          ...(c.partitionKey && typeof c.partitionKey === 'object' ? { partitionKey: c.partitionKey } : {}),
        })
        .then(() => cookies++)
        .catch(() => {});
    }
  }

  const types = [
    kinds.includes('storage') ? STORAGE_TYPES : '',
    kinds.includes('serviceWorkers') ? 'service_workers' : '',
  ]
    .filter(Boolean)
    .join(',');
  if (types) {
    try {
      await cdp.send(tabId, 'Storage.clearDataForOrigin', { origin, storageTypes: types });
    } catch {
      // Older Chrome rejects storage types it doesn't know; fall back to the basics.
      await cdp.send(tabId, 'Storage.clearDataForOrigin', {
        origin,
        storageTypes: types.replace(STORAGE_TYPES, 'local_storage,indexeddb,cache_storage'),
      });
    }
  }

  return { origin, cookies, cleared: kinds };
}
