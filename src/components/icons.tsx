interface IconProps {
  size?: number;
}

type IconName = 'bolt' | 'gear' | 'trophy' | 'book' | 'stopwatch' | 'clock' | 'back' | 'star' | 'check';

function GlossyIcon({ name, size }: IconProps & { name: IconName }) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 2px 0 rgba(0, 0, 0, 0.28))' }}
    >
      <use href={`#g-${name}`} />
    </svg>
  );
}

export const StreakIcon = ({ size = 22 }: IconProps) => <GlossyIcon name="bolt" size={size} />;
export const SettingsIcon = ({ size = 28 }: IconProps) => <GlossyIcon name="gear" size={size} />;
export const TrophyIcon = ({ size = 18 }: IconProps) => <GlossyIcon name="trophy" size={size} />;
/** The shield from icons/shield.svg (served from public/icons), same drop shadow as the sprite icons. */
export const ChallengeIcon = ({ size = 46 }: IconProps) => (
  <img
    src={`${import.meta.env.BASE_URL}icons/shield.svg`}
    alt=""
    aria-hidden="true"
    width={size}
    height={size}
    style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 2px 0 rgba(0, 0, 0, 0.28))' }}
  />
);
export const ArchiveIcon = ({ size = 46 }: IconProps) => <GlossyIcon name="book" size={size} />;
export const StopwatchIcon = ({ size = 22 }: IconProps) => <GlossyIcon name="stopwatch" size={size} />;
export const ClockIcon = ({ size = 18 }: IconProps) => <GlossyIcon name="clock" size={size} />;
export const BackIcon = ({ size = 30 }: IconProps) => <GlossyIcon name="back" size={size} />;
export const StarIcon = ({ size = 60 }: IconProps) => <GlossyIcon name="star" size={size} />;
export const CheckIcon = ({ size = 18 }: IconProps) => <GlossyIcon name="check" size={size} />;

/** Mount once near the app root. Every icon above references a symbol defined here. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gBolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#ff9a14" />
        </linearGradient>
        <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0a0" />
          <stop offset="1" stopColor="#f2a914" />
        </linearGradient>
        <linearGradient id="gGrey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f4f8" />
          <stop offset="1" stopColor="#9aa8b8" />
        </linearGradient>
        <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6df0e6" />
          <stop offset="1" stopColor="#1291a8" />
        </linearGradient>
        <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffae55" />
          <stop offset="1" stopColor="#d4581a" />
        </linearGradient>
        <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b0f264" />
          <stop offset="1" stopColor="#2aa81c" />
        </linearGradient>
        <linearGradient id="gArrow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fb4ff" />
          <stop offset="1" stopColor="#2563d4" />
        </linearGradient>
        <g id="gearS">
          <circle cx="32" cy="32" r="17" />
          <rect x="26" y="5" width="12" height="54" rx="3" />
          <rect x="26" y="5" width="12" height="54" rx="3" transform="rotate(45 32 32)" />
          <rect x="26" y="5" width="12" height="54" rx="3" transform="rotate(90 32 32)" />
          <rect x="26" y="5" width="12" height="54" rx="3" transform="rotate(135 32 32)" />
        </g>
      </defs>

      <symbol id="g-bolt" viewBox="0 0 64 64">
        <path d="M40 4 L12 36 H27 L20 60 L52 24 H36 Z" transform="translate(2 3)" fill="#b85a00" stroke="#b85a00" strokeWidth="4" strokeLinejoin="round" />
        <path d="M40 4 L12 36 H27 L20 60 L52 24 H36 Z" fill="url(#gBolt)" stroke="#c46a00" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" />
        <path d="M37 11 L20 33 H29" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>

      <symbol id="g-gear" viewBox="0 0 64 64">
        <use href="#gearS" fill="#46566b" stroke="#46566b" strokeWidth="6" strokeLinejoin="round" />
        <use href="#gearS" fill="url(#gGrey)" />
        <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" strokeDasharray="20 90" transform="rotate(200 32 32)" />
        <circle cx="32" cy="32" r="7.5" fill="#28364a" stroke="#46566b" strokeWidth="2" />
      </symbol>

      <symbol id="g-trophy" viewBox="0 0 64 64">
        <path d="M17 12H9v7c0 8 5 12 12 13M47 12h8v7c0 8-5 12-12 13" fill="none" stroke="#a86a00" strokeWidth="9" strokeLinecap="round" />
        <path d="M17 12H9v7c0 8 5 12 12 13M47 12h8v7c0 8-5 12-12 13" fill="none" stroke="#f6c02c" strokeWidth="4" strokeLinecap="round" />
        <rect x="26" y="38" width="12" height="12" fill="url(#gGold)" stroke="#a86a00" strokeWidth="3.5" paintOrder="stroke" />
        <rect x="16" y="48" width="32" height="11" rx="3.5" fill="url(#gGold)" stroke="#a86a00" strokeWidth="3.5" paintOrder="stroke" />
        <path d="M14 5h36v17c0 12-8 20-18 20S14 34 14 22z" fill="url(#gGold)" stroke="#a86a00" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke" />
        <path d="M21 11v11c0 6 2 10 5 13" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="3.5" strokeLinecap="round" />
      </symbol>


      <symbol id="g-book" viewBox="0 0 64 64">
        <rect x="15" y="10" width="40" height="48" rx="5" fill="#fff4dc" stroke="#8a3a0c" strokeWidth="3.5" />
        <path d="M12 6h34a4 4 0 0 1 4 4v42a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="url(#gBook)" stroke="#8a3a0c" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke" />
        <path d="M8 10a4 4 0 0 1 4-4h5v50h-5a4 4 0 0 1-4-4z" fill="#a8400e" opacity=".55" />
        <rect x="23" y="15" width="21" height="14" rx="3" fill="#fff4dc" stroke="#8a3a0c" strokeWidth="2" />
        <path d="M27 21h13M27 25h8" stroke="#c4581a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M36 42v15l4.5-3.5L45 57V42z" fill="#e8321f" stroke="#8f1208" strokeWidth="2" strokeLinejoin="round" />
      </symbol>

      <symbol id="g-stopwatch" viewBox="0 0 64 64">
        <rect x="27" y="1.5" width="10" height="8" rx="2.5" fill="#0f6f80" stroke="#0b5060" strokeWidth="2" />
        <circle cx="11" cy="15" r="5.5" fill="#e8523f" stroke="#8f1208" strokeWidth="2.5" />
        <circle cx="32" cy="37" r="25" fill="url(#gTeal)" stroke="#0b5f70" strokeWidth="3.5" />
        <circle cx="32" cy="37" r="17" fill="#f1f7fa" stroke="#0b5f70" strokeWidth="2.5" />
        <path d="M32 24v3M32 47v3M19 37h3M42 37h3" stroke="#8aa0ae" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 37V27" stroke="#2a3b4d" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 37l8 3" stroke="#e8321f" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="37" r="2.6" fill="#2a3b4d" />
        <path d="M14 28a20 20 0 0 1 9-11" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
      </symbol>

      <symbol id="g-clock" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="url(#gGold)" stroke="#a86a00" strokeWidth="3.5" />
        <circle cx="32" cy="32" r="19" fill="#fff4dc" stroke="#a86a00" strokeWidth="2.5" />
        <path d="M32 19v3M32 42v3M19 32h3M42 32h3" stroke="#b8935a" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 32V22" stroke="#3a2a14" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 32l8 5" stroke="#3a2a14" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="32" r="2.4" fill="#3a2a14" />
        <path d="M10 26a23 23 0 0 1 10-13" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
      </symbol>

      <symbol id="g-back" viewBox="0 0 64 64">
        <path d="M30 9 L6 32 L30 55 V42 H58 V22 H30 Z" transform="translate(1.5 3)" fill="#143a8a" stroke="#143a8a" strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 9 L6 32 L30 55 V42 H58 V22 H30 Z" fill="url(#gArrow)" stroke="#1a49a8" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" />
        <path d="M28 15 L13 31 M34 26 H52" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
      </symbol>

      <symbol id="g-star" viewBox="0 0 64 64">
        <path d="M32 4l8.3 17 18.7 2.6-13.6 13 3.4 18.4L32 46.3 15.2 55l3.4-18.4L5 23.6 23.7 21z" fill="url(#gGold)" stroke="#b86a00" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" />
        <path d="M26 17l4-8" stroke="#fff" strokeOpacity=".8" strokeWidth="3.5" strokeLinecap="round" />
      </symbol>

      <symbol id="g-check" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="url(#gGreen)" stroke="#1d7a0f" strokeWidth="3.5" />
        <path d="M18 33l10 10 18-20" fill="none" stroke="#1d7a0f" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 33l10 10 18-20" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 24a21 21 0 0 1 9-10" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
      </symbol>
    </svg>
  );
}
