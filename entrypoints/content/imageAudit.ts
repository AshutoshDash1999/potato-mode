// Find <img>s whose files have far more pixels than they're shown at,
// or that were downloaded but aren't shown at all.

export interface ImageIssue {
  el: HTMLImageElement;
  url: string;
  natural: { w: number; h: number };
  /** Device pixels it's displayed at; null when not shown. */
  shown: { w: number; h: number } | null;
  /** Natural pixels ÷ shown pixels (Infinity when not shown). */
  ratio: number;
  /** Bytes over the wire, when the debugger saw the request. */
  bytes: number | null;
  /** Rough bytes that could be saved by serving the right size. */
  wasted: number | null;
}

const OVERSIZE_RATIO = 1.5;
const MIN_NATURAL_PX = 64 * 64;

export function auditImages(imageBytes: Record<string, number> = {}): ImageIssue[] {
  const dpr = window.devicePixelRatio || 1;
  const issues: ImageIssue[] = [];

  for (const img of Array.from(document.images)) {
    if (!img.complete || img.naturalWidth === 0) continue;
    const url = img.currentSrc || img.src;
    if (!url || url.startsWith('data:')) continue;
    const natural = { w: img.naturalWidth, h: img.naturalHeight };
    const naturalPx = natural.w * natural.h;
    if (naturalPx < MIN_NATURAL_PX) continue;

    const r = img.getBoundingClientRect();
    const visible = r.width >= 2 && r.height >= 2 && getComputedStyle(img).visibility !== 'hidden';
    const shown = visible ? { w: Math.round(r.width * dpr), h: Math.round(r.height * dpr) } : null;
    const ratio = shown ? naturalPx / (shown.w * shown.h) : Infinity;
    if (ratio < OVERSIZE_RATIO) continue;
    // Lazy images that never came into view didn't cost anything; skip hidden ones with loading=lazy.
    if (!shown && img.loading === 'lazy') continue;

    const bytes = imageBytes[url] ?? imageBytes[img.src] ?? null;
    const wasted = bytes == null ? null : Math.round(Number.isFinite(ratio) ? bytes * (1 - 1 / ratio) : bytes);
    issues.push({ el: img, url, natural, shown, ratio, bytes, wasted });
  }

  return issues
    .sort((a, b) => (b.wasted ?? 0) - (a.wasted ?? 0) || b.ratio - a.ratio)
    .slice(0, 12);
}

export interface BlockingResource {
  url: string;
  ms: number;
}

/** Stylesheets and scripts that held up the first render. */
export function renderBlocking(): BlockingResource[] {
  return (performance.getEntriesByType('resource') as (PerformanceResourceTiming & { renderBlockingStatus?: string })[])
    .filter((e) => e.renderBlockingStatus === 'blocking')
    .map((e) => ({ url: e.name, ms: e.responseEnd - e.startTime }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10);
}
