import { useEffect, useState } from 'react';
import { Potato } from '~/components/Potato';
import { sendToBackground } from '~/lib/messages';
import type { TabState } from '~/lib/state';
import { bus } from './bus';
import { useDrag } from './useDrag';

export const PANEL_WIDTH = 320;

export function Panel({ initialState }: { initialState: TabState }) {
  const [state, setState] = useState(initialState);

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

  const style = { left: pos.x, top: pos.y };

  if (pos.minimized) {
    return (
      <div ref={ref} className="pm-root pm-bubble" style={style} {...handleProps}>
        <button
          className="pm-bubble__btn"
          title="Open Potato Mode (drag to move)"
          onClick={() => !justDragged.current && setMinimized(false)}
        >
          <Potato size={44} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="pm-root pm-panel"
      style={{ ...style, width: PANEL_WIDTH }}
      role="dialog"
      aria-label="Potato Mode"
    >
      <header className="pm-header" {...handleProps}>
        <Potato size={44} />
        <div className="pm-header__title">
          <strong>Potato Mode</strong>
          <span>{state.active ? 'Making this page slow…' : 'Off'}</span>
        </div>
        <button data-nodrag className="pm-icon-btn" title="Shrink to a potato" onClick={() => setMinimized(true)}>
          –
        </button>
        <button
          data-nodrag
          className="pm-icon-btn pm-icon-btn--close"
          title="Turn Potato Mode off"
          onClick={() => void sendToBackground({ type: 'deactivate' })}
        >
          ×
        </button>
      </header>

      <div className="pm-body">
        <div className="pm-speech">
          <p>
            Hi, I'm <strong>Spud</strong>! I'll show you how this page feels on a slow phone or a bad
            connection.
          </p>
          <p className="pm-hint">Drag me by my head. Press – to shrink me into a potato.</p>
        </div>
      </div>
    </div>
  );
}
