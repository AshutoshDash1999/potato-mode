# Potato Mode Privacy Policy

Effective date: 2026-11-19

Potato Mode is a Chrome extension that simulates a slower device (network speed, CPU speed, JavaScript and CSS) on the web page you choose. This policy explains what data the extension handles and why.

## Summary

- Potato Mode does not collect, transmit, sell, or share any personal data.
- Potato Mode has no servers, no analytics, no advertising, and no tracking.
- Everything the extension stores stays in your browser on your computer. It is removed when you turn Potato Mode off or when you uninstall the extension.

## Data the extension handles

Potato Mode works on the tab you activate. To do its job, it reads and stores the following, all locally:

- **Page information for the active tab:** the tab ID and URL, so it knows which site to throttle, block, or measure.
- **Your settings per tab:** the network and CPU presets you chose, whether JavaScript or CSS is switched off, whether the HTTP cache is off, and the position of the in-page panel. This is kept in `chrome.storage.session`, which is cleared when the browser closes.
- **Sites with JavaScript turned off:** a list of site patterns (for example `https://example.com/*`) kept in `chrome.storage.local`. This list lets Potato Mode undo the setting after a crash or browser restart. You can remove it by turning Potato Mode off.
- **A one-time flag:** whether you have seen the introduction note, kept in `chrome.storage.local`.
- **Performance measurements for the active page:** load timing, paint timing, long-task counts, and the size of downloaded JavaScript and network requests. These are computed in your browser and shown only in the panel. They are not saved or sent anywhere.

Potato Mode does not read the contents of your passwords, form entries, messages, or browsing history.

## How the extension uses Chrome permissions

| Permission | What it is used for |
|---|---|
| `debugger` | Attaches Chrome's debugging protocol to the active tab only while Potato Mode is on. It applies network and CPU throttling, turns off the HTTP cache, measures JavaScript size and page performance, and clears cookies and site storage when you ask. Chrome shows a "Potato Mode started debugging this browser" bar while this is active. The session ends when you turn Potato Mode off. |
| `contentSettings` | Sets JavaScript to "block" for the current site when you choose to turn JavaScript off. It is cleared when you turn Potato Mode off, when you close the tab, or when you move to another site. |
| `scripting` | Injects the Potato Mode panel into the tab you clicked on. It runs only after you click the toolbar icon. |
| `storage` | Stores the per-tab settings and the list of blocked sites described above. Nothing is sent off your device. |
| `tabs` | Reads the active tab's URL and ID, reloads that tab when you change a setting, and sends messages between the background process and the panel in that tab. |
| Host access (`<all_urls>`) | Lets Potato Mode work on any website you choose to test. It acts only on the tab you activate. It does not read or collect data from other sites. |

## Data sharing

Potato Mode does not share data with any third party. It makes no network requests to the developer or anyone else. The only network traffic is the normal traffic of the website you are viewing, which Potato Mode slows down or blocks as you configure it.

## Clearing site data

When you use the "clear site data" option, Potato Mode deletes the cookies and storage (local storage, IndexedDB, cache storage, and service workers) for the origin of the page you are viewing. It does not touch data for other sites or for the browser as a whole.

## Children

Potato Mode is not directed at children under 13, and it does not knowingly collect information from anyone.

## Changes to this policy

If this policy changes, the new version will be published in this file and the effective date above will be updated. Material changes will be described in the extension's release notes.

## Contact

For questions about this policy, open an issue in the project repository or contact the maintainer at the address listed on the Chrome Web Store page.
