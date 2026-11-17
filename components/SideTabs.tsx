// Diary-style index tabs that stick out of the panel's left edge.
import { useRef, type KeyboardEvent } from 'react';

export interface SideTab<T extends string> {
  value: T;
  emoji: string;
  label: string;
}

interface Props<T extends string> {
  label: string;
  idPrefix: string;
  value: T;
  tabs: SideTab<T>[];
  onChange: (value: T) => void;
}

export const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
export const panelId = (prefix: string) => `${prefix}-tabpanel`;

export function SideTabs<T extends string>({ label, idPrefix, value, tabs, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowDown') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    const target = tabs[next];
    if (!target) return;
    e.preventDefault();
    onChange(target.value);
    refs.current[next]?.focus();
  };

  return (
    <div className="pm-tabs" role="tablist" aria-orientation="vertical" aria-label={label}>
      {tabs.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(idPrefix, t.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix)}
            aria-label={t.label}
            tabIndex={selected ? 0 : -1}
            className={`pm-tab${selected ? ' is-selected' : ''}`}
            onClick={() => !selected && onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span aria-hidden="true">{t.emoji}</span>
            <span className="pm-tab__tip" aria-hidden="true">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
