// Per-tab Potato Mode state, kept in storage.session so it survives
// service-worker restarts but is cleared when the browser closes.

import type { CoverageResult } from './coverage';
import type { CpuPresetId, NetworkPresetId } from './presets';

export interface PanelPos {
  x: number;
  y: number;
  minimized: boolean;
}

export interface TabState {
  active: boolean;
  network: NetworkPresetId;
  cpu: CpuPresetId;
  jsOff: boolean;
  cssOff: boolean;
  panelPos: PanelPos | null;
  /** Set when Chrome detached the debugger (e.g. user hit "Cancel" on the bar). */
  unplugged: boolean;
  /** How the page looked with JavaScript on, taken just before switching it off. */
  jsSnapshot: PageSnapshot | null;
  /** HTTP cache switched off for this tab (every load is a cold load). */
  cacheOff: boolean;
  /** A coverage scan is armed; the next page load finishes it. */
  coveragePending: boolean;
  /** Last unused-code scan for this tab. */
  coverage: CoverageResult | null;
  /** Which side tab the panel shows, remembered across reloads. */
  panelTab: PanelTab;
}

export type PanelTab = 'slow' | 'tricks' | 'report' | 'vitals' | 'runtime' | 'unused' | 'weight' | 'data';

export interface PageSnapshot {
  /** Length of visible text in <body>, whitespace collapsed. */
  textLength: number;
  elementCount: number;
  imageCount: number;
  url: string;
}

export const DEFAULT_STATE: TabState = {
  active: false,
  network: 'normal',
  cpu: 1,
  jsOff: false,
  cssOff: false,
  panelPos: null,
  unplugged: false,
  jsSnapshot: null,
  cacheOff: false,
  coveragePending: false,
  coverage: null,
  panelTab: 'slow',
};

const key = (tabId: number) => `tab:${tabId}`;

export async function getTabState(tabId: number): Promise<TabState> {
  const k = key(tabId);
  const res = await browser.storage.session.get(k);
  return { ...DEFAULT_STATE, ...(res[k] as Partial<TabState> | undefined) };
}

export async function setTabState(tabId: number, patch: Partial<TabState>): Promise<TabState> {
  const next = { ...(await getTabState(tabId)), ...patch };
  await browser.storage.session.set({ [key(tabId)]: next });
  return next;
}

export async function clearTabState(tabId: number): Promise<void> {
  await browser.storage.session.remove(key(tabId));
}

// Sites where we blocked JavaScript via contentSettings, keyed by tabId,
// kept in storage.local so we can always undo it, even after a crash.
export interface JsBlock {
  /** contentSettings pattern, e.g. "https://example.com/*". */
  pattern: string;
  incognito: boolean;
}

const JS_BLOCKED_KEY = 'jsBlocks';

export async function getJsBlocks(): Promise<Record<number, JsBlock>> {
  const res = await browser.storage.local.get(JS_BLOCKED_KEY);
  return (res[JS_BLOCKED_KEY] as Record<number, JsBlock> | undefined) ?? {};
}

export async function setJsBlock(tabId: number, block: JsBlock | null): Promise<Record<number, JsBlock>> {
  const all = await getJsBlocks();
  if (block) all[tabId] = block;
  else delete all[tabId];
  await browser.storage.local.set({ [JS_BLOCKED_KEY]: all });
  return all;
}

export async function clearJsBlocks(): Promise<void> {
  await browser.storage.local.remove(JS_BLOCKED_KEY);
}
