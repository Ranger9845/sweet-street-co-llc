import { useId, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMotionPrefs } from "@/hooks/use-motion-prefs";

type Props = {
  size?: number;
  onComplete?: () => void;
  durationMs?: number;
};

// Phase boundaries as fractions of the total duration.
// 0 ─ cup ─ 0.12 ─ ice ─ 0.32 ─ pour ─ 0.58 ─ stir ─ 0.88 ─ straw ─ 0.97 ─ done
const PHASES = {
  iceStart: 0.12,
  iceEnd: 0.32,
  pourStart: 0.32,
  pourEnd: 0.58,
  stirStart: 0.58,
  stirEnd: 0.88,
  strawStart: 0.88,
  strawEnd: 0.97,
};

const STEP_LABELS: { at: number; label: string }[] = [
  { at: 0, label: "Grabbing a fresh cup…" },
  { at: PHASES.iceStart, label: "Adding ice cubes…" },
  { at: PHASES.pourStart, label: "Pouring your soda…" },
  { at: PHASES.stirStart, label: "Stirring it all together…" },
  { at: PHASES.strawStart, label: "Adding the straw…" },
  { at: 0.97, label: "Almost ready!" },
];

export function DrinkMaking({ size = 220, onComplete, durationMs = 12000 }: Props) {
  const uid = useId().replace(/:/g, "");
  const clipId = `dm-clip-${uid}`;
  const liquidGrad = `dm-liq-${uid}`;
  const foamGrad = `dm-foam-${uid}`;
  const { reduced, lowPower } = useMotionPrefs();
  // Shorten the animation on phones / reduced-motion so people don't wait.
  const effectiveDuration = reduced ? 1500 : lowPower ? Math.min(durationMs, 8000) : durationMs;
  const height = (size * 110) / 100;
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timers = STEP_LABELS.map((s, i) =>
      window.setTimeout(() => setStepIdx(i), s.at * effectiveDuration),
    );
    const done = window.setTimeout(() => onComplete?.(), effectiveDuration);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDuration]);

  const t = effectiveDuration / 1000; // seconds

  // Ice cubes: 5 desktop -> 3 mobile -> 0 reduced-motion. Less SVG paint work on phones.
  const allIceCubes = [
    { startX: 32, restX: 32, restY: 84, rot: -8, delay: 0 },
    { startX: 50, restX: 48, restY: 80, rot: 6, delay: 0.18 },
    { startX: 66, restX: 64, restY: 86, rot: -3, delay: 0.36 },
    { startX: 40, restX: 40, restY: 70, rot: 12, delay: 0.55 },
    { startX: 58, restX: 58, restY: 72, rot: -10, delay: 0.72 },
  ];
  const iceCubes = reduced ? [] : lowPower ? allIceCubes.slice(0, 3) : allIceCubes;
  // Bubble count similarly trimmed.
  const allBubbles = [
    { x: 30, r: 1.6, dur: 1.4, delay: 0 },
    { x: 42, r: 2.0, dur: 1.7, delay: 0.3 },
    { x: 56, r: 1.4, dur: 1.5, delay: 0.6 },
    { x: 70, r: 1.8, dur: 1.6, delay: 0.15 },
    { x: 38, r: 1.2, dur: 1.3, delay: 0.5 },
    { x: 64, r: 1.5, dur: 1.8, delay: 0.8 },
  ];
  const bubblesData = reduced ? [] : lowPower ? allBubbles.slice(0, 3) : allBubbles;
  const fizzCount = reduced ? 0 : lowPower ? 2 : 4;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 100 110"
        width={size}
        height={height}
        aria-label="Making your drink"
        role="img"
      >
        <defs>
          <linearGradient id={liquidGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(14 90% 70%)" />
            <stop offset="100%" stopColor="hsl(8 80% 48%)" />
          </linearGradient>
          <linearGradient id={foamGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d="M22 30 L78 30 L72 100 Q50 104 28 100 Z" />
          </clipPath>
        </defs>

        {/* Pour stream from above (visible during pour phase) */}
        <motion.rect
          x={47}
          width={6}
          rx={2}
          fill={`url(#${liquidGrad})`}
          initial={{ y: -30, height: 0, opacity: 0 }}
          animate={{
            y: [-30, 8, 8, 8],
            height: [0, 22, 22, 0],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: (PHASES.pourEnd - PHASES.pourStart) * t + 0.3,
            delay: PHASES.pourStart * t,
            times: [0, 0.15, 0.85, 1],
            ease: "easeInOut",
          }}
        />

        {/* Cup interior content */}
        <g clipPath={`url(#${clipId})`}>
          {/* Liquid level rises during pour, then sloshes during stir */}
          <motion.rect
            x={0}
            width={100}
            fill={`url(#${liquidGrad})`}
            initial={{ y: 100, height: 0 }}
            animate={{
              y: [100, 100, 42, 42, 42],
              height: [0, 0, 60, 60, 60],
            }}
            transition={{
              duration: t,
              times: [
                0,
                PHASES.pourStart,
                PHASES.pourEnd,
                PHASES.strawStart,
                1,
              ],
              ease: "easeInOut",
            }}
          />

          {/* Foam — appears after pour, sloshes during stir */}
          <motion.ellipse
            cx={50}
            rx={28}
            ry={2.6}
            fill={`url(#${foamGrad})`}
            initial={{ cy: 100, opacity: 0 }}
            animate={{
              cy: [100, 100, 44, 41, 47, 41, 47, 44],
              opacity: [0, 0, 1, 1, 1, 1, 1, 1],
            }}
            transition={{
              duration: t,
              times: [
                0,
                PHASES.pourStart,
                PHASES.pourEnd,
                PHASES.stirStart + 0.06,
                PHASES.stirStart + 0.14,
                PHASES.stirStart + 0.22,
                PHASES.stirStart + 0.3,
                PHASES.stirEnd,
              ],
              ease: "easeInOut",
            }}
          />

          {/* Ice cubes — drop in during ice phase, then settle and stay */}
          {iceCubes.map((c, i) => {
            const dropDuration = 0.55;
            const start = PHASES.iceStart * t + c.delay;
            return (
              <motion.g
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{
                  duration: t,
                  times: [0, start / t, (start + 0.05) / t, 1],
                }}
              >
                <motion.g
                  initial={{ y: -50, rotate: c.rot - 30 }}
                  animate={{
                    y: [-50, c.restY - 60, c.restY - 60],
                    rotate: [c.rot - 30, c.rot, c.rot],
                  }}
                  transition={{
                    duration: t,
                    delay: 0,
                    times: [0, (start + dropDuration) / t, 1],
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={{ transformOrigin: `${c.restX}px 60px` }}
                >
                  <rect
                    x={c.restX - 6}
                    y={54}
                    width={12}
                    height={12}
                    rx={2}
                    fill="rgba(200,235,255,0.85)"
                    stroke="rgba(120,170,210,0.7)"
                    strokeWidth={0.8}
                  />
                  <rect
                    x={c.restX - 4}
                    y={56}
                    width={4}
                    height={4}
                    rx={1}
                    fill="rgba(255,255,255,0.7)"
                  />
                </motion.g>
              </motion.g>
            );
          })}

          {/* Bubbles after the pour */}
          {bubblesData.map((b, i) => {
            const startSec = PHASES.pourEnd * t + b.delay;
            const window = t - startSec - 0.2;
            return (
              <motion.circle
                key={`bub-${i}`}
                cx={b.x}
                r={b.r}
                fill="rgba(255,255,255,0.85)"
                initial={{ cy: 100, opacity: 0 }}
                animate={{ cy: [100, 95, 50], opacity: [0, 1, 0] }}
                transition={{
                  duration: 1.6,
                  delay: startSec,
                  repeat: Math.max(0, Math.floor(window / 1.6)),
                  ease: "easeOut",
                }}
              />
            );
          })}
        </g>

        {/* Cup outline */}
        <path
          d="M22 30 L78 30 L72 100 Q50 104 28 100 Z"
          fill="none"
          stroke="hsl(14 60% 28%)"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        {/* Rim */}
        <ellipse
          cx={50}
          cy={30}
          rx={28}
          ry={4}
          fill="rgba(255,255,255,0.6)"
          stroke="hsl(14 60% 28%)"
          strokeWidth={2.4}
        />

        {/* Straw — drops in after the stir */}
        <motion.g
          initial={{ y: -50, opacity: 0, rotate: 12 }}
          animate={{ y: 0, opacity: 1, rotate: 12 }}
          transition={{
            duration: 0.45,
            delay: PHASES.strawStart * t,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{ transformOrigin: "58px 30px" }}
        >
          <rect
            x={55}
            y={6}
            width={6}
            height={42}
            rx={2}
            fill="hsl(340 78% 65%)"
            stroke="hsl(14 60% 28%)"
            strokeWidth={1.2}
          />
          <rect x={55} y={14} width={6} height={3} fill="rgba(255,255,255,0.65)" />
          <rect x={55} y={26} width={6} height={3} fill="rgba(255,255,255,0.65)" />
          <rect x={55} y={38} width={6} height={3} fill="rgba(255,255,255,0.65)" />
        </motion.g>

        {/* Escaping fizz once the drink starts coming together */}
        {Array.from({ length: fizzCount }, (_, i) => i).map((i) => (
          <motion.circle
            key={`fizz-${i}`}
            cx={32 + i * 10}
            r={1.3}
            fill="rgba(255,255,255,0.75)"
            initial={{ cy: 30, opacity: 0 }}
            animate={{ cy: [30, 12], opacity: [0, 0.85, 0] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              delay: PHASES.pourEnd * t + i * 0.25,
              ease: "easeOut",
            }}
          />
        ))}
      </svg>

      {/* Step label with crossfade */}
      <div className="h-6 relative w-full max-w-[280px] text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="text-sm font-medium text-muted-foreground absolute inset-0"
          >
            {STEP_LABELS[stepIdx]?.label}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress bar (uses transform: scaleX for GPU instead of width which triggers layout) */}
      <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full bg-primary origin-left"
          style={{ width: "100%", willChange: "transform" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: effectiveDuration / 1000, ease: "linear" }}
        />
      </div>
    </div>
  );
}
