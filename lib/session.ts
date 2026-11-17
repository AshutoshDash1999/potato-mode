// Owns the chrome.debugger session for each tab and applies throttling to it.
import * as cdp from './cdp';
import { networkConditions } from './presets';
import type { TabState } from './state';

/** Tabs we are detaching ourselves, so onDetach can tell them apart from the user pressing Cancel. */
const detachingByUs = new Set<number>();

/** Attach (if needed), enable domains and apply every throttle in `state`. */
export async function attachAndApply(tabId: number, state: TabState): Promise<void> {
  if (!(await cdp.isAttached(tabId))) {
    await cdp.attach(tabId);
    await cdp.send(tabId, 'Network.enable');
    await cdp.send(tabId, 'Page.enable');
  }
  await applyThrottles(tabId, state);
}

export async function applyThrottles(tabId: number, state: TabState): Promise<void> {
  await cdp.send(tabId, 'Network.emulateNetworkConditions', networkConditions(state.network));
  // Rate is a slowdown factor relative to this machine (1 = no throttling).
  await cdp.send(tabId, 'Emulation.setCPUThrottlingRate', { rate: state.cpu });
  await cdp.send(tabId, 'Network.setCacheDisabled', { cacheDisabled: state.cacheOff });
}

/** Clear all throttling and detach. Safe to call when not attached. */
export async function resetAndDetach(tabId: number): Promise<void> {
  if (!(await cdp.isAttached(tabId))) return;
  detachingByUs.add(tabId);
  try {
    await cdp.send(tabId, 'Network.emulateNetworkConditions', networkConditions('normal')).catch(() => {});
    await cdp.send(tabId, 'Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await cdp.send(tabId, 'Network.setCacheDisabled', { cacheDisabled: false }).catch(() => {});
    await cdp.detach(tabId);
  } finally {
    // onDetach fires asynchronously after detach resolves; give it a moment.
    setTimeout(() => detachingByUs.delete(tabId), 1000);
  }
}

export function wasDetachedByUs(tabId: number): boolean {
  return detachingByUs.has(tabId);
}
