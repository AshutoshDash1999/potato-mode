import { useState } from 'react';
import { Toggle } from '~/components/Toggle';
import type { ClearKind, ClearResult } from '~/lib/clearData';
import { requestClearSiteData, type StateRequest } from '~/lib/messages';

interface Props {
  unplugged: boolean;
  busy: boolean;
  cacheOff: boolean;
  request: (msg: StateRequest) => Promise<void>;
}

const KINDS: { kind: ClearKind; label: string; hint: string }[] = [
  { kind: 'cookies', label: '🍪 Cookies', hint: 'Logs you out of this site.' },
  { kind: 'storage', label: '🗄️ Storage', hint: 'localStorage, sessionStorage, IndexedDB, Cache Storage.' },
  { kind: 'serviceWorkers', label: '⚙️ Service workers', hint: 'Offline caches and background scripts.' },
];

export function DataTab({ unplugged, busy, cacheOff, request }: Props) {
  const [kinds, setKinds] = useState<ClearKind[]>(['storage', 'serviceWorkers']);
  const [confirming, setConfirming] = useState<'clear' | 'firstVisit' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const isWeb = location.protocol === 'http:' || location.protocol === 'https:';
  const disabled = busy || working || unplugged || !isWeb;

  const run = async (which: 'clear' | 'firstVisit') => {
    const chosen: ClearKind[] = which === 'firstVisit' ? ['cookies', 'storage', 'serviceWorkers'] : kinds;
    // Cookies log people out, so ask once before doing it.
    if (chosen.includes('cookies') && confirming !== which) {
      setConfirming(which);
      return;
    }
    setConfirming(null);
    setWorking(true);
    try {
      // CDP can't reach sessionStorage; it lives in this tab, so clear it here.
      if (chosen.includes('storage')) {
        try {
          sessionStorage.clear();
        } catch {
          // Blocked by the page's sandbox; nothing to clear.
        }
      }
      const res = await requestClearSiteData(chosen, which === 'firstVisit');
      setResult(res ? summary(res) : 'Could not clear data. Is Spud plugged in?');
    } catch {
      // The page is reloading (first visit); the panel comes back on its own.
    } finally {
      setWorking(false);
    }
  };

  if (!isWeb) return <p className="pm-blurb">Only works on normal http/https websites.</p>;

  return (
    <>
      {unplugged && <p className="pm-blurb">Plug Spud back in to clear data.</p>}

      <div className="pm-sub">
        <h4 className="pm-sub__title">❄️ First-visit load</h4>
        <p className="pm-blurb">
          Wipes cookies, storage and service workers for <strong>{location.host}</strong>, turns the HTTP cache off,
          and reloads. This is what a brand-new visitor gets.
        </p>
        <button className="pm-btn pm-btn--small" disabled={disabled} onClick={() => void run('firstVisit')}>
          {confirming === 'firstVisit' ? '⚠️ This logs you out. Press again' : '❄️ Load as a first-time visitor'}
        </button>
      </div>

      <Toggle
        emoji="🥶"
        label="Cold cache"
        hint="Skip the HTTP cache on every load, like DevTools' “Disable cache”."
        checked={cacheOff}
        disabled={busy || unplugged}
        onChange={(cacheOff) => void request({ type: 'setCacheOff', cacheOff })}
      />

      <div className="pm-sub">
        <h4 className="pm-sub__title">🧹 Clear site data</h4>
        {KINDS.map((k) => (
          <label key={k.kind} className="pm-check">
            <input
              type="checkbox"
              checked={kinds.includes(k.kind)}
              onChange={(e) => {
                setConfirming(null);
                setKinds((prev) => (e.target.checked ? [...prev, k.kind] : prev.filter((x) => x !== k.kind)));
              }}
            />
            <span>
              <strong>{k.label}</strong> <span className="pm-check__hint">{k.hint}</span>
            </span>
          </label>
        ))}
        <button className="pm-btn pm-btn--small" disabled={disabled || kinds.length === 0} onClick={() => void run('clear')}>
          {confirming === 'clear' ? '⚠️ This logs you out. Press again' : '🧹 Clear now'}
        </button>
        {result && <p className="pm-blurb">{result}</p>}
        <p className="pm-blurb pm-blurb--tiny">
          Only this site's origin. Other sites, and cookies set by embedded third parties, stay untouched.
        </p>
      </div>
    </>
  );
}

function summary(r: ClearResult): string {
  const parts = r.cleared.map((k) =>
    k === 'cookies' ? `${r.cookies} cookie${r.cookies === 1 ? '' : 's'}` : k === 'storage' ? 'storage' : 'service workers',
  );
  return `✅ Cleared ${parts.join(', ')} for ${r.origin}. Reload to see the effect.`;
}
