// Spud, the Potato Mode mascot. The face changes with how "potato" the page is.

export type PotatoMood = 'happy' | 'sweaty' | 'dizzy' | 'sleepy' | 'sad';

interface Props {
  mood?: PotatoMood;
  size?: number;
  title?: string;
}

const INK = '#2b2118';

function Eyes({ mood }: { mood: PotatoMood }) {
  switch (mood) {
    case 'sleepy':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M30 46 q6 5 12 0" />
          <path d="M58 46 q6 5 12 0" />
        </g>
      );
    case 'dizzy':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round">
          <path d="M31 40 l10 10 M41 40 l-10 10" />
          <path d="M59 40 l10 10 M69 40 l-10 10" />
        </g>
      );
    case 'sad':
      return (
        <g fill={INK}>
          <circle cx="36" cy="46" r="5" />
          <circle cx="64" cy="46" r="5" />
          <path d="M28 37 l12 -4" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M72 37 l-12 -4" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="36" cy="45" r="6.5" fill={INK} />
          <circle cx="64" cy="45" r="6.5" fill={INK} />
          <circle cx="38.5" cy="42.5" r="2.2" fill="#fff" />
          <circle cx="66.5" cy="42.5" r="2.2" fill="#fff" />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: PotatoMood }) {
  const common = { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'sweaty':
      return <path d="M40 66 q5 -4 10 0 q5 4 10 0" {...common} />;
    case 'dizzy':
      return <ellipse cx="50" cy="66" rx="6" ry="7" fill={INK} />;
    case 'sleepy':
      return <path d="M44 66 h12" {...common} />;
    case 'sad':
      return <path d="M40 70 q10 -9 20 0" {...common} />;
    default:
      return <path d="M39 62 q11 11 22 0" {...common} />;
  }
}

export function Potato({ mood = 'happy', size = 48, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? `Spud the potato, feeling ${mood}`}
      className={`pm-potato pm-potato--${mood}`}
    >
      {/* body */}
      <path
        d="M50 6 C76 4 92 24 91 50 C90 78 74 95 49 94 C24 93 8 78 9 51 C10 24 25 7 50 6 Z"
        fill="#e8b86b"
        stroke={INK}
        strokeWidth="5"
      />
      {/* spots */}
      <circle cx="72" cy="22" r="3" fill="#c98f45" />
      <circle cx="24" cy="28" r="2.5" fill="#c98f45" />
      <circle cx="44" cy="84" r="3" fill="#c98f45" />
      {/* cheeks */}
      {mood !== 'sad' && (
        <g fill="#ff8f7d" opacity="0.7">
          <ellipse cx="24" cy="58" rx="6" ry="4" />
          <ellipse cx="76" cy="58" rx="6" ry="4" />
        </g>
      )}
      <Eyes mood={mood} />
      <Mouth mood={mood} />
      {mood === 'sweaty' && (
        <path d="M82 30 q5 8 0 12 q-5 -4 0 -12 Z" fill="#7cc7ff" stroke={INK} strokeWidth="2.5" />
      )}
      {mood === 'sleepy' && (
        <text x="74" y="22" fontSize="16" fontWeight="700" fill={INK}>
          z
        </text>
      )}
    </svg>
  );
}
