import { isRestrictedUrl } from '~/lib/cdp';
import { sendToTab, type PanelRequest } from '~/lib/messages';
import { applyThrottles, attachAndApply, resetAndDetach, wasDetachedByUs } from '~/lib/session';
import { clearTabState, getTabState, setTabState, type TabState } from '~/lib/state';

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

  browser.debugger.onDetach.addListener((source, reason) => {
    const tabId = source.tabId;
    if (tabId == null || wasDetachedByUs(tabId)) return;
    void onUnexpectedDetach(tabId, reason);
  });

  // Tab-specific badges can be reset by navigation; re-assert while active.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'loading') return;
    void getTabState(tabId).then((s) => {
      if (s.active) void updateBadge(tabId, s);
    });
  });

  browser.tabs.onRemoved.addListener((tabId) => void clearTabState(tabId));
});

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
  const next = await setTabState(tabId, { active: false, unplugged: false });
  await updateBadge(tabId, next);
  await sendToTab(tabId, { type: 'unmount' });
  return next;
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

async function handleRequest(tabId: number, msg: PanelRequest): Promise<TabState | null> {
  switch (msg.type) {
    case 'getState':
      return getTabState(tabId);
    case 'savePos':
      return setTabState(tabId, { panelPos: msg.pos });
    case 'deactivate':
      return deactivate(tabId);
    case 'replug':
      return replug(tabId);
    case 'setNetwork':
      return updateThrottles(tabId, { network: msg.network });
    default:
      // CPU, JS and CSS controls arrive in later steps.
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
