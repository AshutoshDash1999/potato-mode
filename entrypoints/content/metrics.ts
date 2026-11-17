// Collect page-load metrics in the page with PerformanceObserver, plus the JS
// byte total pushed from the background. Exposed as a tiny external store for React.
import { EMPTY_METRICS, type JsBytes, type PageMetrics } from '~/lib/messages';
import { LONG_TASK_MS } from '~/lib/thresholds';

export interface Report extends PageMetrics {
  /** null = not measured (debugger not attached). */
  js: JsBytes | null;
  /** Element behind the latest LCP candidate, if it's still in the DOM. */
  lcpElement: Element | null;
  /** Elements that moved in the worst layout-shift session window. */
  shiftElements: { el: Element; value: number }[];
}

let report: Report = { ...EMPTY_METRICS, js: null, lcpElement: null, shiftElements: [] };
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

function observe(type: string, onEntries: (entries: PerformanceEntry[]) => void, extra?: Record<string, unknown>) {
  try {
    const po = new PerformanceObserver((list) => onEntries(list.getEntries()));
    // buffered: also deliver entries recorded before we started observing.
    po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
  } catch {
    // Entry type not supported in this browser/context.
  }
}

function readNavigation() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!nav) return;
  update({
    ttfb: nav.responseStart > 0 ? nav.responseStart : report.ttfb,
    domContentLoaded: nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd : report.domContentLoaded,
    loadTime: nav.loadEventEnd > 0 ? nav.loadEventEnd : report.loadTime,
  });
}

// --- Layout shifts: CLS is the worst "session window" (shifts < 1 s apart, window ≤ 5 s). ---

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: { node?: Node | null }[];
}

interface ShiftWindow {
  start: number;
  last: number;
  value: number;
  shifts: LayoutShift[];
}

let shiftWindow: ShiftWindow | null = null;
let worstWindow: ShiftWindow | null = null;

function onLayoutShift(entries: PerformanceEntry[]) {
  for (const e of entries as LayoutShift[]) {
    if (e.hadRecentInput) continue;
    const w = shiftWindow;
    if (w && e.startTime - w.last < 1000 && e.startTime - w.start < 5000) {
      w.last = e.startTime;
      w.value += e.value;
      w.shifts.push(e);
    } else {
      shiftWindow = { start: e.startTime, last: e.startTime, value: e.value, shifts: [e] };
    }
    if (!worstWindow || shiftWindow!.value > worstWindow.value) worstWindow = shiftWindow;
  }
  if (!worstWindow) return;
  update({ cls: worstWindow.value, shiftElements: shiftElementsOf(worstWindow) });
}

function shiftElementsOf(w: ShiftWindow) {
  const byEl = new Map<Element, number>();
  for (const s of w.shifts) {
    for (const src of s.sources ?? []) {
      const el = src.node instanceof Element ? src.node : src.node?.parentElement;
      if (el) byEl.set(el, (byEl.get(el) ?? 0) + s.value);
    }
  }
  return [...byEl].map(([el, value]) => ({ el, value })).sort((a, b) => b.value - a.value).slice(0, 8);
}

// --- Interactions: INP is the slowest interaction (98th percentile once there are 50+). ---

interface EventTiming extends PerformanceEntry {
  interactionId?: number;
}

const interactions = new Map<number, number>();

function onEvents(entries: PerformanceEntry[]) {
  let changed = false;
  for (const e of entries as EventTiming[]) {
    if (!e.interactionId) continue;
    const prev = interactions.get(e.interactionId) ?? 0;
    if (e.duration > prev) {
      interactions.set(e.interactionId, e.duration);
      changed = true;
    }
  }
  if (!changed) return;
  const sorted = [...interactions.values()].sort((a, b) => b - a);
  // Skip one worst interaction per 50, like the web-vitals library.
  const inp = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 50))];
  update({ inp, interactionCount: sorted.length });
}

const longTasks: PerformanceEntry[] = [];
let started = false;

/** Start as early as possible (document_start). Safe to call more than once. */
export function startMetrics() {
  if (started) return;
  started = true;

  observe('paint', (entries) => {
    const fcp = entries.find((e) => e.name === 'first-contentful-paint');
    if (!fcp) return;
    update({ firstContentfulPaint: fcp.startTime, totalBlockingTime: blockingAfter(fcp.startTime) });
  });

  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1] as (PerformanceEntry & { element?: Element | null }) | undefined;
    if (last) update({ largestContentfulPaint: last.startTime, lcpElement: last.element ?? null });
  });

  observe('longtask', (entries) => {
    let { longTaskCount, longestTask, blockedTime } = report;
    for (const e of entries) {
      longTasks.push(e);
      longTaskCount += 1;
      longestTask = Math.max(longestTask, e.duration);
      blockedTime += Math.max(0, e.duration - LONG_TASK_MS);
    }
    const fcp = report.firstContentfulPaint;
    update({
      longTaskCount,
      longestTask,
      blockedTime,
      totalBlockingTime: fcp == null ? report.totalBlockingTime : blockingAfter(fcp),
    });
  });

  observe('layout-shift', onLayoutShift);
  observe('event', onEvents, { durationThreshold: 16 });
  // First input isn't always reported as an "event" entry on older Chrome.
  observe('first-input', onEvents);

  observe('navigation', readNavigation);
  // loadEventEnd is only set after the load handlers finish, so read once more just after.
  const afterLoad = () => setTimeout(readNavigation, 0);
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}

/** Total Blocking Time: time beyond 50 ms in long tasks that start after FCP. */
function blockingAfter(fcp: number): number {
  let sum = 0;
  for (const t of longTasks) if (t.startTime >= fcp) sum += Math.max(0, t.duration - LONG_TASK_MS);
  return sum;
}
