// Inventory of every request on the current page load, from the CDP session we already hold:
// heaviest files, bytes per domain (first vs third party) and bytes per resource type.
import { hostOf, siteOf } from './domain';

export interface NetEntry {
  url: string;
  /** CDP resource type: Document, Script, Stylesheet, Image, Font, XHR, Fetch, Media... */
  type: string;
  /** Compressed bytes over the wire (0 when served from cache). */
  bytes: number;
  status: number;
  cached: boolean;
}

export interface DomainTotal {
  domain: string;
  bytes: number;
  count: number;
  thirdParty: boolean;
}

export interface NetInventory {
  pageUrl: string;
  totalBytes: number;
  requestCount: number;
  cachedCount: number;
  failedCount: number;
  heaviest: NetEntry[];
  domains: DomainTotal[];
  byType: { type: string; bytes: number; count: number }[];
  /** Image URL → bytes, so the page can put a size on oversized images. */
  imageBytes: Record<string, number>;
}

interface Pending {
  url: string;
  type: string;
  loaderId: string;
  status: number;
  cached: boolean;
}

interface Tally {
  sawNavigation: boolean;
  pageUrl: string;
  pending: Map<string, Pending>;
  done: NetEntry[];
  failed: number;
}

const MAX_ENTRIES = 3000;
const tallies = new Map<number, Tally>();

function tallyFor(tabId: number): Tally {
  let t = tallies.get(tabId);
  if (!t) tallies.set(tabId, (t = { sawNavigation: false, pageUrl: '', pending: new Map(), done: [], failed: 0 }));
  return t;
}

export function onNetEvent(tabId: number, method: string, params: any): void {
  switch (method) {
    case 'Page.frameNavigated': {
      const frame = params?.frame;
      if (!frame || frame.parentId) return;
      // The main document's own request started before the commit; keep requests from the new loader.
      const old = tallyFor(tabId).pending;
      const pending = new Map([...old].filter(([, p]) => p.loaderId === frame.loaderId));
      tallies.set(tabId, { sawNavigation: true, pageUrl: frame.url, pending, done: [], failed: 0 });
      return;
    }
    case 'Network.requestWillBeSent': {
      const t = tallyFor(tabId);
      if (t.pending.size + t.done.length >= MAX_ENTRIES) return;
      const prev = t.pending.get(params.requestId);
      // Redirects reuse the requestId; follow the new URL.
      t.pending.set(params.requestId, {
        url: params.request?.url ?? '',
        type: params.type ?? prev?.type ?? 'Other',
        loaderId: params.loaderId ?? '',
        status: 0,
        cached: false,
      });
      return;
    }
    case 'Network.requestServedFromCache': {
      const p = tallyFor(tabId).pending.get(params.requestId);
      if (p) p.cached = true;
      return;
    }
    case 'Network.responseReceived': {
      const p = tallyFor(tabId).pending.get(params.requestId);
      if (!p) return;
      const r = params.response ?? {};
      p.status = r.status ?? 0;
      p.type = params.type ?? p.type;
      if (r.fromDiskCache || r.fromServiceWorker || r.fromPrefetchCache) p.cached = true;
      return;
    }
    case 'Network.loadingFinished': {
      const t = tallyFor(tabId);
      const p = t.pending.get(params.requestId);
      if (!p) return;
      t.pending.delete(params.requestId);
      t.done.push({
        url: p.url,
        type: p.type,
        bytes: Math.max(0, params.encodedDataLength ?? 0),
        status: p.status,
        cached: p.cached,
      });
      return;
    }
    case 'Network.loadingFailed': {
      const t = tallyFor(tabId);
      if (t.pending.delete(params.requestId)) t.failed += 1;
      return;
    }
  }
}

/** Null until a full page load has been observed. */
export function getNetInventory(tabId: number): NetInventory | null {
  const t = tallyFor(tabId);
  if (!t.sawNavigation) return null;
  const pageSite = siteOf(hostOf(t.pageUrl));

  const domains = new Map<string, DomainTotal>();
  const types = new Map<string, { type: string; bytes: number; count: number }>();
  const imageBytes: Record<string, number> = {};
  let totalBytes = 0;
  let cachedCount = 0;
  let imageCount = 0;

  for (const e of t.done) {
    totalBytes += e.bytes;
    if (e.cached) cachedCount += 1;
    const host = hostOf(e.url);
    if (host) {
      const d = domains.get(host) ?? { domain: host, bytes: 0, count: 0, thirdParty: siteOf(host) !== pageSite };
      d.bytes += e.bytes;
      d.count += 1;
      domains.set(host, d);
    }
    const ty = types.get(e.type) ?? { type: e.type, bytes: 0, count: 0 };
    ty.bytes += e.bytes;
    ty.count += 1;
    types.set(e.type, ty);
    if (e.type === 'Image' && e.url && !e.url.startsWith('data:') && imageCount++ < 500) imageBytes[e.url] = e.bytes;
  }

  const byBytes = <T extends { bytes: number }>(a: T, b: T) => b.bytes - a.bytes;
  return {
    pageUrl: t.pageUrl,
    totalBytes,
    requestCount: t.done.length,
    cachedCount,
    failedCount: t.failed,
    heaviest: t.done.filter((e) => !e.url.startsWith('data:')).sort(byBytes).slice(0, 10),
    domains: [...domains.values()].sort(byBytes).slice(0, 12),
    byType: [...types.values()].sort(byBytes),
    imageBytes,
  };
}

export function forgetNet(tabId: number) {
  tallies.delete(tabId);
}
