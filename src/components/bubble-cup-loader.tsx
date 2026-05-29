import { useId } from "react";
import { useMotionPrefs } from "@/hooks/use-motion-prefs";

type Props = {
  size?: number;
  message?: string;
  className?: string;
};

/**
 * Realistic soda-cup loader.
 * Pure CSS keyframes drive a parallax pair of SVG wave paths for a smooth,
 * continuous liquid surface, plus rising bubbles, escaping fizz, and a subtle
 * straw wobble. All animations are pure transforms on the GPU — no per-frame
 * React re-renders.
 */
export function BubbleCupLoader({ size = 84, message, className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const clipId = `bcl-clip-${uid}`;
  const liqId = `bcl-liq-${uid}`;
  const glassId = `bcl-glass-${uid}`;
  const sheenId = `bcl-sheen-${uid}`;
  const height = (size * 130) / 100;
  const { reduced, lowPower } = useMotionPrefs();

  // Bubble configs — radius and delay vary so they feel natural.
  const allBubbles = [
    { x: 24, r: 1.6, delay: "0s", dur: "2.8s" },
    { x: 38, r: 2.2, delay: "0.5s", dur: "3.2s" },
    { x: 50, r: 1.4, delay: "1.1s", dur: "2.4s" },
    { x: 66, r: 2.0, delay: "0.2s", dur: "3.4s" },
    { x: 80, r: 1.2, delay: "1.6s", dur: "2.7s" },
    { x: 92, r: 1.7, delay: "0.9s", dur: "3.0s" },
  ];
  const bubbles = reduced ? [] : lowPower ? allBubbles.slice(0, 3) : allBubbles;
  const fizz = reduced ? [] : lowPower ? [0, 1] : [0, 1, 2];

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="liquid-cup-wrap" style={{ width: size, height }}>
        <svg
          viewBox="0 0 120 160"
          width={size}
          height={height}
          aria-label="Loading"
          role="img"
          className="liquid-cup"
        >
        <defs>
          <linearGradient id={liqId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(14 92% 72%)" />
            <stop offset="55%" stopColor="hsl(14 86% 58%)" />
            <stop offset="100%" stopColor="hsl(14 78% 42%)" />
          </linearGradient>
          <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.28)" />
          </linearGradient>
          <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d="M22 30 H98 L92 148 Q60 156 28 148 Z" />
          </clipPath>
        </defs>

        {/* Glass body fill (subtle gradient for depth) */}
        <path d="M22 30 H98 L92 148 Q60 156 28 148 Z" fill={`url(#${glassId})`} />

        {/* Liquid + waves clipped to the cup interior */}
        <g clipPath={`url(#${clipId})`}>
          {/* base liquid */}
          <rect x="0" y="68" width="120" height="100" fill={`url(#${liqId})`} />

          {/* Back wave — slow, darker */}
          <path
            className="liquid-wave liquid-wave--back"
            d="M-60 70 Q-45 64 -30 70 T0 70 T30 70 T60 70 T90 70 T120 70 T150 70 T180 70 V160 H-60 Z"
            fill="hsl(14 88% 60%)"
            opacity="0.7"
          />
          {/* Front wave — faster bob, brighter */}
          <path
            className="liquid-wave liquid-wave--front"
            d="M-60 73 Q-45 67 -30 73 T0 73 T30 73 T60 73 T90 73 T120 73 T150 73 T180 73 V160 H-60 Z"
            fill="hsl(14 95% 75%)"
            opacity="0.85"
          />

          {/* Foam meniscus highlight */}
          <ellipse
            className="liquid-meniscus"
            cx="60"
            cy="71"
            rx="34"
            ry="2.2"
            fill={`url(#${sheenId})`}
          />

          {/* Rising bubbles */}
          {bubbles.map((b, i) => (
            <circle
              key={i}
              className="liquid-bubble"
              cx={b.x}
              cy="148"
              r={b.r}
              fill="rgba(255,255,255,0.92)"
              style={{
                animationDelay: b.delay,
                animationDuration: b.dur,
              }}
            />
          ))}
        </g>

        {/* Glass highlight stripe */}
        <path
          d="M30 38 Q26 92 34 144"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M86 40 Q90 90 84 142"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />

        {/* Cup outline */}
        <path
          d="M22 30 H98 L92 148 Q60 156 28 148 Z"
          fill="none"
          stroke="hsl(14 50% 26%)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Rim */}
        <ellipse
          cx="60"
          cy="30"
          rx="38"
          ry="6"
          fill="rgba(255,255,255,0.22)"
          stroke="hsl(14 50% 26%)"
          strokeWidth="2.4"
        />

        {/* Straw with subtle wobble */}
        <g className="liquid-straw">
          <rect
            x="68"
            y="6"
            width="7"
            height="36"
            rx="2"
            fill="hsl(340 78% 62%)"
            stroke="hsl(14 50% 26%)"
            strokeWidth="1.4"
          />
          <rect
            x="69.5"
            y="8"
            width="1.6"
            height="32"
            rx="0.8"
            fill="rgba(255,255,255,0.55)"
          />
        </g>

        {/* Escaping fizz above the rim */}
        {fizz.map((i) => (
          <circle
            key={`f-${i}`}
            className="liquid-fizz"
            cx={36 + i * 14}
            cy="28"
            r="1.4"
            fill="rgba(255,255,255,0.85)"
            style={{ animationDelay: `${i * 0.55}s` }}
          />
        ))}
        </svg>
        <span className="liquid-cup-shimmer" aria-hidden="true" />
      </div>

      {message && (
        <p className="liquid-loader-msg text-sm font-medium text-muted-foreground text-center max-w-xs">
          {message}
        </p>
      )}
    </div>
  );
}
