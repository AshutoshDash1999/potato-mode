# 🥔 Potato Mode

A Chrome extension that makes any web page behave as if it were running on a slow or mid-range device. It's a teaching tool, so it explains what it does in plain language instead of DevTools panels.

## What it does

- **Network presets:** Normal / Fast 4G / Slow 3G / Offline
- **CPU presets:** 1× / 4× / 6× slower. These are relative to *your* machine, not models of real phones.
- **Page tricks:** switch off JavaScript or strip all CSS to see which sites still work
- **Report card:** how much JavaScript the page downloaded, how long it took to load, and how often it froze, in plain words

Click the potato in the toolbar to open a draggable cartoon panel on the current page.

> Throttling uses `chrome.debugger`, so Chrome shows a yellow "Potato Mode started debugging this browser" bar while Potato Mode is on. That's expected.

## Develop

```bash
npm install
npm run dev       # opens Chrome with the extension loaded
npm run compile   # type-check
npm run build     # production build in .output/
```

Built with [WXT](https://wxt.dev) and React.
