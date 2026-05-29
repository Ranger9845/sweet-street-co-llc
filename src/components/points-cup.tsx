import { useEffect, useState, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Sparkles, Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMotionPrefs } from "@/hooks/use-motion-prefs";

const API = "/api";

type Reward = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  discountType: string;
  discountValue: number;
  active: boolean;
};

export function usePointsBalance() {
  const { user } = useUser();
  const [location] = useLocation();
  const [balance, setBalance] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setBalance(null);
      return;
    }
    fetch(`${API}/points/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBalance(d?.balance ?? 0))
      .catch(() => setBalance(0));
  }, [user?.id, refreshKey, location]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("points-updated", handler);
    window.addEventListener("focus", handler);
    return () => {
      window.removeEventListener("points-updated", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  return { balance, refresh: () => setRefreshKey((k) => k + 1) };
}

function CupSvg({ fillPct, className = "", size = 28 }: { fillPct: number; className?: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, fillPct));
  const fillY = 20 + (72 * (100 - pct)) / 100;
  const fillH = 92 - fillY;
  const uid = useId().replace(/:/g, "");
  const gradientId = `cup-soda-${uid}`;
  const clipId = `cup-inside-${uid}`;
  const { reduced, lowPower } = useMotionPrefs();
  const bubbleCount = reduced ? 0 : lowPower ? 2 : 3;
  return (
    <svg
      viewBox="0 0 60 100"
      width={size}
      height={(size * 100) / 60}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(14 85% 72%)" />
          <stop offset="100%" stopColor="hsl(14 80% 55%)" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M10 20 L50 20 L46 92 Q30 96 14 92 Z" />
        </clipPath>
      </defs>
      {/* Liquid */}
      <g clipPath={`url(#${clipId})`}>
        <motion.rect
          x={0}
          width={60}
          initial={false}
          animate={{ y: fillY, height: fillH }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 80, damping: 18 }
          }
          fill={`url(#${gradientId})`}
        />
        {/* bubbles */}
        {pct > 5 &&
          [0, 1, 2].slice(0, bubbleCount).map((i) => (
            <motion.circle
              key={i}
              cx={18 + i * 12}
              r={1.5 + (i % 2) * 0.8}
              fill="rgba(255,255,255,0.6)"
              initial={{ cy: 92 }}
              animate={{ cy: fillY + 6 }}
              transition={{
                duration: 1.6 + i * 0.3,
                repeat: Infinity,
                delay: i * 0.35,
                ease: "easeOut",
              }}
            />
          ))}
      </g>
      {/* Cup outline */}
      <path
        d="M10 20 L50 20 L46 92 Q30 96 14 92 Z"
        fill="none"
        stroke="hsl(14 60% 30%)"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* Rim */}
      <ellipse cx={30} cy={20} rx={20} ry={3.5} fill="none" stroke="hsl(14 60% 30%)" strokeWidth={2.2} />
      {/* Straw */}
      <rect x={32} y={6} width={5} height={22} rx={1.5} fill="hsl(340 75% 65%)" stroke="hsl(14 60% 30%)" strokeWidth={1.2} />
    </svg>
  );
}

function nextRewardInfo(balance: number, rewards: Reward[]) {
  const active = rewards.filter((r) => r.active).sort((a, b) => a.pointsCost - b.pointsCost);
  const next = active.find((r) => r.pointsCost > balance);
  const affordable = active.filter((r) => r.pointsCost <= balance);
  const anchor = next?.pointsCost ?? (active[active.length - 1]?.pointsCost || 100);
  const pct = Math.min(100, (balance / anchor) * 100);
  return { next, affordable, pct };
}

export function PointsCupBadge() {
  const { user, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const { balance } = usePointsBalance();
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    fetch(`${API}/rewards`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRewards)
      .catch(() => {});
  }, []);

  if (!isSignedIn || !user) return null;

  const { pct } = nextRewardInfo(balance ?? 0, rewards);

  return (
    <button
      type="button"
      onClick={() => setLocation("/rewards")}
      className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full bg-gradient-to-r from-primary/10 to-secondary/30 hover:from-primary/20 hover:to-secondary/50 transition-colors border border-primary/20"
      aria-label="View your ice cubes and rewards"
      data-testid="points-cup-badge"
    >
      <CupSvg fillPct={pct} size={22} />
      <span className="text-sm font-bold text-primary-foreground tabular-nums">
        {balance ?? 0}
      </span>
      <span className="hidden sm:inline text-xs text-muted-foreground">cubes</span>
    </button>
  );
}

/** Animated number tween from `from` to `to` */
function useCountUp(from: number, to: number, duration = 1800, trigger: boolean) {
  const [value, setValue] = useState(from);
  const startTs = useRef<number | null>(null);
  useEffect(() => {
    if (!trigger) return;
    startTs.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startTs.current === null) startTs.current = t;
      const elapsed = t - startTs.current;
      const pct = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (pct < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration, trigger]);
  return value;
}

export function PointsEarnedCelebration({
  earned,
  startBalance,
  rewards,
  onClose,
}: {
  earned: number;
  startBalance: number;
  rewards: Reward[];
  onClose: () => void;
}) {
  const endBalance = startBalance + earned;
  const [phase, setPhase] = useState<"pour" | "reveal">("pour");
  const count = useCountUp(startBalance, endBalance, 1800, true);

  const startInfo = nextRewardInfo(startBalance, rewards);
  const endInfo = nextRewardInfo(endBalance, rewards);
  const newlyUnlocked = endInfo.affordable.filter(
    (r) => !startInfo.affordable.some((s) => s.id === r.id),
  );

  // Cup fills from start pct → end pct.
  const [cupPct, setCupPct] = useState(startInfo.pct);
  useEffect(() => {
    const t = setTimeout(() => setCupPct(endInfo.pct), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPhase("reveal"), 2400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="You earned ice cubes"
        className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-10 max-w-md w-full text-center overflow-hidden border border-white/60"
        initial={{ scale: 0.88, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-amber-200/40 pointer-events-none"
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted"
          aria-label="Close"
          data-testid="close-points-celebration"
        >
          <X className="h-5 w-5" />
        </button>

        <motion.h2 className="text-2xl font-serif font-bold text-primary-foreground flex items-center justify-center gap-2 relative z-10" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Sparkles className="h-5 w-5 text-primary" />
          You earned ice cubes!
        </motion.h2>
        <motion.p className="text-muted-foreground text-sm mt-1 relative z-10" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.16 }}>
          Thanks for your order — here's your reward
        </motion.p>

        {/* Cup filling with new ice cubes */}
        <div className="relative my-8 h-60 flex items-end justify-center z-10">
          {/* Cup — slight wiggle as it fills */}
          <motion.div
            className="relative"
            initial={{ scale: 0.9, y: 10 }}
            animate={
              phase === "pour"
                ? { scale: [0.95, 1.02, 1], y: [5, 0, 0] }
                : { scale: 1, y: 0 }
            }
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
              <CupSvg fillPct={cupPct} size={130} />
            </motion.div>
            {/* Floating +N indicator rising from cup */}
            {phase === "pour" && (
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-2 pointer-events-none"
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, -28, -44, -60], scale: [0.6, 1.1, 1, 0.9] }}
                transition={{ duration: 1.6, delay: 1.0, ease: "easeOut", times: [0, 0.2, 0.7, 1] }}
              >
                <span className="text-2xl font-extrabold text-amber-500 drop-shadow-md">
                  +{earned}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Balance */}
        <div className="space-y-1">
          <motion.p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold relative z-10" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            Ice cubes earned
          </motion.p>
          <motion.p
            className="text-4xl font-bold text-primary relative z-10"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.12 }}
          >
            +{earned}
          </motion.p>
          <motion.p className="text-sm text-muted-foreground relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
            Balance:{" "}
            <span className="font-bold text-primary-foreground tabular-nums">
              {count}
            </span>{" "}
            cubes
          </motion.p>
        </div>

        {/* Progress toward next reward */}
        {endInfo.next && (
          <motion.div className="mt-6 bg-muted/40 rounded-lg p-3 text-left relative z-10" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">
                Next: {endInfo.next.name}
              </span>
              <span className="font-bold text-primary-foreground tabular-nums">
                {endBalance}/{endInfo.next.pointsCost} cubes
              </span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-amber-400"
                initial={{ width: `${startInfo.pct}%` }}
                animate={{ width: `${endInfo.pct}%` }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
              />
            </div>
          </motion.div>
        )}

        {/* Unlocked reward */}
        <AnimatePresence>
          {phase === "reveal" && newlyUnlocked.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16 }}
              className="mt-5 bg-gradient-to-r from-primary/15 to-amber-200/40 border-2 border-primary/30 rounded-xl p-4 shadow-lg relative z-10"
            >
              <div className="flex items-center justify-center gap-2 text-primary font-bold">
                <Gift className="h-5 w-5" />
                <span className="text-sm uppercase tracking-wider">
                  Reward Unlocked!
                </span>
              </div>
              <p className="font-serif font-bold text-lg mt-1 text-primary-foreground">
                {newlyUnlocked[0].name}
              </p>
              {newlyUnlocked[0].description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {newlyUnlocked[0].description}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          className="w-full mt-6"
          onClick={onClose}
          data-testid="dismiss-points-celebration"
        >
          Sweet!
        </Button>
      </motion.div>
    </motion.div>
  );
}
