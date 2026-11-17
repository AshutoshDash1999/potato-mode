import { useEffect, useState } from 'react';
import { Potato, type PotatoMood } from '~/components/Potato';
import { Segmented } from '~/components/Segmented';
import { sendToBackground, type PanelRequest } from '~/lib/messages';
import { CPU_PRESETS, NETWORK_ORDER, NETWORK_PRESETS } from '~/lib/presets';
import type { TabState } from '~/lib/state';
import { bus } from './bus';
import { useDrag } from './useDrag';

export const PANEL_WIDTH = 340;

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

  useEffect(
    () =>
      bus.on((ev) => {
        if (ev.type === 'state' || ev.type === 'mount') setState(ev.state);
      }),
    [],
  );

  const { ref, pos, setMinimized, justDragged, handleProps } = useDrag(
    state.panelPos,
    PANEL_WIDTH,
    (p) => void sendToBackground({ type: 'savePos', pos: p }),
  );

  /** Send a request, then adopt the state the background returns. */
  const request = async (msg: PanelRequest) => {
    setBusy(true);
    try {
      const next = await sendToBackground(msg);
      if (next) setState(next);
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
          <Potato size={44} mood={mood} />
        </button>
      </div>
    );
  }

  const net = NETWORK_PRESETS[state.network];

  return (
    <div
      ref={ref}
      className="pm-root pm-panel"
      style={{ ...style, width: PANEL_WIDTH }}
      role="dialog"
      aria-label="Potato Mode"
    >
      <header className="pm-header" {...handleProps}>
        <Potato size={44} mood={mood} />
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

      <div className="pm-body">
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
              <button className="pm-btn pm-btn--small" onClick={() => location.reload()}>
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
      </div>
    </div>
  );
}
