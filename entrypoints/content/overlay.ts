// Outlined, labeled boxes drawn over page elements (LCP, layout shifts, oversized images).
// Lives in its own shadow root under <html>, ignores the mouse, and follows scrolling.

export type HighlightKind = 'lcp' | 'shift' | 'image';

export interface Highlight {
  el: Element;
  label: string;
  kind: HighlightKind;
}

const HOST_NAME = 'potato-mode-overlay';
const COLORS: Record<HighlightKind, string> = {
  lcp: '#2f9e6b',
  shift: '#e8590c',
  image: '#7048e8',
};

const CSS = `
  :host { all: initial; }
  .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
  .box {
    position: fixed; box-sizing: border-box; border: 3px solid var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent); border-radius: 4px;
  }
  .box.flash { animation: flash 900ms ease-out 2; }
  .tag {
    position: absolute; left: -3px; top: -22px; padding: 1px 6px; white-space: nowrap;
    font: 600 12px/18px ui-rounded, system-ui, sans-serif; color: #fff; background: var(--c);
    border-radius: 4px 4px 4px 0;
  }
  .box.below .tag { top: auto; bottom: -22px; border-radius: 0 4px 4px 4px; }
  @keyframes flash { 50% { background: color-mix(in srgb, var(--c) 45%, transparent); } }
  @media (prefers-reduced-motion: reduce) { .box.flash { animation: none; } }
`;

let host: HTMLElement | null = null;
let layer: HTMLDivElement | null = null;
let current: Highlight[] = [];
let boxes: HTMLDivElement[] = [];
let frame = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function ensureLayer(): HTMLDivElement {
  if (layer && host?.isConnected) return layer;
  document.querySelectorAll(HOST_NAME).forEach((el) => el.remove());
  host = document.createElement(HOST_NAME);
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  layer = document.createElement('div');
  layer.className = 'layer';
  root.append(style, layer);
  document.documentElement.append(host);
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule, { passive: true });
  // Pages move things around on their own too; catch that every half second.
  timer = setInterval(schedule, 500);
  return layer;
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function draw() {
  frame = 0;
  current.forEach((h, i) => {
    const box = boxes[i];
    const r = h.el.isConnected ? h.el.getBoundingClientRect() : null;
    if (!box) return;
    if (!r || (r.width === 0 && r.height === 0)) {
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${Math.max(r.width, 6)}px`;
    box.style.height = `${Math.max(r.height, 6)}px`;
    box.classList.toggle('below', r.top < 24);
  });
}

/** Replace all highlights. An empty list removes the overlay. */
export function setHighlights(list: Highlight[]) {
  current = list;
  if (list.length === 0) {
    clearHighlights();
    return;
  }
  const l = ensureLayer();
  l.replaceChildren();
  boxes = list.map((h) => {
    const box = document.createElement('div');
    box.className = 'box';
    box.style.setProperty('--c', COLORS[h.kind]);
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = h.label;
    box.append(tag);
    l.append(box);
    return box;
  });
  draw();
}

/** Scroll an element into view and make its box (if shown) flash. */
export function focusHighlight(el: Element) {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const i = current.findIndex((h) => h.el === el);
  const box = boxes[i];
  if (!box) return;
  box.classList.remove('flash');
  void box.offsetWidth; // restart the animation
  box.classList.add('flash');
}

export function clearHighlights() {
  current = [];
  boxes = [];
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  clearInterval(timer);
  window.removeEventListener('scroll', schedule, { capture: true });
  window.removeEventListener('resize', schedule);
  host?.remove();
  host = null;
  layer = null;
}
