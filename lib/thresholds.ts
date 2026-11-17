// Simple good / meh / bad grading for the report card.
// Loosely based on Core Web Vitals and Lighthouse guidance, rounded for humans.

export type Grade = 'good' | 'meh' | 'bad';

export const GRADE_FACE: Record<Grade, string> = {
  good: '🟢',
  meh: '🟡',
  bad: '🔴',
};

const grade = (value: number, good: number, meh: number): Grade =>
  value <= good ? 'good' : value <= meh ? 'meh' : 'bad';

const KB = 1024;

/** JavaScript downloaded (compressed bytes over the wire). */
export const gradeJsBytes = (bytes: number) => grade(bytes, 300 * KB, 1024 * KB);

/** Time until the load event, in ms. */
export const gradeLoadTime = (ms: number) => grade(ms, 3000, 6000);

/** Largest contentful paint, in ms. */
export const gradeLcp = (ms: number) => grade(ms, 2500, 4000);

/** Longest single long task, in ms. Anything over 50 ms is a "freeze". */
export const gradeLongestTask = (ms: number) => grade(ms, 50, 200);

/** Total blocked time beyond 50 ms per task, in ms. */
export const gradeBlockedTime = (ms: number) => grade(ms, 200, 600);

/** Cumulative Layout Shift (unitless). */
export const gradeCls = (score: number) => grade(score, 0.1, 0.25);

/** Interaction to Next Paint, in ms. */
export const gradeInp = (ms: number) => grade(ms, 200, 500);

/** Time to first byte, in ms. */
export const gradeTtfb = (ms: number) => grade(ms, 800, 1800);

/** Total Blocking Time, in ms. */
export const gradeTbt = (ms: number) => grade(ms, 200, 600);

/** DOM elements on the page. */
export const gradeDomNodes = (n: number) => grade(n, 800, 1500);

export const LONG_TASK_MS = 50;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${Math.round(bytes / KB)} KB`;
  return `${(bytes / KB / KB).toFixed(1)} MB`;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
