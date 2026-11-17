import { useEffect, useState } from 'react';
import type { PageSnapshot } from '~/lib/state';
import { afterLoad, judgeWithoutJs, type JsVerdict } from './snapshot';

const COPY: Record<JsVerdict['grade'], { face: string; title: string; body: string }> = {
  works: {
    face: '🎉',
    title: 'Still works without JavaScript!',
    body: 'The content is all here. Links and forms will mostly work too, just without the fancy extras.',
  },
  partial: {
    face: '🤔',
    title: 'Half-baked without JavaScript',
    body: 'Some content showed up, but parts of the page depend on JavaScript to appear or work.',
  },
  broken: {
    face: '🫠',
    title: 'This site needs JavaScript',
    body: "Without it you get an empty or broken page. On a slow phone, that's what people stare at until all the JS arrives.",
  },
};

export function JsVerdictBox({ before }: { before: PageSnapshot | null }) {
  const [verdict, setVerdict] = useState<JsVerdict | null>(null);

  useEffect(() => {
    if (!before) return;
    let cancelled = false;
    void afterLoad().then(() => !cancelled && setVerdict(judgeWithoutJs(before)));
    return () => {
      cancelled = true;
    };
  }, [before]);

  if (!before) {
    return <p className="pm-blurb">JavaScript is off for this site. Look around: what still works?</p>;
  }
  if (!verdict) return <p className="pm-blurb">Spud is checking what survived…</p>;

  const c = COPY[verdict.grade];
  return (
    <div className={`pm-verdict pm-verdict--${verdict.grade}`} role="status">
      <span className="pm-verdict__face" aria-hidden="true">
        {c.face}
      </span>
      <div>
        <strong>{c.title}</strong>
        <p>
          {c.body} <span className="pm-verdict__stat">{verdict.textPercent}% of the text is still visible.</span>
        </p>
      </div>
    </div>
  );
}
