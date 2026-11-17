import { isAttached, isRestrictedUrl } from '~/lib/cdp';
import { forgetTab, getJsBytes, onCdpEvent } from '~/lib/jsTally';
import { blockJs, cleanupAllJsBlocks, jsPatternFor, unblockJs } from '~/lib/jsBlock';
import { sendToTab, type JsBytes, type PanelRequest } from '~/lib/messages';
import { getPerfCounters, type PerfCounters } from '~/lib/perfCounters';
import { applyThrottles, attachAndApply, resetAndDetach, wasDetachedByUs } from '~/lib/session';
import {
  clearTabState,
  getJsBlocks,
  getTabState,
  setTabState,
  type PageSnapshot,
  type TabState,
} from '~/lib/state';

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    void toggle(tab.id, tab.url).catch((err) => console.error('[potato] toggle failed', err));
  });

  browser.runtime.onMessage.addListener((msg: PanelRequest, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (tabId == null) return;
    handleRequest(tabId, msg).then(sendResponse, (err) => {
      console.error('[potato] request failed', msg, err);
      sendResponse(null);
    });
    return true; // keep the channel open for the async response
  });

  browser.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source.tabId;
    if (tabId == null) return;
    if (onCdpEvent(tabId, method, params)) pushJsBytes(tabId);
  });

  browser.debugger.onDetach.addListener((source, reason) => {
    const tabId = source.tabId;
    if (tabId == null || wasDetachedByUs(tabId)) return;
    void onUnexpectedDetach(tabId, reason);
  });

  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    void onTabUpdated(tabId, info, tab).catch((err) => console.warn('[potato] tab update', err));
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void unblockJs(tabId);
    void clearTabState(tabId);
    forgetTab(tabId);
  });

  // Tabs from a previous session are gone, so any JS block left behind is stale.
  browser.runtime.onStartup.addListener(() => void cleanupAllJsBlocks());
  browser.runtime.onInstalled.addListener(() => void cleanupAllJsBlocks());
});

async function onTabUpdated(tabId: number, info: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) {
  const state = await getTabState(tabId);
  if (!state.active) return;

  // JS is blocked per site. If the tab moved to a different site, release the
  // old block and show JS as on, rather than pretend it's still off.
  if (info.url && state.jsOff && jsPatternFor(info.url) !== (await getJsBlocks())[tabId]?.pattern) {
    await unblockJs(tabId);
    await setTabState(tabId, { jsOff: false, jsSnapshot: null });
  }

  // Tab-specific badges can be reset by navigation; re-assert while active.
  if (info.status === 'loading') await updateBadge(tabId, await getTabState(tabId));

  // Make sure the panel comes back after reloads, even if the manifest
  // content script didn't run (it injects and mounts itself).
  if (info.status === 'complete' && !isRestrictedUrl(tab.url)) await ensureContentScript(tabId).catch(() => {});
}

async function toggle(tabId: number, url: string | undefined) {
  const state = await getTabState(tabId);
  if (state.active) {
    await deactivate(tabId);
    return;
  }

  if (isRestrictedUrl(url)) {
    await flashBadge(tabId, '✋', "Potato Mode can't run on Chrome's own pages. Try a normal website.");
    return;
  }

  let next = await setTabState(tabId, { active: true, unplugged: false });
  try {
    await attachAndApply(tabId, next);
  } catch (err) {
    console.warn('[potato] could not attach debugger', err);
    next = await setTabState(tabId, { unplugged: true });
  }
  await updateBadge(tabId, next);

  if (await ensureContentScript(tabId)) {
    await sendToTab(tabId, { type: 'mount', state: next });
  }
  // If we had to inject the script, it reads the state and mounts itself.
}

async function deactivate(tabId: number): Promise<TabState> {
  await resetAndDetach(tabId);
  forgetTab(tabId);
  const hadJsOff = await unblockJs(tabId);
  const next = await setTabState(tabId, {
    active: false,
    unplugged: false,
    jsOff: false,
    jsSnapshot: null,
    cssOff: false,
  });
  await updateBadge(tabId, next);
  await sendToTab(tabId, { type: 'unmount' });
  // Bring the page's JavaScript back right away instead of leaving a broken page.
  if (hadJsOff) scheduleReload(tabId);
  return next;
}

async function setJs(tabId: number, jsOff: boolean, snapshot?: PageSnapshot): Promise<TabState> {
  if (jsOff) {
    const tab = await browser.tabs.get(tabId);
    const pattern = jsPatternFor(tab.url);
    if (!pattern) return getTabState(tabId);
    await blockJs(tabId, { pattern, incognito: tab.incognito });
  } else {
    await unblockJs(tabId);
  }
  const next = await setTabState(tabId, { jsOff, jsSnapshot: jsOff ? (snapshot ?? null) : null });
  // The content setting only applies to new page loads.
  scheduleReload(tabId);
  return next;
}

/**
 * Hard-reload just after replying, so the panel gets its answer before the page goes away.
 * Bypassing the cache makes every reload we trigger behave like a first visit.
 */
function scheduleReload(tabId: number) {
  setTimeout(() => void browser.tabs.reload(tabId, { bypassCache: true }).catch(() => {}), 50);
}

/** Chrome dropped our debugger: user pressed Cancel on the yellow bar, or the page became undebuggable. */
async function onUnexpectedDetach(tabId: number, reason: string) {
  const state = await getTabState(tabId);
  if (!state.active) return;
  if (reason === 'target_closed') {
    await clearTabState(tabId);
    return;
  }
  const next = await setTabState(tabId, { unplugged: true });
  await updateBadge(tabId, next);
  await sendToTab(tabId, { type: 'state', state: next });
}

/**
 * Returns true if a content script was already listening.
 * Otherwise injects one (e.g. tabs opened before the extension was installed or reloaded).
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    if (await browser.tabs.sendMessage(tabId, { type: 'ping' })) return true;
  } catch {
    // No listener; inject below.
  }
  await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
  return false;
}

type Reply = TabState | JsBytes | PerfCounters | null;

async function handleRequest(tabId: number, msg: PanelRequest): Promise<Reply> {
  switch (msg.type) {
    case 'getJsBytes':
      return (await isAttached(tabId)) ? getJsBytes(tabId) : null;
    case 'getPerfCounters':
      return (await isAttached(tabId)) ? getPerfCounters(tabId) : null;
    case 'setDevUi': {
      const patch: Partial<TabState> = {};
      if (msg.devOpen != null) patch.devOpen = msg.devOpen;
      if (msg.devTab != null) patch.devTab = msg.devTab;
      return setTabState(tabId, patch);
    }
    case 'getState':
      return getTabState(tabId);
    case 'reload':
      scheduleReload(tabId);
      return getTabState(tabId);
    case 'savePos':
      return setTabState(tabId, { panelPos: msg.pos });
    case 'deactivate':
      return deactivate(tabId);
    case 'replug':
      return replug(tabId);
    case 'setNetwork':
      return updateThrottles(tabId, { network: msg.network });
    case 'setCpu':
      return updateThrottles(tabId, { cpu: msg.cpu });
    case 'setJs':
      return setJs(tabId, msg.jsOff, msg.snapshot);
    case 'setCss':
      // Stripping happens in the page; we only remember it so it survives reloads.
      return setTabState(tabId, { cssOff: msg.cssOff });
    default:
      return getTabState(tabId);
  }
}

async function replug(tabId: number): Promise<TabState> {
  let next = await setTabState(tabId, { unplugged: false });
  try {
    await attachAndApply(tabId, next);
  } catch (err) {
    console.warn('[potato] re-attach failed', err);
    next = await setTabState(tabId, { unplugged: true });
  }
  await updateBadge(tabId, next);
  return next;
}

async function updateThrottles(tabId: number, patch: Partial<TabState>): Promise<TabState> {
  const next = await setTabState(tabId, patch);
  if (next.active && !next.unplugged) {
    try {
      await applyThrottles(tabId, next);
    } catch {
      // Session went away underneath us; reconnect and apply.
      await attachAndApply(tabId, next);
    }
  }
  return next;
}

async function updateBadge(tabId: number, state: TabState) {
  const text = !state.active ? '' : state.unplugged ? '!' : 'ON';
  await browser.action.setBadgeText({ tabId, text });
  await browser.action.setBadgeBackgroundColor({ tabId, color: state.unplugged ? '#ff7a6b' : '#2b2118' });
  await browser.action.setBadgeTextColor?.({ tabId, color: '#fff1c9' });
  await browser.action.setTitle({
    tabId,
    title: state.active ? 'Potato Mode is on (click to turn off)' : 'Toggle Potato Mode',
  });
}

async function flashBadge(tabId: number, text: string, title: string) {
  await browser.action.setBadgeText({ tabId, text });
  await browser.action.setBadgeBackgroundColor({ tabId, color: '#ff7a6b' });
  await browser.action.setTitle({ tabId, title });
  setTimeout(() => {
    void browser.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    void browser.action.setTitle({ tabId, title: 'Toggle Potato Mode' }).catch(() => {});
  }, 3000);
}

/** Send the running JS total to the panel, at most every 250 ms per tab. */
const pushTimers = new Map<number, ReturnType<typeof setTimeout>>();
function pushJsBytes(tabId: number) {
  if (pushTimers.has(tabId)) return;
  pushTimers.set(
    tabId,
    setTimeout(() => {
      pushTimers.delete(tabId);
      const js = getJsBytes(tabId);
      if (js) void sendToTab(tabId, { type: 'jsBytes', ...js });
    }, 250),
  );
}
