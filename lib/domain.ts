// Good-enough "registrable domain" (eTLD+1) without shipping the whole public suffix list.

// Common two-part public suffixes, so "shop.example.co.uk" → "example.co.uk".
const TWO_PART = /\.(co|com|net|org|gov|edu|ac|ne|or|go)\.[a-z]{2}$/i;
const HOSTED = /\.(github\.io|vercel\.app|netlify\.app|pages\.dev|herokuapp\.com|web\.app|firebaseapp\.com)$/i;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function siteOf(host: string): string {
  if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host; // IPs
  const labels = host.split('.');
  const keep = HOSTED.test(host) || TWO_PART.test(host) ? 3 : 2;
  return labels.slice(-keep).join('.');
}
