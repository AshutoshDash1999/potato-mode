// Network and CPU presets.
// Network values follow Chrome DevTools' presets, including DevTools'
// packet-level adjustment factors, so results match what developers see there.

export type NetworkPresetId = 'normal' | 'fast4g' | 'slow3g' | 'offline';
export type CpuPresetId = 1 | 4 | 6;

export interface NetworkPreset {
  id: NetworkPresetId;
  label: string;
  emoji: string;
  blurb: string;
  /** Bytes per second; -1 disables throttling. */
  downloadThroughput: number;
  uploadThroughput: number;
  /** Extra round-trip latency in ms. */
  latency: number;
  offline: boolean;
}

const kbps = (n: number) => (n * 1000) / 8;
const mbps = (n: number) => (n * 1000 * 1000) / 8;

export const NETWORK_PRESETS: Record<NetworkPresetId, NetworkPreset> = {
  normal: {
    id: 'normal',
    label: 'Normal',
    emoji: '🚀',
    blurb: 'Your real connection',
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
    offline: false,
  },
  fast4g: {
    id: 'fast4g',
    label: 'Fast 4G',
    emoji: '🐇',
    blurb: 'Good phone signal',
    downloadThroughput: mbps(9) * 0.9,
    uploadThroughput: mbps(1.5) * 0.9,
    latency: 60 * 2.75,
    offline: false,
  },
  slow3g: {
    id: 'slow3g',
    label: 'Slow 3G',
    emoji: '🐢',
    blurb: 'One bar, on a train',
    downloadThroughput: kbps(500) * 0.8,
    uploadThroughput: kbps(500) * 0.8,
    latency: 400 * 5,
    offline: false,
  },
  offline: {
    id: 'offline',
    label: 'Offline',
    emoji: '🔌',
    blurb: 'No internet at all',
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
    offline: true,
  },
};

export const NETWORK_ORDER: NetworkPresetId[] = ['normal', 'fast4g', 'slow3g', 'offline'];

export interface CpuPreset {
  rate: CpuPresetId;
  label: string;
  blurb: string;
}

export const CPU_PRESETS: CpuPreset[] = [
  { rate: 1, label: '1×', blurb: 'Your computer, full speed' },
  { rate: 4, label: '4×', blurb: '4× slower than your computer' },
  { rate: 6, label: '6×', blurb: '6× slower than your computer' },
];

/** CDP params for Network.emulateNetworkConditions. */
export function networkConditions(id: NetworkPresetId) {
  const p = NETWORK_PRESETS[id];
  return {
    offline: p.offline,
    latency: p.latency,
    downloadThroughput: p.downloadThroughput,
    uploadThroughput: p.uploadThroughput,
  };
}

/** Rough seconds to download `bytes` on a preset (ignores latency and parallelism). */
export function secondsToDownload(bytes: number, id: NetworkPresetId): number | null {
  const p = NETWORK_PRESETS[id];
  if (p.offline || p.downloadThroughput <= 0) return null;
  return bytes / p.downloadThroughput;
}
