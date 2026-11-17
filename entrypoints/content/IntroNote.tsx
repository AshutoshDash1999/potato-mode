// One-time note explaining Chrome's yellow "started debugging" bar,
// shown the first time Potato Mode is switched on, until dismissed.
import { useEffect, useState } from 'react';

const SEEN_KEY = 'introSeen';

export function IntroNote() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void browser.storage.local
      .get(SEEN_KEY)
      .then((res) => !cancelled && setShow(!res[SEEN_KEY]))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    void browser.storage.local.set({ [SEEN_KEY]: true });
  };

  return (
    <div className="pm-speech pm-intro" role="note">
      <p>
        <strong>Hi, I'm Spud!</strong> I make this page behave like it's on a slow phone or a bad connection.
      </p>
      <p>
        See the <span className="pm-intro__bar">yellow bar</span> at the top of Chrome? That's how Chrome tells you I'm
        allowed to slow pages down. It goes away when you turn me off. Pressing <em>Cancel</em> there unplugs me.
      </p>
      <button className="pm-btn pm-btn--small" onClick={dismiss}>
        Got it! 👍
      </button>
    </div>
  );
}
