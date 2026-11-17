// Per-tab Potato Mode state, kept in storage.session so it survives
// service-worker restarts but is cleared when the browser closes.

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
}

export const DEFAULT_STATE: TabState = {
  active: false,
  network: 'normal',
  cpu: 1,
  jsOff: false,
  cssOff: false,
  panelPos: null,
  unplugged: false,
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

// Origins where we blocked JavaScript via contentSettings, so we can always undo it.
const JS_BLOCKED_KEY = 'jsBlockedOrigins';

export async function getJsBlockedOrigins(): Promise<Record<number, string>> {
  const res = await browser.storage.local.get(JS_BLOCKED_KEY);
  return (res[JS_BLOCKED_KEY] as Record<number, string> | undefined) ?? {};
}

export async function setJsBlockedOrigin(tabId: number, origin: string | null): Promise<void> {
  const all = await getJsBlockedOrigins();
  if (origin) all[tabId] = origin;
  else delete all[tabId];
  await browser.storage.local.set({ [JS_BLOCKED_KEY]: all });
}
