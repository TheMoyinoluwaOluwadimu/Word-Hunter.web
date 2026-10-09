import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

function Svg({ size, children, strokeWidth = 2 }: IconProps & { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export const BackIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);

export const SettingsIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const TrophyIcon = ({ size = 11 }: IconProps) => (
  <Svg size={size} strokeWidth={2.2}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3" />
  </Svg>
);

export const ClockIcon = ({ size = 12 }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const ArchiveIcon = ({ size = 11 }: IconProps) => (
  <Svg size={size}>
    <path d="M4 4h16v4H4zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
  </Svg>
);

export const BarsIcon = ({ size = 11 }: IconProps) => (
  <Svg size={size}>
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </Svg>
);

export const CheckIcon = ({ size = 11 }: IconProps) => (
  <Svg size={size} strokeWidth={2.2}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);
