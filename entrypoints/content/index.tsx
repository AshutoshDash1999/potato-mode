import './panel.css';
import ReactDOM from 'react-dom/client';
import { requestJsBytes, sendToBackground, type BackgroundEvent } from '~/lib/messages';
import type { TabState } from '~/lib/state';
import { bus } from './bus';
import { loadFont } from './font';
import { setJsBytes, startMetrics } from './metrics';
import { Panel } from './Panel';

const UI_NAME = 'potato-mode-panel';

export default defineContentScript({
  matches: ['<all_urls>'],
  // Start early so performance is observed from the very beginning of the load.
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Observe from the very start of the page load, even before the panel shows.
    startMetrics();

    let ui: { remove(): void } | null = null;
    let mounting = false;

    async function mount(state: TabState) {
      if (ui || mounting) return;
      mounting = true;
      try {
        await domReady();
        // Remove a panel left behind by an older copy of this script (extension reload).
        document.querySelectorAll(UI_NAME).forEach((el) => el.remove());
        void loadFont();
        const shadowUi = await createShadowRootUi(ctx, {
          name: UI_NAME,
          position: 'inline',
          // Attach to <html> so pages that replace <body> don't wipe the panel.
          anchor: 'html',
          append: 'last',
          onMount(container) {
            const wrapper = document.createElement('div');
            container.append(wrapper);
            const root = ReactDOM.createRoot(wrapper);
            root.render(<Panel initialState={state} />);
            return root;
          },
          onRemove(root) {
            root?.unmount();
          },
        });
        if (ctx.isInvalid) return;
        shadowUi.mount();
        ui = shadowUi;
        // Scripts mostly finished downloading before we mounted; catch up on the total.
        setJsBytes(await requestJsBytes().catch(() => null));
      } finally {
        mounting = false;
      }
    }

    function unmount() {
      ui?.remove();
      ui = null;
    }

    browser.runtime.onMessage.addListener((msg: BackgroundEvent, _sender, sendResponse) => {
      if (ctx.isInvalid) return;
      switch (msg.type) {
        case 'ping':
          sendResponse(true);
          return;
        case 'mount':
          void mount(msg.state);
          break;
        case 'unmount':
          unmount();
          break;
        case 'jsBytes':
          setJsBytes({ bytes: msg.bytes, count: msg.count });
          break;
      }
      bus.emit(msg);
    });

    ctx.onInvalidated(unmount);

    // Restore the panel after a reload or navigation if Potato Mode is on for this tab.
    const state = await sendToBackground({ type: 'getState' }).catch(() => null);
    if (state?.active) await mount(state);
  },
});

function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
}
