import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetOrderStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useMotionPrefs } from "@/hooks/use-motion-prefs";

const SUPER_BUSY_THRESHOLD = 8;
const DISMISS_KEY = "ss_super_busy_dismissed_at";
const DISMISS_TTL_MS = 5 * 60 * 1000;

const MESSAGES = [
  "Lots of people are ordering their favs right now",
  "Our team is mixing as fast as they can",
  "The shop is buzzing — drinks are flying out",
  "Big rush! Cubes are dropping faster than ever",
];

function FloatingCups() {
  const { reduced, lowPower } = useMotionPrefs();
  if (reduced) return null;
  // 14 cups -> 6 on mobile/low-power, 10 on desktop. Keeps 60fps on phones.
  const count = lowPower ? 6 : 10;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-7xl"
          style={{
            left: `${(i * 11 + 3) % 100}vw`,
            top: 0,
            willChange: "transform, opacity",
          }}
          initial={{
            y: "120vh",
            rotate: -15 + (i % 3) * 15,
            opacity: 0,
          }}
          animate={{
            y: "-25vh",
            opacity: [0, 0.85, 0.85, 0],
            rotate: [-15 + (i % 3) * 15, 15 - (i % 3) * 15],
          }}
          transition={{
            duration: 6 + (i % 5),
            delay: i * 0.45,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          🥤
        </motion.div>
      ))}
    </div>
  );
}

function BigBubblingCup() {
  const { reduced, lowPower } = useMotionPrefs();
  const bubbles = reduced
    ? []
    : (lowPower
        ? [
            { x: 50, dur: 2.4, delay: 0, r: 3 },
            { x: 70, dur: 2.6, delay: 0.6, r: 3 },
          ]
        : [
            { x: 38, dur: 2.2, delay: 0, r: 3 },
            { x: 60, dur: 2.6, delay: 0.6, r: 4 },
            { x: 78, dur: 2.4, delay: 1.1, r: 2.5 },
            { x: 50, dur: 1.9, delay: 1.5, r: 3.2 },
            { x: 70, dur: 2.8, delay: 0.3, r: 2.2 },
          ]);
  return (
    <svg viewBox="0 0 120 150" width={260} height={325} role="img" aria-label="Busy">
      <defs>
        <clipPath id="sb-cup-clip">
          <path d="M22 30 L98 30 L90 138 Q60 144 30 138 Z" />
        </clipPath>
        <linearGradient id="sb-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(14 85% 72%)" />
          <stop offset="100%" stopColor="hsl(14 80% 55%)" />
        </linearGradient>
      </defs>

      <g clipPath="url(#sb-cup-clip)">
        <rect x={0} y={45} width={120} height={100} fill="url(#sb-liquid)" />
        {/* Sloshing surface (GPU transform) */}
        {!reduced && (
          <motion.path
            fill="hsl(14 90% 80%)"
            d="M0 50 Q30 44 60 50 T120 50 L120 60 L0 60 Z"
            style={{ willChange: "transform" }}
            animate={{ x: [-6, 6, -6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Bubbles — group transform on y (GPU) */}
        {bubbles.map((b, i) => (
          <motion.g
            key={i}
            style={{ willChange: "transform, opacity" }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, -88], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: b.dur,
              delay: b.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            <circle cx={b.x} cy={138} r={b.r} fill="rgba(255,255,255,0.9)" />
          </motion.g>
        ))}
      </g>

      {/* Cup outline */}
      <path
        d="M22 30 L98 30 L90 138 Q60 144 30 138 Z"
        fill="none"
        stroke="hsl(14 60% 28%)"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <ellipse cx={60} cy={30} rx={38} ry={6} fill="none" stroke="hsl(14 60% 28%)" strokeWidth={3} />

      {/* Striped straw */}
      <motion.g
        style={{ originX: "75px", originY: "35px", willChange: "transform" }}
        animate={reduced ? undefined : { rotate: [-3, 3, -3] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x={70} y={2} width={10} height={40} rx={2} fill="white" stroke="hsl(14 60% 28%)" strokeWidth={2} />
        <rect x={70} y={6} width={10} height={4} fill="hsl(340 78% 65%)" />
        <rect x={70} y={16} width={10} height={4} fill="hsl(340 78% 65%)" />
        <rect x={70} y={26} width={10} height={4} fill="hsl(340 78% 65%)" />
        <rect x={70} y={36} width={10} height={4} fill="hsl(340 78% 65%)" />
      </motion.g>
    </svg>
  );
}

export function SuperBusyOverlay() {
  const { data: stats } = useGetOrderStats({
    query: { refetchInterval: 30000 },
  });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const ts = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
      return ts > 0 && Date.now() - ts < DISMISS_TTL_MS;
    } catch {
      return false;
    }
  });
  const [messageIndex, setMessageIndex] = useState(0);

  const prefs = useMotionPrefs();
  const activeCount = stats ? stats.pendingCount : 0;
  const isSuperBusy = activeCount >= SUPER_BUSY_THRESHOLD;

  useEffect(() => {
    if (!isSuperBusy || dismissed) return;
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 3500);
    return () => clearInterval(id);
  }, [isSuperBusy, dismissed]);

  // If the rush ends, clear the dismissed flag so it can show again later.
  useEffect(() => {
    if (!isSuperBusy && dismissed) {
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setDismissed(false);
    }
  }, [isSuperBusy, dismissed]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const show = isSuperBusy && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="super-busy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-primary/95 via-primary/90 to-secondary/95 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Shop is very busy"
        >
          <FloatingCups />

          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 22 }}
            className="relative z-10 max-w-lg mx-4 text-center text-white px-6 py-8"
          >
            <motion.div
              animate={prefs.reduced ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              className="flex justify-center mb-6"
              style={{ willChange: "transform" }}
            >
              <BigBubblingCup />
            </motion.div>

            <h2 className="text-3xl sm:text-4xl font-bold mb-3 drop-shadow-sm">
              Whew, it's a rush!
            </h2>

            <div className="h-14 flex items-center justify-center mb-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="text-lg sm:text-xl font-medium"
                >
                  {MESSAGES[messageIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="text-white/85 text-sm sm:text-base mb-6">
              {activeCount} drinks in the queue. Orders may take a few extra minutes —
              thanks for your patience!
            </p>

            <Button
              size="lg"
              onClick={handleDismiss}
              className="bg-white text-primary hover:bg-white/90 font-semibold shadow-lg"
            >
              Got it, keep browsing
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
