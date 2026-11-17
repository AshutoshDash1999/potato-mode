// Small display helpers for the developer card.

/** Last path segment of a URL (or the host), for lists in a narrow panel. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return safeDecode(last ?? u.hostname) || u.hostname;
  } catch {
    return url;
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** "img.hero", "h1 “Welcome to…”" — enough to recognise an element. */
export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = !id && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
  const base = `${tag}${id}${cls ? `.${cls}` : ''}`;
  if (tag === 'img') return `${base} (${shortUrl((el as HTMLImageElement).currentSrc)})`;
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text ? `${base} “${text.slice(0, 28)}${text.length > 28 ? '…' : ''}”` : base;
}

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
