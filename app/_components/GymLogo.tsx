"use client";

type GymLogoProps = {
  className?: string;
  size?: number;
};

export function GymLogo({ className = "", size = 200 }: GymLogoProps) {
  const scale = size / 200;

  return (
    <svg
      viewBox="0 0 200 120"
      width={200 * scale}
      height={120 * scale}
      className={className}
      aria-label="Body Xtreme Gym"
    >
      {/* Barbell icon */}
      <g transform="translate(70, 4)">
        {/* Left weight plate */}
        <rect x="8" y="2" width="10" height="28" rx="3" fill="var(--brand-green)" />
        {/* Right weight plate */}
        <rect x="42" y="2" width="10" height="28" rx="3" fill="var(--brand-green)" />
        {/* Bar */}
        <rect x="16" y="12" width="28" height="8" rx="2" fill="var(--brand-green)" />
        {/* Bar lines */}
        <line x1="20" y1="14" x2="20" y2="18" stroke="#020617" strokeWidth="1" />
        <line x1="24" y1="14" x2="24" y2="18" stroke="#020617" strokeWidth="1" />
        <line x1="36" y1="14" x2="36" y2="18" stroke="#020617" strokeWidth="1" />
        <line x1="40" y1="14" x2="40" y2="18" stroke="#020617" strokeWidth="1" />
      </g>

      {/* BODY text */}
      <text
        x="100"
        y="58"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Arial Black, sans-serif"
        fontWeight="900"
        fontSize="26"
        letterSpacing="2"
      >
        BODY
      </text>

      {/* XTREME text */}
      <text
        x="100"
        y="82"
        textAnchor="middle"
        fill="var(--brand-green)"
        fontFamily="Arial Black, sans-serif"
        fontWeight="900"
        fontSize="22"
        letterSpacing="3"
      >
        XTREME
      </text>

      {/* GYM text */}
      <text
        x="160"
        y="82"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Arial Black, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="11"
        letterSpacing="1"
      >
        GYM
      </text>

      {/* Slogan */}
      <text
        x="100"
        y="102"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
        fontWeight="600"
        fontSize="8"
        letterSpacing="1.5"
      >
        EMPIEZA EL CAMBIO!!!!
      </text>
    </svg>
  );
}
