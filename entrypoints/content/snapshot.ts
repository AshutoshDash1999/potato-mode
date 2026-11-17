// Compare the page with JavaScript on (snapshot taken before) and off (now)
// to give a plain-language "does this site work without JS?" verdict.
import type { PageSnapshot } from '~/lib/state';

export function takeSnapshot(): PageSnapshot {
  const body = document.body;
  return {
    textLength: visibleText().length,
    elementCount: body ? body.getElementsByTagName('*').length : 0,
    imageCount: document.images.length,
    url: location.href,
  };
}

function visibleText(): string {
  // innerText skips hidden elements. Our panel lives under <html>, outside <body>.
  return (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
}

export type JsVerdictGrade = 'works' | 'partial' | 'broken';

export interface JsVerdict {
  grade: JsVerdictGrade;
  /** Share of the original text still visible, 0–100. */
  textPercent: number;
  asksForJs: boolean;
}

// Typical <noscript> messages ("Please enable JavaScript", "JavaScript is required"...).
const ASKS_FOR_JS =
  /(enable|turn on|activate|switch on)\s+javascript|javascript\s+(is\s+)?(required|disabled|needed|must be enabled)|requires\s+javascript|need(s)?\s+(to\s+)?(enable\s+)?javascript/i;

export function judgeWithoutJs(before: PageSnapshot): JsVerdict {
  const text = visibleText();
  const textPercent = Math.round((text.length / Math.max(before.textLength, 1)) * 100);
  const asksForJs = ASKS_FOR_JS.test(text.slice(0, 5000));

  let grade: JsVerdictGrade;
  if (textPercent < 25 || (asksForJs && textPercent < 60)) grade = 'broken';
  else if (textPercent < 70 || asksForJs) grade = 'partial';
  else grade = 'works';

  return { grade, textPercent: Math.min(textPercent, 100), asksForJs };
}

/** Resolve once the page has finished loading, plus a short settle delay. */
export function afterLoad(settleMs = 400): Promise<void> {
  return new Promise((resolve) => {
    const done = () => setTimeout(resolve, settleMs);
    if (document.readyState === 'complete') done();
    else window.addEventListener('load', done, { once: true });
  });
}
