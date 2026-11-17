// Load the bundled Fredoka font into the page's FontFaceSet.
// @font-face declared inside a shadow root is ignored by Chrome, and a
// chrome-extension:// font URL can be blocked by the page's CSP, so we build
// the FontFace from in-memory bytes instead. Fonts added to document.fonts are
// visible inside our shadow root.
import fontDataUrl from '~/assets/fonts/fredoka-latin.woff2?inline';

export const FONT_FAMILY = 'PotatoFredoka';

let loading: Promise<void> | null = null;

function dataUrlToBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function loadFont(): Promise<void> {
  loading ??= (async () => {
    try {
      const face = new FontFace(FONT_FAMILY, dataUrlToBuffer(fontDataUrl), {
        weight: '300 700',
        display: 'swap',
      });
      await face.load();
      document.fonts.add(face);
    } catch (err) {
      // Falls back to the rounded system fonts in the CSS stack.
      console.warn('[potato] font failed to load', err);
    }
  })();
  return loading;
}
