import { useEffect, useState, useSyncExternalStore } from 'react';
import { MetricCard } from '~/components/MetricCard';
import { Toggle } from '~/components/Toggle';
import { requestPerfCounters } from '~/lib/messages';
import type { PerfCounters } from '~/lib/perfCounters';
import {
  formatBytes,
  formatMs,
  gradeCls,
  gradeDomNodes,
  gradeInp,
  gradeLcp,
  gradeTbt,
  gradeTtfb,
} from '~/lib/thresholds';
import { describeElement } from './format';
import { metricsStore } from './metrics';
import { clearHighlights, setHighlights, type Highlight } from './overlay';

interface Props {
  unplugged: boolean;
  showOnPage: boolean;
  setShowOnPage: (on: boolean) => void;
}

export function VitalsTab({ unplugged, showOnPage, setShowOnPage }: Props) {
  const r = useSyncExternalStore(metricsStore.subscribe, metricsStore.get);

  useEffect(() => {
    if (!showOnPage) return;
    const list: Highlight[] = [];
    if (r.lcpElement) list.push({ el: r.lcpElement, label: 'LCP', kind: 'lcp' });
    for (const s of r.shiftElements) list.push({ el: s.el, label: `Shift ${s.value.toFixed(3)}`, kind: 'shift' });
    setHighlights(list);
  }, [showOnPage, r.lcpElement, r.shiftElements]);
  useEffect(() => clearHighlights, []);

  return (
    <>
      <MetricCard
        emoji="📨"
        title="Time to first byte (TTFB)"
        value={r.ttfb != null ? formatMs(r.ttfb) : '—'}
        detail="How long the server took to start answering. Includes redirects, DNS and the connection."
        grade={r.ttfb != null ? gradeTtfb(r.ttfb) : undefined}
      />
      <MetricCard
        emoji="🖼️"
        title="Largest Contentful Paint (LCP)"
        value={r.largestContentfulPaint != null ? formatMs(r.largestContentfulPaint) : '—'}
        detail={r.lcpElement ? <code className="pm-code">{describeElement(r.lcpElement)}</code> : undefined}
        grade={r.largestContentfulPaint != null ? gradeLcp(r.largestContentfulPaint) : undefined}
      />
      <MetricCard
        emoji="🫨"
        title="Cumulative Layout Shift (CLS)"
        value={(r.cls ?? 0).toFixed(3)}
        detail={
          r.shiftElements.length > 0
            ? `Worst burst moved ${r.shiftElements.length} element${r.shiftElements.length === 1 ? '' : 's'}. Turn on “Show on page” to see them.`
            : 'Nothing has jumped around so far.'
        }
        grade={gradeCls(r.cls ?? 0)}
      />
      <MetricCard
        emoji="👆"
        title="Interaction to Next Paint (INP)"
        value={r.inp != null ? formatMs(r.inp) : '—'}
        detail={
          r.inp != null
            ? `Slowest response across ${r.interactionCount} interaction${r.interactionCount === 1 ? '' : 's'}.`
            : 'Click, tap or type on the page to measure.'
        }
        grade={r.inp != null ? gradeInp(r.inp) : undefined}
      />
      <MetricCard
        emoji="🚧"
        title="Total Blocking Time (TBT)"
        value={formatMs(r.totalBlockingTime)}
        detail="Time beyond 50 ms in each long task after the first paint. Lab stand-in for how laggy input feels."
        grade={r.firstContentfulPaint != null ? gradeTbt(r.totalBlockingTime) : undefined}
      />

      <Toggle
        emoji="👀"
        label="Show on page"
        hint="Outline the LCP element (green) and what shifted (orange)."
        checked={showOnPage}
        onChange={setShowOnPage}
      />

      <Counters unplugged={unplugged} />
    </>
  );
}

function Counters({ unplugged }: { unplugged: boolean }) {
  const [c, setC] = useState<PerfCounters | null>(null);
  const [domSize, setDomSize] = useState(0);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      setDomSize(document.body ? document.body.getElementsByTagName('*').length : 0);
      if (unplugged) return;
      const next = await requestPerfCounters().catch(() => null);
      if (live) setC(next);
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [unplugged]);

  return (
    <>
      <MetricCard
        emoji="🌳"
        title="DOM size"
        value={
          <>
            {domSize.toLocaleString()} <small>elements</small>
          </>
        }
        detail="Big DOMs make every style recalc and layout slower. Aim for under 800."
        grade={gradeDomNodes(domSize)}
      />
      {c ? (
        <div className="pm-stats" aria-label="Runtime counters">
          <Stat label="JS heap" value={`${formatBytes(c.heapUsed)} / ${formatBytes(c.heapTotal)}`} />
          <Stat label="Event listeners" value={c.listeners.toLocaleString()} />
          <Stat label="Layouts" value={`${c.layoutCount.toLocaleString()} · ${formatMs(c.layoutMs)}`} />
          <Stat label="Style recalcs" value={`${c.recalcStyleCount.toLocaleString()} · ${formatMs(c.recalcStyleMs)}`} />
          <Stat label="Script time" value={formatMs(c.scriptMs)} />
          <Stat label="Frames" value={String(c.frames)} />
        </div>
      ) : (
        <p className="pm-blurb">
          {unplugged ? 'Plug Spud back in to see heap and layout counters.' : 'Loading counters…'}
        </p>
      )}
      {c && <p className="pm-blurb pm-blurb--tiny">Updates every 2 s. Counts grow while you use the page; watch for ones that never stop.</p>}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pm-stat">
      <span className="pm-stat__label">{label}</span>
      <span className="pm-stat__value">{value}</span>
    </div>
  );
}
