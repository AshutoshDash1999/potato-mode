import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { CoverageResult, CoverageSide } from '~/lib/coverage';
import { requestNetInventory, type StateRequest } from '~/lib/messages';
import type { NetInventory } from '~/lib/netTally';
import { formatBytes, formatMs } from '~/lib/thresholds';
import { percent, shortUrl } from './format';
import { auditImages, renderBlocking, type BlockingResource, type ImageIssue } from './imageAudit';
import { clearHighlights, focusHighlight, setHighlights } from './overlay';
import { Toggle } from '~/components/Toggle';

interface Props {
  unplugged: boolean;
  busy: boolean;
  coverage: CoverageResult | null;
  coveragePending: boolean;
  request: (msg: StateRequest) => Promise<void>;
  showOnPage: boolean;
  setShowOnPage: (on: boolean) => void;
}

export function WasteTab({ unplugged, busy, coverage, coveragePending, request, showOnPage, setShowOnPage }: Props) {
  const [inv, setInv] = useState<NetInventory | null>(null);
  const [images, setImages] = useState<ImageIssue[]>([]);
  const [blocking, setBlocking] = useState<BlockingResource[]>([]);

  const refresh = useCallback(async () => {
    const next = unplugged ? null : await requestNetInventory().catch(() => null);
    setInv(next);
    setImages(auditImages(next?.imageBytes));
    setBlocking(renderBlocking());
  }, [unplugged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!showOnPage) return;
    setHighlights(images.map((i) => ({ el: i.el, label: ratioLabel(i), kind: 'image' })));
  }, [showOnPage, images]);
  useEffect(() => clearHighlights, []);

  const scanHere = coverage && coverage.url === location.href ? coverage : null;
  const thirdParty = inv?.domains.filter((d) => d.thirdParty) ?? [];
  const thirdBytes = thirdParty.reduce((n, d) => n + d.bytes, 0);

  return (
    <>
      <Section title="🧟 Code that never ran">
        {coveragePending ? (
          <p className="pm-blurb">Scanning… waiting for the page to finish loading.</p>
        ) : scanHere ? (
          <>
            <CoverageBlock label="JavaScript" side={scanHere.js} />
            <CoverageBlock label="CSS" side={scanHere.css} />
            <p className="pm-blurb pm-blurb--tiny">
              Measured during one load before you touched anything. Code for clicks and menus shows as unused until
              it runs, so treat it as “could load later”, not “delete”.
            </p>
          </>
        ) : (
          <p className="pm-blurb">
            Reloads the page while recording which JS functions and CSS rules are used. That load runs slower than
            normal, so ignore its timings.
          </p>
        )}
        <button
          className="pm-btn pm-btn--small"
          disabled={busy || unplugged || coveragePending}
          onClick={() => void request({ type: 'startCoverage' })}
        >
          🔍 {scanHere ? 'Scan again' : 'Scan for unused code'}
        </button>
      </Section>

      <Section title="🏋️ Heaviest downloads" action={<RefreshButton onClick={refresh} />}>
        {!inv ? (
          <p className="pm-blurb">{unplugged ? 'Plug Spud back in and reload to see requests.' : 'Reload the page to list requests.'}</p>
        ) : (
          <>
            <p className="pm-blurb">
              <strong>
                {formatBytes(inv.totalBytes)} in {inv.requestCount} requests
              </strong>
              {inv.cachedCount > 0 && ` · ${inv.cachedCount} from cache`}
              {inv.failedCount > 0 && ` · ${inv.failedCount} failed`}
            </p>
            <ul className="pm-list">
              {inv.heaviest.map((e, i) => (
                <Row key={i} name={shortUrl(e.url)} title={e.url} tag={e.type} value={formatBytes(e.bytes)} share={percent(e.bytes, inv.totalBytes)} />
              ))}
            </ul>
            <ul className="pm-list pm-list--types">
              {inv.byType.slice(0, 6).map((t) => (
                <Row key={t.type} name={t.type} value={`${formatBytes(t.bytes)} · ${t.count}`} share={percent(t.bytes, inv.totalBytes)} />
              ))}
            </ul>
          </>
        )}
      </Section>

      {inv && (
        <Section title="🕵️ Third parties">
          {thirdParty.length === 0 ? (
            <p className="pm-blurb">Everything came from this site. 🎉</p>
          ) : (
            <>
              <p className="pm-blurb">
                <strong>{percent(thirdBytes, inv.totalBytes)}% of bytes</strong> came from {thirdParty.length} other domain
                {thirdParty.length === 1 ? '' : 's'}. You don't control how fast these are.
              </p>
              <ul className="pm-list">
                {thirdParty.map((d) => (
                  <Row key={d.domain} name={d.domain} value={`${formatBytes(d.bytes)} · ${d.count}`} share={percent(d.bytes, inv.totalBytes)} />
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      <Section title="⛔ Render-blocking">
        {blocking.length === 0 ? (
          <p className="pm-blurb">Nothing held up the first paint (or this Chrome doesn't report it).</p>
        ) : (
          <>
            <p className="pm-blurb">The browser waited for these before drawing anything. Inline what's critical, defer the rest.</p>
            <ul className="pm-list">
              {blocking.map((b, i) => (
                <Row key={i} name={shortUrl(b.url)} title={b.url} value={formatMs(b.ms)} />
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="🐘 Oversized images" action={<RefreshButton onClick={refresh} />}>
        {images.length === 0 ? (
          <p className="pm-blurb">Every loaded image is close to the size it's shown at. Nice.</p>
        ) : (
          <>
            <ul className="pm-list">
              {images.map((img, i) => (
                <li key={i}>
                  <button
                    className="pm-row pm-row--button"
                    title={`${img.url}\nFile: ${img.natural.w}×${img.natural.h}px${img.shown ? ` · shown at ${img.shown.w}×${img.shown.h} device px` : ' · not shown'}`}
                    onClick={() => {
                      if (!showOnPage) setShowOnPage(true);
                      focusHighlight(img.el);
                    }}
                  >
                    <span className="pm-row__name">{shortUrl(img.url)}</span>
                    <span className="pm-row__tag">{ratioLabel(img)}</span>
                    <span className="pm-row__value">{img.wasted != null ? `~${formatBytes(img.wasted)}` : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="pm-blurb pm-blurb--tiny">
              Size shown is roughly what a right-sized file would save. Click one to find it. Only checks &lt;img&gt;, not CSS backgrounds.
            </p>
            <Toggle emoji="👀" label="Show on page" checked={showOnPage} onChange={setShowOnPage} />
          </>
        )}
      </Section>
    </>
  );
}

const ratioLabel = (i: ImageIssue) => (Number.isFinite(i.ratio) ? `${i.ratio.toFixed(1)}× px` : 'not shown');

function CoverageBlock({ label, side }: { label: string; side: CoverageSide }) {
  if (side.total === 0) return <p className="pm-blurb">No {label} on this page.</p>;
  const pct = percent(side.unused, side.total);
  return (
    <div className="pm-cov">
      <p className="pm-blurb">
        <strong>
          {formatBytes(side.unused)} of {formatBytes(side.total)} {label} never ran ({pct}%)
        </strong>
      </p>
      <div className="pm-bar" role="img" aria-label={`${pct}% unused`}>
        <span className="pm-bar__fill" style={{ width: `${100 - pct}%` }} />
      </div>
      <ul className="pm-list">
        {side.files.slice(0, 6).map((f, i) => (
          <Row key={i} name={shortUrl(f.url)} title={f.url} value={`${formatBytes(f.unused)} unused`} share={percent(f.unused, f.total)} />
        ))}
      </ul>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="pm-sub">
      <div className="pm-sub__head">
        <h4 className="pm-sub__title">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="pm-icon-btn pm-icon-btn--small" title="Refresh" aria-label="Refresh" onClick={onClick}>
      ↻
    </button>
  );
}

function Row({ name, title, tag, value, share }: { name: string; title?: string; tag?: string; value: string; share?: number }) {
  return (
    <li className="pm-row" title={title}>
      {share != null && <span className="pm-row__share" style={{ width: `${share}%` }} aria-hidden="true" />}
      <span className="pm-row__name">{name}</span>
      {tag && <span className="pm-row__tag">{tag}</span>}
      <span className="pm-row__value">{value}</span>
    </li>
  );
}
