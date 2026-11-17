# 🥔 Potato Mode

A Chrome extension that makes any web page behave as if it were running on a slow or mid-range device. It's a teaching tool, so it explains what it does in plain language instead of DevTools panels.

## Using it

1. Open any normal website. Chrome doesn't allow extensions on its own pages, such as `chrome://` pages and the Web Store.
2. Click the 🥔 in the toolbar. Pin it from the 🧩 menu first if you don't see it. A draggable panel appears with Spud the potato. Drag it by the header, or press **–** to shrink it into a bubble.
3. Pick your settings, press **↻ Reload**, and read the report card.

Click the 🥔 again, or press **×** on the panel, to turn everything off. The page goes back to normal.

### The controls

| Card | What it does |
|---|---|
| 📶 **Network** | 🚀 Normal · 🐇 Fast 4G · 🐢 Slow 3G · 🔌 Offline. Speeds match Chrome DevTools' presets. |
| 🧠 **CPU** | 🏎️ Full speed · 🚲 4× slower · 🐌 6× slower. These are relative to *your* computer, so they're a rough stand-in for a cheaper phone, not a model of a specific device. |
| 🧪 **Page tricks** | **Turn off JavaScript** for the site (the page reloads), then get a verdict: 🎉 still works, 🤔 half-baked or 🫠 needs JavaScript. **Strip all CSS** to see the bare HTML, instantly and reversibly. |
| 📋 **Report card** | 📦 How much JavaScript was downloaded and how long that takes on a slow connection · ⏱️ when the page finished loading and when content first appeared · 🥶 how often the page froze for more than 50 ms. Each line gets a 🟢 / 🟡 / 🔴 grade. |

### About the yellow bar

Network and CPU throttling use Chrome's debugger API, so while Potato Mode is on, Chrome shows **"Potato Mode started debugging this browser"**. That's expected, and it goes away when you turn Potato Mode off.

If you press **Cancel** on the bar, Spud gets "unplugged": throttling stops and the panel offers to plug back in.

### Good to know

- **JavaScript off applies to the whole site** (e.g. every `example.com` tab), because that's how Chrome's JavaScript setting works. Potato Mode always undoes it: when you turn it off, close the tab, move to another site, or restart the browser.
- **JS size counts the main page only.** Scripts inside embedded iframes from other sites aren't included.
- **CSS strip doesn't reach inside web components.** Styles in a page's own shadow DOM stay.
- **Nothing leaves your computer.** There are no servers, no analytics, and no tracking.

## Develop

```bash
npm install
npm run dev       # opens a separate Chrome window with the extension loaded and hot reload
npm run compile   # type-check
npm run build     # production build in .output/chrome-mv3
npm run zip       # zip for the Chrome Web Store
```

To use it in your everyday Chrome, run `npm run build`. Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `.output/chrome-mv3`. In the file picker, press ⌘⇧. to show hidden folders.

### Layout

```
entrypoints/
  background.ts         toolbar toggle, debugger session, JS blocking, JS byte counting
  content/              the in-page panel (Shadow DOM + React)
    Panel.tsx           the panel and its cards
    ReportCard.tsx      plain-language metrics
    metrics.ts          PerformanceObserver: load time, paints, long tasks
    cssStrip.ts         reversible CSS stripping
    snapshot.ts         "works without JS?" before/after comparison
components/             Potato mascot, Segmented, Toggle, MetricCard
lib/                    presets, thresholds, per-tab state, messages, CDP helpers
```

Built with [WXT](https://wxt.dev) and React. The panel uses plain CSS in px, because host pages can change the root font size and that would throw off `rem` units. The font is [Fredoka](https://github.com/hafontia/Fredoka-One) (SIL Open Font License, see `assets/fonts/OFL.txt`).
