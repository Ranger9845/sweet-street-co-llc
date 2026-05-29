import { useId } from "react";
import { useMotionPrefs } from "@/hooks/use-motion-prefs";

type CupSpinnerProps = {
  size?: number;
  className?: string;
  color?: "primary" | "muted" | "white";
};

const COLORS = {
  primary: {
    liquidA: "hsl(14 92% 72%)",
    liquidB: "hsl(14 80% 48%)",
    waveBack: "hsl(14 86% 58%)",
    waveFront: "hsl(14 95% 75%)",
    outline: "hsl(14 60% 28%)",
    straw: "hsl(340 78% 62%)",
  },
  muted: {
    liquidA: "hsl(14 50% 78%)",
    liquidB: "hsl(14 40% 55%)",
    waveBack: "hsl(14 45% 65%)",
    waveFront: "hsl(14 55% 78%)",
    outline: "hsl(14 35% 45%)",
    straw: "hsl(340 50% 70%)",
  },
  white: {
    liquidA: "rgba(255,255,255,0.9)",
    liquidB: "rgba(255,255,255,0.55)",
    waveBack: "rgba(255,255,255,0.7)",
    waveFront: "rgba(255,255,255,0.95)",
    outline: "rgba(255,255,255,0.95)",
    straw: "rgba(255,255,255,0.85)",
  },
};

/**
 * Compact inline cup loader — drop-in replacement for spinning circles.
 * Uses the same wave technique as BubbleCupLoader, scaled down and simplified.
 */
export function CupSpinner({ size = 24, className = "", color = "primary" }: CupSpinnerProps) {
  const uid = useId().replace(/:/g, "");
  const clip = `cs-clip-${uid}`;
  const grad = `cs-grad-${uid}`;
  const c = COLORS[color];
  const { reduced } = useMotionPrefs();

  return (
    <span className={`liquid-cup-wrap inline-block align-middle ${className}`} style={{ width: size, height: (size * 28) / 24 }}>
    <svg
      viewBox="0 0 24 28"
      width={size}
      height={(size * 28) / 24}
      className="liquid-cup-mini"
      role="img"
      aria-label="Loading"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.liquidA} />
          <stop offset="100%" stopColor={c.liquidB} />
        </linearGradient>
        <clipPath id={clip}>
          <path d="M4 6 L20 6 L18 25 Q12 27 6 25 Z" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="13" width="24" height="14" fill={`url(#${grad})`} />
        {!reduced && (
          <>
            <path
              className="liquid-wave liquid-wave--back"
              d="M-12 13.5 Q-9 12 -6 13.5 T0 13.5 T6 13.5 T12 13.5 T18 13.5 T24 13.5 T30 13.5 T36 13.5 V27 H-12 Z"
              fill={c.waveBack}
              opacity="0.75"
            />
            <path
              className="liquid-wave liquid-wave--front"
              d="M-12 14.2 Q-9 12.7 -6 14.2 T0 14.2 T6 14.2 T12 14.2 T18 14.2 T24 14.2 T30 14.2 T36 14.2 V27 H-12 Z"
              fill={c.waveFront}
              opacity="0.9"
            />
          </>
        )}
      </g>

      {/* Cup outline */}
      <path
        d="M4 6 L20 6 L18 25 Q12 27 6 25 Z"
        fill="none"
        stroke={c.outline}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <ellipse cx={12} cy={6} rx={8} ry={1.4} fill="none" stroke={c.outline} strokeWidth={1.4} />

      {/* Straw with subtle wobble */}
      <g className="liquid-straw">
        <rect
          x={13}
          y={1}
          width={2.2}
          height={8}
          rx={0.6}
          fill={c.straw}
          stroke={c.outline}
          strokeWidth={0.7}
        />
      </g>
    </svg>
    </span>
  );
}

/**
 * Card-shaped placeholder. A faint cup that fills and empties on a smooth loop
 * with a wave surface. Use anywhere `<Card className="animate-pulse" />` was used.
 */
export function CupCardSkeleton({ className = "", height = 160 }: { className?: string; height?: number }) {
  const uid = useId().replace(/:/g, "");
  const clip = `ccs-clip-${uid}`;
  const grad = `ccs-grad-${uid}`;
  const { reduced } = useMotionPrefs();

  return (
    <div
      className={`rounded-xl border border-border/50 bg-white/40 backdrop-blur-sm flex items-center justify-center overflow-hidden ${className}`}
      style={{ height }}
    >
      <span className="liquid-cup-wrap inline-block" style={{ width: 56, height: 75 }}>
      <svg viewBox="0 0 60 80" width={56} height={75} role="img" aria-label="Loading" className="liquid-cup-mini">
        <defs>
          <clipPath id={clip}>
            <path d="M10 18 L50 18 L46 72 Q30 76 14 72 Z" />
          </clipPath>
          <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(14 90% 72%)" />
            <stop offset="100%" stopColor="hsl(14 80% 50%)" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x="0" y="32" width="60" height="44" fill={`url(#${grad})`} />
          {!reduced && (
            <>
              <path
                className="liquid-wave liquid-wave--back"
                d="M-30 33 Q-22.5 30 -15 33 T0 33 T15 33 T30 33 T45 33 T60 33 T75 33 T90 33 V76 H-30 Z"
                fill="hsl(14 86% 58%)"
                opacity="0.7"
              />
              <path
                className="liquid-wave liquid-wave--front"
                d="M-30 35 Q-22.5 32 -15 35 T0 35 T15 35 T30 35 T45 35 T60 35 T75 35 T90 35 V76 H-30 Z"
                fill="hsl(14 95% 75%)"
                opacity="0.9"
              />
            </>
          )}
        </g>
        <path
          d="M10 18 L50 18 L46 72 Q30 76 14 72 Z"
          fill="none"
          stroke="hsl(14 60% 28% / 0.55)"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <ellipse cx={30} cy={18} rx={20} ry={3} fill="none" stroke="hsl(14 60% 28% / 0.55)" strokeWidth={1.8} />
      </svg>
      </span>
    </div>
  );
}
