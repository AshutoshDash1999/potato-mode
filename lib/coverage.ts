// "Which code never ran?" — JS and CSS coverage over one page load, like DevTools' Coverage panel.
// Coverage has to be running before the page loads, so a scan is: start → reload → finish.
import * as cdp from './cdp';

export interface CoverageFile {
  url: string;
  total: number;
  unused: number;
}

export interface CoverageSide {
  total: number;
  unused: number;
  /** Biggest offenders first (by unused bytes). */
  files: CoverageFile[];
}

export interface CoverageResult {
  /** Page the scan ran on. */
  url: string;
  at: number;
  js: CoverageSide;
  css: CoverageSide;
}

interface Scan {
  /** Scripts / stylesheets that belong to the document loaded after the scan's reload. */
  scripts: Map<string, string>;
  sheets: Map<string, { url: string; length: number }>;
}

const scans = new Map<number, Scan>();
const MAX_FILES = 12;

export function isScanning(tabId: number): boolean {
  return scans.has(tabId);
}

export async function startCoverage(tabId: number): Promise<void> {
  scans.set(tabId, { scripts: new Map(), sheets: new Map() });
  // Debugger only tells us which scripts belong to the new page; never let it pause the page.
  await cdp.send(tabId, 'Debugger.enable');
  await cdp.send(tabId, 'Debugger.setSkipAllPauses', { skip: true });
  await cdp.send(tabId, 'Profiler.enable');
  await cdp.send(tabId, 'Profiler.startPreciseCoverage', { callCount: false, detailed: true });
  await cdp.send(tabId, 'DOM.enable');
  await cdp.send(tabId, 'CSS.enable');
  await cdp.send(tabId, 'CSS.startRuleUsageTracking');
}

/** Feed CDP events while a scan is running. */
export function onCoverageEvent(tabId: number, method: string, params: any): void {
  const scan = scans.get(tabId);
  if (!scan) return;
  switch (method) {
    case 'Page.frameNavigated':
      // Anything seen so far was from the old page.
      if (!params?.frame?.parentId) {
        scan.scripts.clear();
        scan.sheets.clear();
      }
      return;
    case 'Debugger.scriptParsed':
      if (params?.url && !params.url.startsWith('chrome-extension:')) scan.scripts.set(params.scriptId, params.url);
      return;
    case 'CSS.styleSheetAdded': {
      const h = params?.header;
      if (h) scan.sheets.set(h.styleSheetId, { url: h.sourceURL || '(inline <style>)', length: h.length ?? 0 });
      return;
    }
  }
}

interface ScriptCoverage {
  scriptId: string;
  url: string;
  functions: { ranges: { startOffset: number; endOffset: number; count: number }[] }[];
}

export async function finishCoverage(tabId: number, pageUrl: string): Promise<CoverageResult | null> {
  const scan = scans.get(tabId);
  scans.delete(tabId);
  if (!scan) return null;
  try {
    const { result } = await cdp.send<{ result: ScriptCoverage[] }>(tabId, 'Profiler.takePreciseCoverage');
    const { ruleUsage } = await cdp.send<{
      ruleUsage: { styleSheetId: string; startOffset: number; endOffset: number; used: boolean }[];
    }>(tabId, 'CSS.stopRuleUsageTracking');
    return {
      url: pageUrl,
      at: Date.now(),
      js: summarize(jsFiles(result, scan, pageUrl)),
      css: summarize(cssFiles(ruleUsage, scan)),
    };
  } finally {
    await stopDomains(tabId);
  }
}

export async function cancelCoverage(tabId: number): Promise<void> {
  if (!scans.delete(tabId)) return;
  await stopDomains(tabId);
}

async function stopDomains(tabId: number) {
  for (const [method, params] of [
    ['Profiler.stopPreciseCoverage'],
    ['Profiler.disable'],
    ['CSS.disable'],
    ['DOM.disable'],
    ['Debugger.disable'],
  ] as [string, Record<string, unknown>?][]) {
    await cdp.send(tabId, method, params).catch(() => {});
  }
}

export function forgetCoverage(tabId: number) {
  scans.delete(tabId);
}

function jsFiles(result: ScriptCoverage[], scan: Scan, pageUrl: string): CoverageFile[] {
  const byUrl = new Map<string, CoverageFile>();
  for (const s of result) {
    if (!scan.scripts.has(s.scriptId)) continue;
    const all = s.functions.flatMap((f) => f.ranges);
    // The top-level function's range spans the whole script.
    const total = all.reduce((max, r) => Math.max(max, r.endOffset), 0);
    if (total === 0) continue;
    // Outer ranges first; inner ranges override them (that's how V8 block coverage nests).
    const used = new Uint8Array(total);
    all
      .slice()
      .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset)
      .forEach((r) => used.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset));
    let usedBytes = 0;
    for (let i = 0; i < total; i++) usedBytes += used[i]!;
    const url = s.url === pageUrl ? '(inline <script>s)' : s.url;
    const f = byUrl.get(url) ?? { url, total: 0, unused: 0 };
    f.total += total;
    f.unused += total - usedBytes;
    byUrl.set(url, f);
  }
  return [...byUrl.values()];
}

function cssFiles(
  ruleUsage: { styleSheetId: string; startOffset: number; endOffset: number; used: boolean }[],
  scan: Scan,
): CoverageFile[] {
  const usedBySheet = new Map<string, Uint8Array>();
  for (const r of ruleUsage) {
    const sheet = scan.sheets.get(r.styleSheetId);
    if (!sheet || !r.used || sheet.length === 0) continue;
    let used = usedBySheet.get(r.styleSheetId);
    if (!used) usedBySheet.set(r.styleSheetId, (used = new Uint8Array(sheet.length)));
    used.fill(1, r.startOffset, Math.min(r.endOffset, sheet.length));
  }
  const byUrl = new Map<string, CoverageFile>();
  for (const [id, sheet] of scan.sheets) {
    if (sheet.length === 0) continue;
    const used = usedBySheet.get(id);
    let usedBytes = 0;
    if (used) for (let i = 0; i < used.length; i++) usedBytes += used[i]!;
    const f = byUrl.get(sheet.url) ?? { url: sheet.url, total: 0, unused: 0 };
    f.total += sheet.length;
    f.unused += sheet.length - usedBytes;
    byUrl.set(sheet.url, f);
  }
  return [...byUrl.values()];
}

function summarize(files: CoverageFile[]): CoverageSide {
  files.sort((a, b) => b.unused - a.unused);
  return {
    total: files.reduce((n, f) => n + f.total, 0),
    unused: files.reduce((n, f) => n + f.unused, 0),
    files: files.slice(0, MAX_FILES),
  };
}
