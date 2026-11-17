import { useEffect, useState, type ReactNode } from 'react';
import { Potato, type PotatoMood } from '~/components/Potato';
import { Segmented } from '~/components/Segmented';
import { sendToBackground, type StateRequest } from '~/lib/messages';
import { CPU_PRESETS, NETWORK_ORDER, NETWORK_PRESETS } from '~/lib/presets';
import type { PanelTab, TabState } from '~/lib/state';
import { panelId, SideTabs, tabId, type SideTab } from '~/components/SideTabs';
import { Toggle } from '~/components/Toggle';
import { bus } from './bus';
import { restoreCss, stripCss, type CssStripStats } from './cssStrip';
import { DataTab } from './DataTab';
import { ErrorBoundary } from './ErrorBoundary';
import { IntroNote } from './IntroNote';
import { JsVerdictBox } from './JsVerdictBox';
import { ReportCard } from './ReportCard';
import { takeSnapshot } from './snapshot';
import { useDrag } from './useDrag';
import { RuntimeTab, VitalsTab } from './VitalsTab';
import { UnusedTab, WeightTab } from './WasteTab';

export const PANEL_WIDTH = 340;
/** How far the index tabs stick out to the left of the panel. */
const TAB_WIDTH = 44;
const TABS_ID = 'pm';

const TABS: SideTab<PanelTab>[] = [
  { value: 'slow', emoji: '🎛️', label: 'Slow down' },
  { value: 'tricks', emoji: '🧪', label: 'Page tricks' },
  { value: 'report', emoji: '📋', label: 'Report card' },
  { value: 'vitals', emoji: '💓', label: 'Web vitals' },
  { value: 'runtime', emoji: '📈', label: 'Runtime' },
  { value: 'unused', emoji: '🧟', label: 'Unused code' },
  { value: 'weight', emoji: '🏋️', label: 'Page weight' },
  { value: 'data', emoji: '🧹', label: 'Site data' },
];

function moodFor(state: TabState): PotatoMood {
  if (state.unplugged) return 'sad';
  if (state.network === 'offline') return 'sleepy';
  if (state.cpu >= 6) return 'dizzy';
  if (state.network === 'slow3g' || state.cpu >= 4) return 'sweaty';
  return 'happy';
}

function summary(state: TabState): string {
  if (state.unplugged) return 'Unplugged — nothing is slowed down';
  const n = NETWORK_PRESETS[state.network];
  const cpu = state.cpu === 1 ? 'full-speed CPU' : `${state.cpu}× slower CPU`;
  return `${n.emoji} ${n.label} · 🧠 ${cpu}`;
}

export function Panel({ initialState }: { initialState: TabState }) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  // Local for snappy switching; saved in the background so it survives reloads.
  const [tab, setTab] = useState<PanelTab>(initialState.panelTab);
  const [showOnPage, setShowOnPage] = useState(false);

  useEffect(
    () =>
      bus.on((ev) => {
        if (ev.type === 'state' || ev.type === 'mount') setState(ev.state);
      }),
    [],
  );

  // Strip the page's CSS while the switch is on; always restore when switched off or unmounted.
  const [cssStats, setCssStats] = useState<CssStripStats | null>(null);
  useEffect(() => {
    if (!state.cssOff) return;
    setCssStats(stripCss());
    return () => {
      restoreCss();
      setCssStats(null);
    };
  }, [state.cssOff]);

  const { ref, pos, setMinimized, justDragged, handleProps } = useDrag(
    state.panelPos,
    PANEL_WIDTH + TAB_WIDTH,
    (p) => void sendToBackground({ type: 'savePos', pos: p }),
  );

  /** Send a request, then adopt the state the background returns. */
  const request = async (msg: StateRequest) => {
    setBusy(true);
    try {
      const next = await sendToBackground(msg);
      if (next) setState(next);
    } catch {
      // The page is reloading (JS toggle) or the extension was reloaded; nothing to update.
    } finally {
      setBusy(false);
    }
  };

  const mood = moodFor(state);
  const style = { left: pos.x, top: pos.y };

  if (pos.minimized) {
    return (
      <div ref={ref} className="pm-root pm-bubble" style={style} {...handleProps}>
        <button
          className="pm-bubble__btn"
          title="Open Potato Mode (drag to move)"
          onClick={() => !justDragged.current && setMinimized(false)}
        >
          <span key={mood} className="pm-mood">
            <Potato size={44} mood={mood} />
          </span>
        </button>
      </div>
    );
  }

  const net = NETWORK_PRESETS[state.network];
  const canBlockJs = location.protocol === 'http:' || location.protocol === 'https:';

  const slowDown = (
    <>
      {state.unplugged ? (
        <div className="pm-speech pm-speech--warn">
          <p>
            <strong>I got unplugged!</strong> Someone pressed <em>Cancel</em> on Chrome's yellow
            "debugging" bar, so I can't slow this page down anymore.
          </p>
          <button className="pm-btn" disabled={busy} onClick={() => void request({ type: 'replug' })}>
            🔌 Plug me back in
          </button>
        </div>
      ) : (
        <section className="pm-card">
          <h3 className="pm-card__title">📶 Network</h3>
          <Segmented
            label="Network speed"
            value={state.network}
            disabled={busy}
            options={NETWORK_ORDER.map((id) => ({
              value: id,
              label: NETWORK_PRESETS[id].label,
              emoji: NETWORK_PRESETS[id].emoji,
              title: NETWORK_PRESETS[id].blurb,
            }))}
            onChange={(network) => void request({ type: 'setNetwork', network })}
          />
          <p className="pm-blurb">
            <strong>{net.blurb}.</strong>{' '}
            {state.network === 'normal'
              ? 'Nothing is slowed down.'
              : state.network === 'offline'
                ? 'New requests will fail, just like losing signal.'
                : 'Reload to feel the whole page load this slowly.'}
          </p>
          {state.network !== 'normal' && (
            <button className="pm-btn pm-btn--small" onClick={() => void sendToBackground({ type: 'reload' })}>
              ↻ Reload page
            </button>
          )}
        </section>
      )}

      {!state.unplugged && (
        <section className="pm-card">
          <h3 className="pm-card__title">🧠 CPU</h3>
          <Segmented
            label="CPU slowdown"
            value={state.cpu}
            disabled={busy}
            options={CPU_PRESETS.map((p) => ({
              value: p.rate,
              label: p.rate === 1 ? 'Full speed' : `${p.label} slower`,
              emoji: p.rate === 1 ? '🏎️' : p.rate === 4 ? '🚲' : '🐌',
              title: p.blurb,
            }))}
            onChange={(cpu) => void request({ type: 'setCpu', cpu })}
          />
          <p className="pm-blurb">
            {state.cpu === 1 ? (
              <>
                <strong>Your computer at full speed.</strong> Pick a slowdown to see scripts, scrolling and
                clicks get sluggish.
              </>
            ) : (
              <>
                <strong>Everything runs {state.cpu}× slower than on your computer.</strong> That's a rough
                stand-in for a cheaper phone, not an exact model of one.
              </>
            )}
          </p>
        </section>
      )}
    </>
  );

  const tricks = (
    <section className="pm-card">
      <h3 className="pm-card__title">🧪 Page tricks</h3>
      <Toggle
        emoji="📜"
        label="Turn off JavaScript"
        hint={
          canBlockJs
            ? 'For this whole site. The page reloads.'
            : 'Only works on normal http/https websites.'
        }
        checked={state.jsOff}
        disabled={busy || !canBlockJs}
        onChange={(jsOff) =>
          void request({ type: 'setJs', jsOff, snapshot: jsOff ? takeSnapshot() : undefined })
        }
      />
      {state.jsOff && <JsVerdictBox before={state.jsSnapshot} />}
      <Toggle
        emoji="🎨"
        label="Strip all CSS"
        hint="Instant, no reload. Shows the bare HTML underneath."
        checked={state.cssOff}
        disabled={busy}
        onChange={(cssOff) => void request({ type: 'setCss', cssOff })}
      />
      {state.cssOff && cssStats && (
        <p className="pm-blurb">
          <strong>
            Removed {cssStats.sheets} stylesheet{cssStats.sheets === 1 ? '' : 's'} and {cssStats.inlineStyles}{' '}
            inline style{cssStats.inlineStyles === 1 ? '' : 's'}.
          </strong>{' '}
          If the page still reads top to bottom in a sensible order, its HTML is well built. That also helps
          screen readers and anyone whose CSS fails to load.
        </p>
      )}
    </section>
  );

  const devCard = (title: string, body: ReactNode) => (
    <section className="pm-card">
      <h3 className="pm-card__title">{title}</h3>
      {body}
    </section>
  );

  const content: Record<PanelTab, ReactNode> = {
    slow: slowDown,
    tricks,
    report: <ReportCard network={state.network} unplugged={state.unplugged} />,
    vitals: devCard('💓 Web vitals', <VitalsTab showOnPage={showOnPage} setShowOnPage={setShowOnPage} />),
    runtime: devCard('📈 Runtime', <RuntimeTab unplugged={state.unplugged} />),
    unused: devCard(
      '🧟 Unused code',
      <UnusedTab
        unplugged={state.unplugged}
        busy={busy}
        coverage={state.coverage}
        coveragePending={state.coveragePending}
        request={request}
      />,
    ),
    weight: devCard(
      '🏋️ Page weight',
      <WeightTab unplugged={state.unplugged} showOnPage={showOnPage} setShowOnPage={setShowOnPage} />,
    ),
    data: devCard(
      '🧹 Site data',
      <DataTab unplugged={state.unplugged} busy={busy} cacheOff={state.cacheOff} request={request} />,
    ),
  };

  const changeTab = (next: PanelTab) => {
    setTab(next);
    void sendToBackground({ type: 'setPanelTab', tab: next }).catch(() => {});
  };

  return (
    <div ref={ref} className="pm-root pm-shell" style={style}>
      <SideTabs label="Potato Mode sections" idPrefix={TABS_ID} value={tab} tabs={TABS} onChange={changeTab} />
      <div className="pm-panel" style={{ width: PANEL_WIDTH }} role="dialog" aria-label="Potato Mode">
        <header className="pm-header" {...handleProps}>
          {/* Keyed by mood so Spud does a little "boing" whenever the face changes. */}
          <span key={mood} className="pm-mood">
            <Potato size={44} mood={mood} />
          </span>
          <div className="pm-header__title">
            <strong>Potato Mode</strong>
            <span>{summary(state)}</span>
          </div>
          <button data-nodrag className="pm-icon-btn" title="Shrink to a potato" onClick={() => setMinimized(true)}>
            –
          </button>
          <button
            data-nodrag
            className="pm-icon-btn pm-icon-btn--close"
            title="Turn Potato Mode off"
            onClick={() => void request({ type: 'deactivate' })}
          >
            ×
          </button>
        </header>

        <div className="pm-body" id={panelId(TABS_ID)} role="tabpanel" aria-labelledby={tabId(TABS_ID, tab)}>
          {!state.unplugged && <IntroNote />}
          {/* Keyed so each tab fades in and a crash in one tab doesn't stick to the others. */}
          <div key={tab} className="pm-page">
            <ErrorBoundary>{content[tab]}</ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
