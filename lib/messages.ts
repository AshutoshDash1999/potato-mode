// Typed messages between the background worker and the in-page panel.

import type { CpuPresetId, NetworkPresetId } from './presets';
import type { PanelPos, TabState } from './state';

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
}

export const EMPTY_METRICS: PageMetrics = {
  loadTime: null,
  domContentLoaded: null,
  firstContentfulPaint: null,
  largestContentfulPaint: null,
  longTaskCount: 0,
  longestTask: 0,
  blockedTime: 0,
};

/** Panel → background. Each returns the updated TabState (or null if not applicable). */
export type PanelRequest =
  | { type: 'getState' }
  | { type: 'setNetwork'; network: NetworkPresetId }
  | { type: 'setCpu'; cpu: CpuPresetId }
  | { type: 'setJs'; jsOff: boolean }
  | { type: 'setCss'; cssOff: boolean }
  | { type: 'savePos'; pos: PanelPos }
  | { type: 'deactivate' };

/** Background → panel (content script). */
export type BackgroundEvent =
  | { type: 'mount'; state: TabState }
  | { type: 'unmount' }
  | { type: 'state'; state: TabState }
  | { type: 'jsBytes'; bytes: number; count: number }
  | { type: 'detached' };

export function sendToBackground(msg: PanelRequest): Promise<TabState | null> {
  return browser.runtime.sendMessage(msg);
}

export async function sendToTab(tabId: number, msg: BackgroundEvent): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, msg);
  } catch {
    // No content script there yet (page still loading, or a restricted page).
  }
}
