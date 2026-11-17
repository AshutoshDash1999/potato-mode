// One row of the report card: emoji, a plain-language headline, the number,
// a one-line explanation, and a traffic-light grade.
import type { ReactNode } from 'react';
import { GRADE_FACE, type Grade } from '~/lib/thresholds';

const GRADE_WORD: Record<Grade, string> = { good: 'Good', meh: 'Meh', bad: 'Ouch' };

interface Props {
  emoji: string;
  title: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Omit while still measuring. */
  grade?: Grade;
}

export function MetricCard({ emoji, title, value, detail, grade }: Props) {
  return (
    <div className={`pm-metric${grade ? ` pm-metric--${grade}` : ''}`}>
      <span className="pm-metric__emoji" aria-hidden="true">
        {emoji}
      </span>
      <div className="pm-metric__main">
        <span className="pm-metric__title">{title}</span>
        <span className="pm-metric__value">{value}</span>
        {detail && <span className="pm-metric__detail">{detail}</span>}
      </div>
      {grade && (
        <span className="pm-metric__grade" title={GRADE_WORD[grade]}>
          <span aria-hidden="true">{GRADE_FACE[grade]}</span>
          <span className="pm-metric__grade-word">{GRADE_WORD[grade]}</span>
        </span>
      )}
    </div>
  );
}
