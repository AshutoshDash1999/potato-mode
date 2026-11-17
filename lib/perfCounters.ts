// Runtime counters from CDP's Performance domain: heap, DOM nodes, layouts, style recalcs.
import * as cdp from './cdp';

export interface PerfCounters {
  /** Bytes. */
  heapUsed: number;
  heapTotal: number;
  /** All DOM nodes, including text nodes. */
  nodes: number;
  listeners: number;
  documents: number;
  frames: number;
  layoutCount: number;
  recalcStyleCount: number;
  /** Milliseconds of main-thread time since the page started. */
  layoutMs: number;
  recalcStyleMs: number;
  scriptMs: number;
  taskMs: number;
}

export async function getPerfCounters(tabId: number): Promise<PerfCounters> {
  // Enabling twice is harmless (it errors on some Chrome versions, so ignore that).
  await cdp.send(tabId, 'Performance.enable').catch(() => {});
  const { metrics } = await cdp.send<{ metrics: { name: string; value: number }[] }>(tabId, 'Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const ms = (s: number | undefined) => Math.round((s ?? 0) * 1000);
  return {
    heapUsed: m.JSHeapUsedSize ?? 0,
    heapTotal: m.JSHeapTotalSize ?? 0,
    nodes: m.Nodes ?? 0,
    listeners: m.JSEventListeners ?? 0,
    documents: m.Documents ?? 0,
    frames: m.Frames ?? 0,
    layoutCount: m.LayoutCount ?? 0,
    recalcStyleCount: m.RecalcStyleCount ?? 0,
    layoutMs: ms(m.LayoutDuration),
    recalcStyleMs: ms(m.RecalcStyleDuration),
    scriptMs: ms(m.ScriptDuration),
    taskMs: ms(m.TaskDuration),
  };
}
