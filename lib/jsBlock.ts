// Switch JavaScript off for a site using chrome.contentSettings, and always undo it.
//
// contentSettings.javascript.clear() removes *every* rule this extension set,
// so to unblock one site we clear everything and re-apply the remaining blocks.
// The list of blocks lives in storage.local, so a crash or browser restart
// can't leave a site blocked forever (see cleanupAllJsBlocks).
import { clearJsBlocks, getJsBlocks, setJsBlock, type JsBlock } from './state';

/** contentSettings pattern for a page's site, or null for non-web pages. */
export function jsPatternFor(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

const scopeFor = (b: JsBlock) => (b.incognito ? 'incognito_session_only' : 'regular');

async function apply(block: JsBlock) {
  await browser.contentSettings.javascript.set({
    primaryPattern: block.pattern,
    setting: 'block',
    scope: scopeFor(block),
  });
}

export async function blockJs(tabId: number, block: JsBlock): Promise<void> {
  await setJsBlock(tabId, block);
  await apply(block);
}

export async function unblockJs(tabId: number): Promise<boolean> {
  const before = await getJsBlocks();
  if (!before[tabId]) return false;
  const remaining = await setJsBlock(tabId, null);
  await browser.contentSettings.javascript.clear({ scope: 'regular' });
  await browser.contentSettings.javascript.clear({ scope: 'incognito_session_only' }).catch(() => {
    // Fails when the extension isn't allowed in incognito; nothing to clear then.
  });
  for (const block of Object.values(remaining)) await apply(block);
  return true;
}

/** On browser start or extension install/update: no tab from before survives, so drop every block. */
export async function cleanupAllJsBlocks(): Promise<void> {
  await browser.contentSettings.javascript.clear({ scope: 'regular' });
  await clearJsBlocks();
}
