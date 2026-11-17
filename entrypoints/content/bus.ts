// Tiny event bus so the React panel can hear background events
// received by the content script's runtime.onMessage listener.
import type { BackgroundEvent } from '~/lib/messages';

type Listener = (ev: BackgroundEvent) => void;
const listeners = new Set<Listener>();

export const bus = {
  emit(ev: BackgroundEvent) {
    listeners.forEach((l) => l(ev));
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
