// Count JavaScript downloaded per tab from CDP network events.
// Uses the debugger session we already hold, so cross-origin scripts are
// measured exactly (Resource Timing would report 0 bytes for most of them).
import type { JsBytes } from './messages';

interface Tally {
  /** False until we've watched a page load from its start (attaching mid-page misses scripts). */
  sawNavigation: boolean;
  /** In-flight script requests → decoded bytes received so far (fallback size). */
  scriptRequests: Map<string, number>;
  bytes: number;
  count: number;
}

const tallies = new Map<number, Tally>();

function fresh(sawNavigation = false): Tally {
  return { sawNavigation, scriptRequests: new Map(), bytes: 0, count: 0 };
}

function tallyFor(tabId: number): Tally {
  let t = tallies.get(tabId);
  if (!t) tallies.set(tabId, (t = fresh()));
  return t;
}

/**
 * Feed a CDP event. Returns true if the JS total changed.
 * Reset happens when the main frame commits a new document.
 */
export function onCdpEvent(tabId: number, method: string, params: any): boolean {
  switch (method) {
    case 'Page.frameNavigated':
      if (!params?.frame?.parentId) {
        tallies.set(tabId, fresh(true));
        return true;
      }
      return false;
    case 'Network.responseReceived':
      if (params?.type === 'Script') tallyFor(tabId).scriptRequests.set(params.requestId, 0);
      return false;
    case 'Network.dataReceived': {
      const reqs = tallyFor(tabId).scriptRequests;
      const sofar = reqs.get(params?.requestId);
      if (sofar != null) reqs.set(params.requestId, sofar + Math.max(0, params.dataLength ?? 0));
      return false;
    }
    case 'Network.loadingFinished': {
      const t = tallyFor(tabId);
      const decoded = t.scriptRequests.get(params?.requestId);
      if (decoded == null) return false;
      t.scriptRequests.delete(params.requestId);
      // Cache and service-worker hits report 0 bytes on the wire; use the
      // decoded size so the script still counts toward the total.
      const encoded = Math.max(0, params.encodedDataLength ?? 0);
      t.bytes += encoded > 0 ? encoded : decoded;
      t.count += 1;
      return t.sawNavigation;
    }
    case 'Network.loadingFailed':
      tallyFor(tabId).scriptRequests.delete(params?.requestId);
      return false;
    default:
      return false;
  }
}

/** Null until a full page load has been observed. */
export function getJsBytes(tabId: number): JsBytes | null {
  const t = tallyFor(tabId);
  return t.sawNavigation ? { bytes: t.bytes, count: t.count } : null;
}

export function forgetTab(tabId: number) {
  tallies.delete(tabId);
}
