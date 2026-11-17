// "For developers": deeper metrics, a waste finder and site-data tools, folded away by default.
import { useState } from 'react';
import { Segmented } from '~/components/Segmented';
import type { StateRequest } from '~/lib/messages';
import type { DevTab, TabState } from '~/lib/state';
import { ErrorBoundary } from './ErrorBoundary';
import { VitalsTab } from './VitalsTab';
import { WasteTab } from './WasteTab';

interface Props {
  state: TabState;
  busy: boolean;
  request: (msg: StateRequest) => Promise<void>;
}

const TABS: { value: DevTab; label: string; emoji: string; title: string }[] = [
  { value: 'vitals', label: 'Vitals', emoji: '💓', title: 'Core Web Vitals and runtime counters' },
  { value: 'waste', label: 'Waste', emoji: '🗑️', title: 'Unused code, heavy files, oversized images' },
];

export function DevCard({ state, busy, request }: Props) {
  // Local for snappy toggling; saved in the background so it survives reloads.
  const [open, setOpen] = useState(state.devOpen);
  const [tab, setTab] = useState<DevTab>(state.devTab);
  const [showOnPage, setShowOnPage] = useState(false);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    void request({ type: 'setDevUi', devOpen: next });
  };

  return (
    <section className="pm-card pm-dev">
      <button className="pm-dev__head" aria-expanded={open} onClick={toggleOpen}>
        <h3 className="pm-card__title">🔬 For developers</h3>
        <span className={`pm-dev__chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <>
          <Segmented
            label="Developer tools"
            value={tab}
            options={TABS}
            onChange={(t) => {
              setTab(t);
              void request({ type: 'setDevUi', devTab: t });
            }}
          />
          <ErrorBoundary key={tab}>
          {tab === 'vitals' && (
            <VitalsTab unplugged={state.unplugged} showOnPage={showOnPage} setShowOnPage={setShowOnPage} />
          )}
          {tab === 'waste' && (
            <WasteTab
              unplugged={state.unplugged}
              busy={busy}
              coverage={state.coverage}
              coveragePending={state.coveragePending}
              request={request}
              showOnPage={showOnPage}
              setShowOnPage={setShowOnPage}
            />
          )}
          </ErrorBoundary>
        </>
      )}
    </section>
  );
}
