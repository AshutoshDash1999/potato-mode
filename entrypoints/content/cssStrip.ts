// Reversibly strip a page's CSS: stylesheets, <style> blocks, constructed
// (adopted) stylesheets and inline style attributes. Our own panel lives in a
// shadow root, so document-level queries never touch it.
//
// Known limit: styles inside the page's own web-component shadow roots stay.

const OUR_HOST = 'potato-mode-panel';

export interface CssStripStats {
  sheets: number;
  inlineStyles: number;
}

let active = false;
let observer: MutationObserver | null = null;
/** Sheets we disabled (and so must re-enable). */
const disabledSheets = new Set<CSSStyleSheet>();
/** Original inline style text for each element we cleared. */
const inlineStyles = new Map<Element, string>();
let savedAdopted: CSSStyleSheet[] | null = null;

function disableSheet(sheet: CSSStyleSheet | null) {
  if (!sheet || sheet.disabled || disabledSheets.has(sheet)) return;
  sheet.disabled = true;
  disabledSheets.add(sheet);
}

function stripElementSheet(el: Element) {
  if (el instanceof HTMLStyleElement || el instanceof HTMLLinkElement) {
    disableSheet(el.sheet);
    // A <link> that's still downloading has no sheet yet; catch it when it loads.
    if (el instanceof HTMLLinkElement && !el.sheet && /stylesheet/i.test(el.rel)) {
      el.addEventListener('load', () => active && disableSheet(el.sheet), { once: true });
    }
  } else if (el instanceof SVGStyleElement) {
    disableSheet(el.sheet);
  }
}

function stripInline(el: Element) {
  if (el.localName === OUR_HOST) return;
  const style = el.getAttribute('style');
  if (style == null) return;
  if (!inlineStyles.has(el)) inlineStyles.set(el, style);
  el.removeAttribute('style');
}

function stripTree(root: ParentNode) {
  root.querySelectorAll('style, link[rel~="stylesheet" i]').forEach(stripElementSheet);
  root.querySelectorAll('[style]').forEach(stripInline);
}

export function stripCss(): CssStripStats {
  if (!active) {
    active = true;

    // Covers <link>, <style>, and @import'ed children (disabled with their parent).
    for (const sheet of Array.from(document.styleSheets)) disableSheet(sheet);
    stripTree(document);
    if (document.documentElement) stripInline(document.documentElement);

    try {
      if (document.adoptedStyleSheets.length) {
        savedAdopted = [...document.adoptedStyleSheets];
        document.adoptedStyleSheets = [];
      }
    } catch {
      // Not supported or not writable from this world; skip.
    }

    // Keep stripping styles the page adds later (SPAs, lazy-loaded CSS, JS animations).
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') {
          stripInline(r.target as Element);
          continue;
        }
        r.addedNodes.forEach((node) => {
          if (!(node instanceof Element) || node.localName === OUR_HOST) return;
          stripElementSheet(node);
          stripInline(node);
          stripTree(node);
        });
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  }
  return stats();
}

export function restoreCss(): void {
  if (!active) return;
  active = false;
  observer?.disconnect();
  observer = null;

  disabledSheets.forEach((sheet) => (sheet.disabled = false));
  disabledSheets.clear();

  inlineStyles.forEach((style, el) => {
    // Restores the value from before stripping. Inline styles the page set while
    // stripped were removed too, so those changes are lost (usually re-applied by the page).
    if (el.isConnected) el.setAttribute('style', style);
  });
  inlineStyles.clear();

  if (savedAdopted) {
    try {
      document.adoptedStyleSheets = savedAdopted;
    } catch {
      // ignore
    }
    savedAdopted = null;
  }
}

export function stats(): CssStripStats {
  return { sheets: disabledSheets.size, inlineStyles: inlineStyles.size };
}
