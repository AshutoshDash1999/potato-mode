// Collect page-load metrics in the page with PerformanceObserver, plus the JS
// byte total pushed from the background. Exposed as a tiny external store for React.
import { EMPTY_METRICS, type JsBytes, type PageMetrics } from '~/lib/messages';
import { LONG_TASK_MS } from '~/lib/thresholds';

export interface Report extends PageMetrics {
  /** null = not measured (debugger not attached). */
  js: JsBytes | null;
}

let report: Report = { ...EMPTY_METRICS, js: null };
const listeners = new Set<() => void>();

function update(patch: Partial<Report>) {
  report = { ...report, ...patch };
  listeners.forEach((l) => l());
}

export const metricsStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => report,
};

export function setJsBytes(js: JsBytes | null) {
  update({ js });
}

function observe(type: string, onEntries: (entries: PerformanceEntry[]) => void) {
  try {
    const po = new PerformanceObserver((list) => onEntries(list.getEntries()));
    // buffered: also deliver entries recorded before we started observing.
    po.observe({ type, buffered: true });
  } catch {
    // Entry type not supported in this browser/context.
  }
}

function readNavigation() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!nav) return;
  update({
    domContentLoaded: nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd : report.domContentLoaded,
    loadTime: nav.loadEventEnd > 0 ? nav.loadEventEnd : report.loadTime,
  });
}

let started = false;

/** Start as early as possible (document_start). Safe to call more than once. */
export function startMetrics() {
  if (started) return;
  started = true;

  observe('paint', (entries) => {
    const fcp = entries.find((e) => e.name === 'first-contentful-paint');
    if (fcp) update({ firstContentfulPaint: fcp.startTime });
  });

  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) update({ largestContentfulPaint: last.startTime });
  });

  observe('longtask', (entries) => {
    let { longTaskCount, longestTask, blockedTime } = report;
    for (const e of entries) {
      longTaskCount += 1;
      longestTask = Math.max(longestTask, e.duration);
      blockedTime += Math.max(0, e.duration - LONG_TASK_MS);
    }
    update({ longTaskCount, longestTask, blockedTime });
  });

  observe('navigation', readNavigation);
  // loadEventEnd is only set after the load handlers finish, so read once more just after.
  const afterLoad = () => setTimeout(readNavigation, 0);
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}
