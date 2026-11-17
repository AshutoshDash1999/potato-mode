import { useSyncExternalStore } from 'react';
import { MetricCard } from '~/components/MetricCard';
import { NETWORK_PRESETS, secondsToDownload, type NetworkPresetId } from '~/lib/presets';
import {
  formatBytes,
  formatMs,
  gradeJsBytes,
  gradeLoadTime,
  gradeLongestTask,
  LONG_TASK_MS,
} from '~/lib/thresholds';
import { metricsStore } from './metrics';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function downloadHint(bytes: number, network: NetworkPresetId) {
  // When not throttled, compare with Slow 3G so the number means something.
  const target: NetworkPresetId = network === 'normal' || network === 'offline' ? 'slow3g' : network;
  const s = secondsToDownload(bytes, target);
  if (s == null || bytes === 0) return null;
  const time = s < 1 ? 'under a second' : `about ${Math.round(s)} s`;
  return target === network
    ? `That's ${time} of downloading on ${NETWORK_PRESETS[target].label}, before any of it runs.`
    : `On ${NETWORK_PRESETS[target].label} that would take ${time} just to download.`;
}

export function ReportCard({ network, unplugged }: { network: NetworkPresetId; unplugged: boolean }) {
  const r = useSyncExternalStore(metricsStore.subscribe, metricsStore.get);

  return (
    <section className="pm-card">
      <h3 className="pm-card__title">📋 Report card</h3>

      {r.js && !unplugged ? (
        <MetricCard
          emoji="📦"
          title="JavaScript downloaded"
          value={
            <>
              {formatBytes(r.js.bytes)} <small>in {plural(r.js.count, 'file')}</small>
            </>
          }
          detail={downloadHint(r.js.bytes, network)}
          grade={gradeJsBytes(r.js.bytes)}
        />
      ) : (
        <MetricCard
          emoji="📦"
          title="JavaScript downloaded"
          value="—"
          detail={unplugged ? 'Plug Spud back in and reload to measure.' : 'Reload the page to measure.'}
        />
      )}

      {r.loadTime != null ? (
        <MetricCard
          emoji="⏱️"
          title="Page finished loading"
          value={formatMs(r.loadTime)}
          detail={
            r.firstContentfulPaint != null
              ? `First thing on screen after ${formatMs(r.firstContentfulPaint)}${
                  r.largestContentfulPaint != null
                    ? `, main content after ${formatMs(r.largestContentfulPaint)}`
                    : ''
                }.`
              : undefined
          }
          grade={gradeLoadTime(r.loadTime)}
        />
      ) : (
        <MetricCard emoji="⏱️" title="Page finished loading" value="Still loading…" />
      )}

      <MetricCard
        emoji="🥶"
        title="Freezes"
        value={r.longTaskCount === 0 ? 'None so far' : plural(r.longTaskCount, 'freeze')}
        detail={
          r.longTaskCount === 0
            ? 'The page never stopped responding for more than 50 ms. Smooth!'
            : `Longest: ${formatMs(r.longestTask)}. Taps and scrolls wait during a freeze, and people notice anything over ${LONG_TASK_MS} ms.`
        }
        grade={gradeLongestTask(r.longestTask)}
      />

      <div className="pm-report__footer">
        <p className="pm-blurb">These numbers are for this page load. Change a setting, then reload to compare.</p>
        <button className="pm-btn pm-btn--small" onClick={() => location.reload()}>
          ↻ Reload
        </button>
      </div>
    </section>
  );
}
