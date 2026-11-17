// Typed messages between the background worker and the in-page panel.

import type { CpuPresetId, NetworkPresetId } from './presets';
import type { NetInventory } from './netTally';
import type { PerfCounters } from './perfCounters';
import type { DevTab, PageSnapshot, PanelPos, TabState } from './state';

export interface PageMetrics {
  /** ms from navigation start to the load event; null until it fires. */
  loadTime: number | null;
  domContentLoaded: number | null;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  longTaskCount: number;
  longestTask: number;
  /** Sum over long tasks of (duration - 50 ms). */
  blockedTime: number;
  /** Time to first byte of the main document. */
  ttfb: number | null;
  /** Cumulative Layout Shift (worst session window). */
  cls: number | null;
  /** Interaction to Next Paint; null until the first interaction. */
  inp: number | null;
  interactionCount: number;
  /** Blocked time (beyond 50 ms per task) after first contentful paint. */
  totalBlockingTime: number;
}

export const EMPTY_METRICS: PageMetrics = {
  loadTime: null,
  domContentLoaded: null,
  firstContentfulPaint: null,
  largestContentfulPaint: null,
  longTaskCount: 0,
  longestTask: 0,
  blockedTime: 0,
  ttfb: null,
  cls: null,
  inp: null,
  interactionCount: 0,
  totalBlockingTime: 0,
};

/** Panel → background. Each returns the updated TabState (or null if not applicable). */
export type PanelRequest =
  | { type: 'getState' }
  | { type: 'setNetwork'; network: NetworkPresetId }
  | { type: 'setCpu'; cpu: CpuPresetId }
  | { type: 'setJs'; jsOff: boolean; snapshot?: PageSnapshot }
  | { type: 'setCss'; cssOff: boolean }
  | { type: 'savePos'; pos: PanelPos }
  | { type: 'replug' }
  | { type: 'reload' }
  | { type: 'getJsBytes' }
  | { type: 'deactivate' }
  | { type: 'setDevUi'; devOpen?: boolean; devTab?: DevTab }
  | { type: 'startCoverage' }
  | { type: 'finishCoverage' }
  | { type: 'getPerfCounters' }
  | { type: 'getNetInventory' };

/** Background → panel (content script). */
export type BackgroundEvent =
  | { type: 'ping' }
  | { type: 'mount'; state: TabState }
  | { type: 'unmount' }
  | { type: 'state'; state: TabState }
  | { type: 'jsBytes'; bytes: number; count: number }
  | { type: 'detached' };

/** Requests answered with something other than TabState. */
type InfoRequest = Extract<
  PanelRequest,
  { type: 'getJsBytes' | 'getPerfCounters' | 'getNetInventory' }
>;

/** Requests answered with the tab's updated TabState. */
export type StateRequest = Exclude<PanelRequest, InfoRequest>;

export function sendToBackground(msg: StateRequest): Promise<TabState | null> {
  return browser.runtime.sendMessage(msg);
}

export interface JsBytes {
  /** Compressed bytes over the wire for script responses on this page load. */
  bytes: number;
  count: number;
}

/** Null when the debugger isn't attached (nothing is being counted). */
export function requestJsBytes(): Promise<JsBytes | null> {
  return browser.runtime.sendMessage({ type: 'getJsBytes' } satisfies PanelRequest);
}

export async function sendToTab(tabId: number, msg: BackgroundEvent): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, msg);
  } catch {
    // No content script there yet (page still loading, or a restricted page).
  }
}

/** Null when the debugger isn't attached. */
export function requestPerfCounters(): Promise<PerfCounters | null> {
  return browser.runtime.sendMessage({ type: 'getPerfCounters' } satisfies PanelRequest);
}

/** Null until a full page load has been watched with the debugger attached. */
export function requestNetInventory(): Promise<NetInventory | null> {
  return browser.runtime.sendMessage({ type: 'getNetInventory' } satisfies PanelRequest);
}
