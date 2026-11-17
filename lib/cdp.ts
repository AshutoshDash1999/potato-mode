// Thin promise wrapper around chrome.debugger for one tab.

export const CDP_VERSION = '1.3';

export const target = (tabId: number) => ({ tabId });

export async function attach(tabId: number): Promise<void> {
  await browser.debugger.attach(target(tabId), CDP_VERSION);
}

export async function detach(tabId: number): Promise<void> {
  try {
    await browser.debugger.detach(target(tabId));
  } catch {
    // Already detached (tab closed or user cancelled); nothing to do.
  }
}

export async function isAttached(tabId: number): Promise<boolean> {
  const targets = await browser.debugger.getTargets();
  return targets.some((t) => t.tabId === tabId && t.attached);
}

export async function send<T = unknown>(
  tabId: number,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return (await browser.debugger.sendCommand(target(tabId), method, params)) as T;
}

/** URLs Chrome never lets extensions debug or script. */
export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    /^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url) ||
    /^https:\/\/chrome(webstore)?\.google\.com\/(webstore)?/i.test(url)
  );
}
