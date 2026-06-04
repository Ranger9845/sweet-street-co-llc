import { useListMenuItems, useGetSettings, useGetOrderStats } from "@workspace/api-client-react";
import { ModifierPicker } from "@/components/modifier-picker";
import type { SelectedModifier } from "@/components/cart-provider";
import { isDevMode } from "@/components/dev-mode-panel";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart, getItemPrice, formatSize, type DrinkSize, type DrinkTemp } from "@/components/cart-provider";
import { useCartFly } from "@/components/cart-fly";
import { BubbleCupLoader } from "@/components/bubble-cup-loader";
import { DrinkMaking } from "@/components/drink-making";
import { CupCardSkeleton } from "@/components/cup-spinner";
import { Plus, Minus, Info, Heart, Megaphone, XCircle, Snowflake, Flame, Thermometer, Zap, Clock, Sparkles, Star, ArrowUpDown, Send, CheckCircle, Search, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser, Show } from "@clerk/react";
import { AnimatePresence, motion, useMotionValue, useTransform, useScroll, useSpring, animate } from "framer-motion";
import { usePlatform, type Platform } from "@/hooks/use-platform";
import { useAnimationConfig, type AnimCfg } from "@/hooks/use-animation-config";
import { useColorOverrides } from "@/hooks/use-color-overrides";

type Favorite = { id: number; menuItemId: number; createdAt: string };

/**
 * ScrollStackCard — platform-adaptive card entrance animation.
 *
 * iOS    → Apple spring: fast settle (stiffness 320, damping 28), subtle
 *          scale 0.92→1 + y 26px→0, whileTap press-feedback at 0.97.
 *          Uses whileInView (matches UICollectionView cell-reveal behaviour).
 *          Stagger via delay prop so rows fan out like a native list.
 *
 * Android → Scroll-LINKED deck: useScroll drives y/scale/rotateX continuously
 *           so every scroll pixel moves the card — no discrete trigger.
 *           useSpring adds inertia so each card feels like it has mass.
 *           Horizontal swipe-to-dismiss gesture on inner wrapper.
 *
 * Default → Simple fade-up whileInView, no 3-D transforms.
 *
 * Rule: ALL hooks are called unconditionally at the top; the platform
 * branch only affects which JSX is returned — safe per React rules.
 */
function ScrollStackCard({
  children,
  platform,
  animCfg,
}: {
  children: React.ReactNode;
  platform: Platform;
  animCfg: AnimCfg;
}) {
  // All hooks called unconditionally — platform only affects the return branch.
  const ref = useRef<HTMLDivElement>(null);

  // ── Android: dramatic scroll-linked deck — values driven by animCfg
  const { scrollYProgress: androidProgress } = useScroll({
    target: ref,
    offset: ["start 108%", "start 28%"],
  });
  const rawY       = useTransform(androidProgress, [0, 1], [animCfg.android.yTravel, 0]);
  const rawScale   = useTransform(androidProgress, [0, 1], [animCfg.android.scaleFrom, 1]);
  const rawRotateX = useTransform(androidProgress, [0, 1], [animCfg.android.rotateX, 0]);
  const androidOpacity = useTransform(androidProgress, [0, 0.22, 1], [0, 0.55, 1]);
  const springCfg  = { stiffness: animCfg.android.stiffness, damping: animCfg.android.damping, restDelta: 0.5 } as const;
  const y       = useSpring(rawY,       springCfg);
  const scale   = useSpring(rawScale,   springCfg);
  const rotateX = useSpring(rawRotateX, springCfg);

  // ── iOS: scroll-linked reveal — values driven by animCfg
  const { scrollYProgress: iosProgress } = useScroll({
    target: ref,
    offset: ["start 98%", "start 42%"],
  });
  const iosOpacity = useTransform(iosProgress, [0, animCfg.ios.opacityMid, 1], [0, 0.85, 1]);
  const iosScale   = useTransform(iosProgress, [0, 1], [animCfg.ios.scaleFrom, 1]);
  const iosY       = useTransform(iosProgress, [0, 1], [animCfg.ios.yTravel, 0]);

  // Android swipe-to-dismiss (always created, only wired up on Android)
  const swipeX       = useMotionValue(0);
  const swipeRotate  = useTransform(swipeX, [-220, 0, 220], [-13, 0, 13]);
  const swipeOpacity = useTransform(swipeX, [-140, -65, 0, 65, 140], [0, 1, 1, 1, 0]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (Math.abs(info.offset.x) > 110) {
      const dir = info.offset.x > 0 ? 720 : -720;
      animate(swipeX, dir, { type: "spring", stiffness: 340, damping: 28 });
      setTimeout(() => {
        swipeX.set(-dir);
        animate(swipeX, 0, { type: "spring", stiffness: 210, damping: 22 });
      }, 500);
    } else {
      animate(swipeX, 0, { type: "spring", stiffness: 580, damping: 30 });
    }
  }

  // ── iOS: scroll-linked opacity + scale, Apple spring only on interaction ──
  // No whileInView threshold — every scroll pixel moves the card.
  // No spring on the scroll values — direct mapping = silky, no lag.
  // whileTap: 0.97 press-down, Apple-curve spring (stiffness 500, damping 24).
  // whileHover: very slight lift, fast spring — subtle like macOS hover states.
  if (platform === "ios") {
    return (
      <motion.div
        ref={ref}
        className="h-full"
        style={{ opacity: iosOpacity, scale: iosScale, y: iosY }}
        whileHover={{
          scale: 1.022,
          y: -4,
          transition: { type: "spring", stiffness: 340, damping: 26 },
        }}
        whileTap={{
          scale: animCfg.ios.tapScale,
          transition: { type: "spring", stiffness: 500, damping: 24 },
        }}
      >
        {children}
      </motion.div>
    );
  }

  // ── Default: no animation — theme is off, cards are static ───────────
  if (platform !== "android") {
    return <div className="h-full">{children}</div>;
  }

  // ── Android: scroll-linked physical deck ──────────────────────────────
  return (
    <motion.div
      ref={ref}
      className="h-full"
      style={{ y, scale, rotateX, opacity: androidOpacity, transformPerspective: 1000 }}
    >
      <motion.div
        className="h-full"
        whileHover={{ y: -6, transition: { type: "spring", stiffness: 380, damping: 26 } }}
      >
        <motion.div
          className="h-full"
          style={{ x: swipeX, rotate: swipeRotate, opacity: swipeOpacity }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const SIZES: { value: DrinkSize; label: string }[] = [
  { value: "16oz", label: formatSize("16oz") },
  { value: "24oz", label: formatSize("24oz") },
  { value: "34oz", label: formatSize("34oz") },
];

function useFavorites(isSignedIn: boolean) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    if (!isSignedIn) {
      setFavorites([]);
      return;
    }
    fetch("/api/favorites", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Favorite[]) => setFavorites(data))
      .catch(() => setFavorites([]));
  }, [isSignedIn]);

  const toggle = async (menuItemId: number) => {
    const isFav = favorites.some((f) => f.menuItemId === menuItemId);
    if (isFav) {
      await fetch(`/api/favorites/${menuItemId}`, { method: "DELETE", credentials: "include" });
      setFavorites((prev) => prev.filter((f) => f.menuItemId !== menuItemId));
    } else {
      const res = await fetch("/api/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId }),
      });
      if (res.ok) {
        const fav: Favorite = await res.json();
        setFavorites((prev) => [...prev, fav]);
      }
    }
  };

  return { favorites, toggle };
}

type LotusDetectable = {
  name?: string;
  description?: string | null;
  ingredients?: { name?: string }[] | null;
  sizeIngredients?: Record<string, { name?: string }[] | undefined> | null;
  prepSteps?: { instruction?: string }[] | null;
  sizePrepSteps?: Record<string, { instruction?: string }[] | undefined> | null;
  category?: string | null;
  tags?: string[] | null;
};

function isLotusDrink(item: LotusDetectable | null | undefined): boolean {
  if (!item) return false;
  const re = /lotus/i;
  if (re.test(item.name ?? "")) return true;
  if (re.test(item.description ?? "")) return true;
  if (re.test(item.category ?? "")) return true;
  if ((item.tags ?? []).some((t) => re.test(t ?? ""))) return true;
  if ((item.ingredients ?? []).some((g) => re.test(g?.name ?? ""))) return true;
  if ((item.prepSteps ?? []).some((s) => re.test(s?.instruction ?? ""))) return true;
  for (const list of Object.values(item.sizeIngredients ?? {})) {
    if ((list ?? []).some((g) => re.test(g?.name ?? ""))) return true;
  }
  for (const list of Object.values(item.sizePrepSteps ?? {})) {
    if ((list ?? []).some((s) => re.test(s?.instruction ?? ""))) return true;
  }
  return false;
}

const LOTUS_BASES = [
  { value: "Sprite", label: "Sprite" },
  { value: "Lemonade", label: "Lemonade" },
  { value: "Soda Water", label: "Soda Water" },
] as const;
type LotusBase = (typeof LOTUS_BASES)[number]["value"];

const MILKS = [
  { value: "Whole", label: "Whole" },
  { value: "Oat", label: "Oat" },
  { value: "Almond", label: "Almond" },
  { value: "Coconut", label: "Coconut" },
] as const;
type Milk = (typeof MILKS)[number]["value"];

function isCoffeeDrink(item: LotusDetectable | null | undefined): boolean {
  if (!item) return false;
  const re = /coffee|latte|espresso|mocha|cappuccino|americano|macchiato|cortado|cold ?brew|frapp/i;
  if (re.test(item.name ?? "")) return true;
  if (re.test(item.description ?? "")) return true;
  return (item.ingredients ?? []).some((g) => re.test(g?.name ?? ""));
}

function EnergyBadge({ className = "" }: { className?: string }) {
  return (
    <Badge
      className={`text-xs bg-gradient-to-r from-yellow-300 to-amber-400 text-amber-900 hover:from-yellow-300 hover:to-amber-400 border-amber-300 gap-1 shadow-sm ${className}`}
    >
      <Zap className="h-3 w-3" fill="currentColor" /> Energy
    </Badge>
  );
}

function TempBadge({ temperature }: { temperature?: string }) {
  const t = (temperature ?? "cold") as "hot" | "cold" | "both";
  if (t === "hot") {
    return (
      <Badge className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200 gap-1">
        <Flame className="h-3 w-3" /> Hot
      </Badge>
    );
  }
  if (t === "both") {
    return (
      <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 gap-1">
        <Thermometer className="h-3 w-3" /> Hot or Cold
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200 gap-1">
      <Snowflake className="h-3 w-3" /> Cold
    </Badge>
  );
}

function applyHHDiscount(price: number, discType: string, discValue: number): number {
  if (discType === "dollar") return Math.max(0, price - discValue);
  return price * (1 - discValue / 100);
}

function formatHHTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour12 = (h ?? 0) % 12 || 12;
  return (m ?? 0) === 0 ? `${hour12}:00 ${period}` : `${hour12}:${(m ?? 0).toString().padStart(2, "0")} ${period}`;
}

function SizePriceBadge({ item, isHappyHour = false, hhDiscountType = "percent", hhDiscountValue = 50 }: {
  item: { sizePrices?: Record<string, number>; price: number };
  isHappyHour?: boolean;
  hhDiscountType?: string;
  hhDiscountValue?: number;
}) {
  const sp = item.sizePrices as Record<string, number> | undefined;
  const positive = sp ? Object.values(sp).filter((v) => Number.isFinite(v) && v > 0) : [];
  const effectiveLow = positive.length > 0 ? Math.min(...positive) : item.price;
  const effectiveHigh = positive.length > 0 ? Math.max(...positive) : item.price;

  if (isHappyHour) {
    const lo = applyHHDiscount(effectiveLow, hhDiscountType, hhDiscountValue).toFixed(2);
    const hi = applyHHDiscount(effectiveHigh, hhDiscountType, hhDiscountValue).toFixed(2);
    return (
      <Badge className="font-semibold text-sm bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-100 gap-1">
        <span className="line-through text-orange-400/80 font-normal">
          ${effectiveLow === effectiveHigh ? effectiveLow.toFixed(2) : `${effectiveLow.toFixed(2)}–${effectiveHigh.toFixed(2)}`}
        </span>
        {effectiveLow === effectiveHigh ? `$${lo}` : `$${lo}–$${hi}`}
      </Badge>
    );
  }

  if (effectiveLow === effectiveHigh) {
    return (
      <Badge variant="secondary" className="font-semibold text-sm bg-secondary/30 text-secondary-foreground hover:bg-secondary/40">
        ${effectiveLow.toFixed(2)}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="font-semibold text-sm bg-secondary/30 text-secondary-foreground hover:bg-secondary/40">
      ${effectiveLow.toFixed(2)}–${effectiveHigh.toFixed(2)}
    </Badge>
  );
}

export default function Home() {
  const { data: menuItems, isLoading } = useListMenuItems();
  const { data: settings } = useGetSettings({ query: { refetchInterval: 60000 } });
  const [popularIds, setPopularIds] = useState<number[]>([]);
  useEffect(() => {
    fetch("/api/orders/popular-items")
      .then(r => r.ok ? r.json() : null)
      .then((d: { popular: number[] } | null) => { if (d?.popular) setPopularIds(d.popular); })
      .catch(() => {});
  }, []);
  const isHappyHour = !!(settings as any)?.isHappyHour;
  const minsUntilHappyHourEnd = (settings as any)?.minutesUntilHappyHourEnd as number | null ?? null;
  const hhDiscountType: string = (settings as any)?.happyHourDiscountType ?? "percent";
  const hhDiscountValue: number = Number((settings as any)?.happyHourDiscountValue ?? "50");
  const hhEndTime: string = (settings as any)?.happyHourEnd ?? "17:00";
  const hhLabel = hhDiscountType === "dollar"
    ? `$${hhDiscountValue.toFixed(2)} off every drink`
    : `All drinks ${hhDiscountValue}% off`;
  const { data: stats } = useGetOrderStats();
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { isSignedIn } = useUser();

  const isBusy = stats ? (stats.pendingCount + stats.preparingCount) > 10 : false;
  const isSunday = settings?.isSunday === true;
  const isClosed = !isDevMode() && (settings?.isOpen === false || isSunday);

  const { favorites, toggle } = useFavorites(!!isSignedIn);
  const { platform } = usePlatform();
  const animCfg = useAnimationConfig();
  useColorOverrides();
  const animCfgKey = [
    animCfg.ios.scaleFrom, animCfg.ios.yTravel, animCfg.ios.opacityMid, animCfg.ios.tapScale,
    animCfg.android.scaleFrom, animCfg.android.yTravel, animCfg.android.rotateX,
    animCfg.android.stiffness, animCfg.android.damping,
  ].join("-");

  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [selectedSize, setSelectedSize] = useState<DrinkSize>("16oz");
  const [selectedTemp, setSelectedTemp] = useState<DrinkTemp>(null);
  const [selectedLotusBase, setSelectedLotusBase] = useState<LotusBase | null>(null);
  const [selectedMilk, setSelectedMilk] = useState<Milk | null>(null);
  const [addState, setAddState] = useState<"idle" | "loading" | "done">("idle");
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [sortBy, setSortBy] = useState<"default" | "name-asc" | "name-desc" | "price-asc" | "price-desc">("default");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "soda" | "lotus" | "coffee">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const cupStageRef = useRef<HTMLDivElement | null>(null);

  const activeItem = menuItems?.find(i => i.id === selectedItem);
  const activePrice = activeItem ? getItemPrice(activeItem, selectedSize) : 0;
  const activeTempMode = ((activeItem as { temperature?: string } | undefined)?.temperature ?? "cold") as "hot" | "cold" | "both";
  const needsTempChoice = activeTempMode === "both";
  const isLotus = isLotusDrink(activeItem as LotusDetectable | undefined);
  const isCoffee = isCoffeeDrink(activeItem as LotusDetectable | undefined);
  const needsLotusBase = isLotus;
  const needsMilk = isCoffee;
  const canAddToCart =
    (!needsTempChoice || selectedTemp === "hot" || selectedTemp === "cold") &&
    (!needsLotusBase || selectedLotusBase !== null) &&
    (!needsMilk || selectedMilk !== null);

  const resetDialog = () => {
    setSelectedItem(null);
    setQuantity(1);
    setInstructions("");
    setSelectedSize("16oz");
    setSelectedTemp(null);
    setSelectedLotusBase(null);
    setSelectedMilk(null);
    setSelectedModifiers([]);
    setAddState("idle");
  };

  const handleAddToCart = () => {
    if (!activeItem || addState !== "idle") return;
    if (!canAddToCart) return;
    let temp: DrinkTemp = null;
    if (activeTempMode === "hot") temp = "hot";
    else if (activeTempMode === "cold") temp = "cold";
    else if (activeTempMode === "both") temp = selectedTemp;
    const parts: string[] = [];
    if (needsLotusBase && selectedLotusBase) parts.push(`Lotus Base: ${selectedLotusBase}.`);
    if (needsMilk && selectedMilk) parts.push(`Milk: ${selectedMilk}.`);
    if (instructions) parts.push(instructions);
    const finalInstructions = parts.join(" ");
    addItem(activeItem, selectedSize, quantity, finalInstructions, temp, selectedModifiers);
    setAddState("loading");
    // The DrinkMaking animation calls onComplete after 5s,
    // which transitions to "done" and triggers the float-away.
  };

  const handleMakingComplete = () => {
    setAddState("done");
    const rect = cupStageRef.current?.getBoundingClientRect();
    if (rect) {
      const flights = Math.min(quantity, 3);
      for (let i = 0; i < flights; i++) {
        window.setTimeout(() => flyToCart(rect), i * 110);
      }
    }
    window.setTimeout(resetDialog, 600);
  };

  const rawAvailableItems = menuItems?.filter(i => i.available) || [];

  // Detect which category tabs actually have items
  const hasLotus = rawAvailableItems.some(i => isLotusDrink(i as LotusDetectable));
  const hasCoffee = rawAvailableItems.some(i => isCoffeeDrink(i as LotusDetectable));
  const hasSoda = rawAvailableItems.some(i => !isLotusDrink(i as LotusDetectable) && !isCoffeeDrink(i as LotusDetectable));

  const categoryFiltered = rawAvailableItems.filter(i => {
    if (categoryFilter === "lotus") return isLotusDrink(i as LotusDetectable);
    if (categoryFilter === "coffee") return isCoffeeDrink(i as LotusDetectable);
    if (categoryFilter === "soda") return !isLotusDrink(i as LotusDetectable) && !isCoffeeDrink(i as LotusDetectable);
    return true;
  });

  const searchFiltered = searchQuery.trim()
    ? categoryFiltered.filter(i => {
        const q = searchQuery.toLowerCase();
        return (
          i.name.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q) ||
          (i.ingredients as {name?:string}[] | null ?? []).some((g) => (g.name ?? "").toLowerCase().includes(q))
        );
      })
    : categoryFiltered;

  const availableItems = [...searchFiltered].sort((a, b) => {
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "name-desc") return b.name.localeCompare(a.name);
    if (sortBy === "price-asc") {
      const aMin = Math.min(...Object.values((a.sizePrices as Record<string,number>) || {}).filter(v => v > 0));
      const bMin = Math.min(...Object.values((b.sizePrices as Record<string,number>) || {}).filter(v => v > 0));
      return (isFinite(aMin) ? aMin : Number(a.price)) - (isFinite(bMin) ? bMin : Number(b.price));
    }
    if (sortBy === "price-desc") {
      const aMax = Math.max(...Object.values((a.sizePrices as Record<string,number>) || {}).filter(v => v > 0));
      const bMax = Math.max(...Object.values((b.sizePrices as Record<string,number>) || {}).filter(v => v > 0));
      return (isFinite(bMax) ? bMax : Number(b.price)) - (isFinite(aMax) ? aMax : Number(a.price));
    }
    return 0;
  });
  const siteDescription = settings?.siteDescription ?? "Welcome to Sweet Street! Browse our signature dirty sodas and sweet treats.";

  return (
    <CustomerLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {isClosed && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-800">
            <XCircle className="h-6 w-6 flex-shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-base">
                {isSunday ? "We're closed on Sundays (restock day)" : "We're currently closed"}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                {isSunday
                  ? "Come back Monday — we'll be ready to serve you!"
                  : settings?.nextOpenLabel
                    ? `We open ${settings.nextOpenLabel}.`
                    : "Check back soon — we'll be open again shortly!"}
              </p>
              {!isSunday && settings?.todayHours && (
                <p className="text-xs text-red-600/80 mt-1">
                  Today's hours: {settings.todayHours}
                </p>
              )}
            </div>
          </div>
        )}

        {!isClosed && settings?.closingSoon && typeof settings.minutesUntilClose === "number" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 text-amber-900">
            <Clock className="h-6 w-6 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-base">
                Closing soon —{" "}
                {settings.minutesUntilClose <= 1
                  ? "less than a minute left"
                  : `${settings.minutesUntilClose} minutes left`}
              </p>
              <p className="text-sm text-amber-800/90 mt-0.5">
                Get your order in before we lock the doors! Today's hours: {settings.todayHours}
              </p>
            </div>
          </div>
        )}

        {settings?.announcementEnabled && settings.announcementText && (() => {
          const text = settings.announcementText;
          const isHoliday = (text.codePointAt(0) ?? 0) > 127;
          if (isHoliday) {
            // Unicode-safe split: iterate code-point chars, consume all leading
            // non-ASCII chars (emoji, variation selectors, ZWJ sequences, etc.),
            // then trimStart the remainder — avoids mixing UTF-16 and code-point indices.
            const chars = Array.from(text);
            let emojiCharCount = 0;
            while (emojiCharCount < chars.length && (chars[emojiCharCount].codePointAt(0) ?? 0) > 127) {
              emojiCharCount++;
            }
            const leadingEmoji = chars.slice(0, emojiCharCount).join('');
            const body = chars.slice(emojiCharCount).join('').trimStart();
            return (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="relative overflow-hidden flex items-start gap-4 bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-pink-200 rounded-2xl px-5 py-4 shadow-sm"
              >
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(236,72,153,0.4)_0%,_transparent_60%)] pointer-events-none" />
                <span className="text-3xl leading-none flex-shrink-0 mt-0.5 drop-shadow-sm">{leadingEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-pink-400 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Sweet Street Special</span>
                  </div>
                  <p className="text-sm font-semibold text-pink-900 leading-relaxed">{body}</p>
                </div>
              </motion.div>
            );
          }
          return (
            <div className="flex items-start gap-3 bg-secondary/40 border border-secondary/60 rounded-xl px-4 py-3 text-secondary-foreground">
              <Megaphone className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <p className="text-sm font-medium leading-relaxed">{text}</p>
            </div>
          );
        })()}

        {isHappyHour && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative overflow-hidden flex items-center gap-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 rounded-2xl px-5 py-4 text-white shadow-lg"
          >
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.6)_0%,_transparent_60%)]" />
            <Sparkles className="h-8 w-8 flex-shrink-0 drop-shadow" />
            <div className="flex-1">
              <p className="font-bold text-lg drop-shadow-sm">🎉 Happy Hour — {hhLabel}!</p>
              <p className="text-sm text-white/90 mt-0.5">
                Discount applied automatically at checkout
                {minsUntilHappyHourEnd !== null
                  ? ` — ${minsUntilHappyHourEnd} minute${minsUntilHappyHourEnd === 1 ? "" : "s"} left!`
                  : ` · Ends at ${formatHHTime(hhEndTime)}!`}
              </p>
            </div>
          </motion.div>
        )}

        {isBusy && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800"
          >
            <BubbleCupLoader size={48} />
            <div>
              <p className="text-sm font-semibold">We're extra busy right now!</p>
              <p className="text-xs text-amber-700/90 mt-0.5">
                Expect your order in <strong>3–8 additional minutes</strong>. Thanks for your patience!
              </p>
            </div>
          </motion.div>
        )}

        {/* Hero banner */}
        <section
          className="relative overflow-hidden rounded-3xl"
          style={{ background: "linear-gradient(135deg, hsl(345,62%,86%) 0%, hsl(10,72%,90%) 55%, hsl(30,75%,92%) 100%)" }}
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, hsl(5,76%,60%) 0%, transparent 70%)" }} />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, hsl(350,70%,55%) 0%, transparent 70%)" }} />

          <div className="flex flex-col-reverse sm:flex-row items-center min-h-[260px] sm:min-h-[300px]">
            {/* Text column */}
            <div className="flex-1 flex flex-col gap-4 px-8 py-10 sm:py-14 sm:pr-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "hsl(5,65%,52%)" }}>
                Meeker, OK
              </span>
              <h1
                className="text-4xl sm:text-5xl font-serif font-bold leading-[1.05] tracking-tight"
                style={{ color: "hsl(345,45%,18%)" }}
              >
                Hand-crafted<br />sips, made<br />with love
              </h1>
              <p className="text-sm sm:text-base leading-relaxed max-w-[26ch]" style={{ color: "hsl(345,35%,40%)" }}>
                {siteDescription}
              </p>
            </div>

            {/* Logo column */}
            <div className="flex items-center justify-center px-8 pt-10 pb-2 sm:py-10 sm:w-60 lg:w-72 flex-shrink-0">
              <img
                src="/logo.png"
                alt="Sweet Street Co"
                className="h-32 sm:h-44 lg:h-52 w-auto object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* Filter / search toolbar */}
        {!isLoading && rawAvailableItems.length > 0 && (
          <div className="space-y-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${categoryFilter === "all" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white/60 backdrop-blur-sm text-foreground/70 border-white/50 hover:bg-white/80 hover:text-foreground shadow-sm"}`}
              >
                All <span className="ml-1 opacity-50">{rawAvailableItems.length}</span>
              </button>
              {hasSoda && (
                <button
                  onClick={() => setCategoryFilter("soda")}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${categoryFilter === "soda" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white/60 backdrop-blur-sm text-foreground/70 border-white/50 hover:bg-white/80 hover:text-foreground shadow-sm"}`}
                >
                  🥤 Dirty Soda
                </button>
              )}
              {hasLotus && (
                <button
                  onClick={() => setCategoryFilter("lotus")}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${categoryFilter === "lotus" ? "bg-amber-500 text-white border-amber-500 shadow-md" : "bg-white/60 backdrop-blur-sm text-foreground/70 border-white/50 hover:bg-white/80 hover:text-foreground shadow-sm"}`}
                >
                  ⚡ Lotus Energy
                </button>
              )}
              {hasCoffee && (
                <button
                  onClick={() => setCategoryFilter("coffee")}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${categoryFilter === "coffee" ? "bg-amber-900 text-white border-amber-900 shadow-md" : "bg-white/60 backdrop-blur-sm text-foreground/70 border-white/50 hover:bg-white/80 hover:text-foreground shadow-sm"}`}
                >
                  ☕ Coffee
                </button>
              )}
            </div>

            {/* Search + sort row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drinks…"
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-full border border-border/50 bg-card/80 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-card/80 border-border/50">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="name-asc">Name: A → Z</SelectItem>
                    <SelectItem value="name-desc">Name: Z → A</SelectItem>
                    <SelectItem value="price-asc">Price: Low → High</SelectItem>
                    <SelectItem value="price-desc">Price: High → Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                {availableItems.length} drink{availableItems.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <CupCardSkeleton key={i} height={220} />
            ))}
          </div>
        ) : availableItems.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl shadow-sm border border-border/50">
            <Info className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            {searchQuery || categoryFilter !== "all" ? (
              <>
                <h3 className="text-lg font-medium text-foreground">No drinks match</h3>
                <p className="text-muted-foreground mt-1 text-sm">Try a different search or category.</p>
                <button onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }} className="mt-4 text-sm text-primary hover:underline">
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-foreground">Our menu is brewing</h3>
                <p className="text-muted-foreground mt-1 text-sm">Check back soon for our delicious offerings!</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">The Menu</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {availableItems.map((item) => {
              const isFav = favorites.some((f) => f.menuItemId === item.id);
              const isPopular = popularIds.includes(item.id);
              return (
                <ScrollStackCard
                  key={`${item.id}-${animCfgKey}`}
                  platform={platform}
                  animCfg={animCfg}
                >
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col h-full group hover:-translate-y-1">
                  {/* Gradient header */}
                  <div className={`relative flex-shrink-0 h-28 flex flex-col justify-end px-5 pb-4 overflow-hidden ${
                    isLotusDrink(item as LotusDetectable)
                      ? "bg-gradient-to-br from-amber-300 via-orange-400 to-amber-500"
                      : isCoffeeDrink(item as LotusDetectable)
                      ? "bg-gradient-to-br from-stone-600 via-amber-800 to-stone-700"
                      : "bg-gradient-to-br from-[hsl(5,76%,54%)] via-[hsl(350,72%,58%)] to-[hsl(345,65%,62%)] drink-card-gradient"
                  }`}>
                    <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_80%_15%,_rgba(255,255,255,0.65)_0%,_transparent_55%)]" />
                    <span className="absolute top-3.5 left-5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/60">
                      {isLotusDrink(item as LotusDetectable) ? "Energy Drink" : isCoffeeDrink(item as LotusDetectable) ? "Coffee" : "Dirty Soda"}
                    </span>
                    <Show when="signed-in">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggle(item.id); }}
                        className={`absolute top-2.5 right-3 p-1.5 rounded-full transition-all ${isFav ? "bg-white/25 text-white" : "text-white/40 hover:bg-white/20 hover:text-white"}`}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Heart className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
                      </button>
                    </Show>
                    <CardTitle className="relative text-xl font-serif font-bold text-white leading-tight drop-shadow-sm">{item.name}</CardTitle>
                  </div>

                  {/* Body */}
                  <CardContent className="flex-1 px-5 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TempBadge temperature={(item as { temperature?: string }).temperature} />
                        {isLotusDrink(item as LotusDetectable) && <EnergyBadge />}
                        {isPopular && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                            🔥 Popular
                          </span>
                        )}
                      </div>
                      <SizePriceBadge item={{ ...item, price: item.price ?? 0 }} isHappyHour={isHappyHour} hhDiscountType={hhDiscountType} hhDiscountValue={hhDiscountValue} />
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                  </CardContent>

                  <CardFooter className="px-5 pb-5 pt-2">
                    <Button
                      className="w-full rounded-full font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isClosed}
                      onClick={() => {
                        setSelectedItem(item.id);
                        setQuantity(1);
                        setInstructions("");
                        setSelectedSize("16oz");
                        setSelectedTemp(null);
                        setSelectedLotusBase(null);
                      }}
                    >
                      {isClosed ? (
                        <>
                          <XCircle className="mr-2 h-4 w-4" /> Closed
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" /> Add to Order
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
                </ScrollStackCard>
              );
            })}
            </div>
          </>
        )}

        <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open && addState === "idle") resetDialog(); }}>
          <DialogContent
            className="sm:max-w-[425px] bg-background overflow-hidden p-0 gap-0 max-h-[85vh] flex flex-col"
            style={{ maxHeight: "min(92dvh, calc(100vh - 1.5rem))" }}
          >
            <AnimatePresence mode="wait">
              {addState === "idle" ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="flex flex-col min-h-0 flex-1"
                >
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-2xl font-serif">{activeItem?.name}</DialogTitle>
                {isLotus && <EnergyBadge />}
              </div>
              <DialogDescription className="text-base">
                Choose your size and customize your drink
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {activeItem?.description && (
                <p className="text-sm text-muted-foreground">{activeItem.description}</p>
              )}

              <div className="space-y-3">
                <h4 className="font-medium text-sm">Size</h4>
                <div className="grid grid-cols-3 gap-2">
                  {SIZES.map((s) => {
                    const price = activeItem ? getItemPrice(activeItem, s.value) : 0;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setSelectedSize(s.value)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                          selectedSize === s.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 hover:border-primary/40"
                        }`}
                      >
                        <span className="font-medium text-sm">{s.label}</span>
                        {isHappyHour ? (
                          <span className="text-xs flex gap-1">
                            <span className="line-through text-muted-foreground">${price.toFixed(2)}</span>
                            <span className="text-orange-600 font-semibold">${applyHHDiscount(price, hhDiscountType, hhDiscountValue).toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">${price.toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {needsLotusBase && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Lotus Base</h4>
                    <Zap className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Pick what mixes with your Lotus energy.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {LOTUS_BASES.map((b) => (
                      <button
                        key={b.value}
                        onClick={() => setSelectedLotusBase(b.value)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-all ${
                          selectedLotusBase === b.value
                            ? "border-amber-400 bg-amber-50 text-amber-800"
                            : "border-border/50 hover:border-amber-300"
                        }`}
                      >
                        <span className="font-medium text-sm">{b.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {needsMilk && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Milk</h4>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Pick the milk for your coffee.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MILKS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setSelectedMilk(m.value)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-all ${
                          selectedMilk === m.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 hover:border-primary/40"
                        }`}
                      >
                        <span className="font-medium text-sm">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {needsTempChoice ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Hot or Cold?</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedTemp("hot")}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                        selectedTemp === "hot"
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-border/50 hover:border-orange-300"
                      }`}
                    >
                      <Flame className="h-5 w-5" />
                      <span className="font-medium text-sm">Hot</span>
                    </button>
                    <button
                      onClick={() => setSelectedTemp("cold")}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                        selectedTemp === "cold"
                          ? "border-sky-400 bg-sky-50 text-sky-700"
                          : "border-border/50 hover:border-sky-300"
                      }`}
                    >
                      <Snowflake className="h-5 w-5" />
                      <span className="font-medium text-sm">Cold</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Served:</span>
                  <TempBadge temperature={activeTempMode} />
                </div>
              )}

              {activeItem && (
                <ModifierPicker
                  menuItem={activeItem}
                  selected={selectedModifiers}
                  onChange={setSelectedModifiers}
                />
              )}

              <div className="space-y-3">
                <h4 className="font-medium text-sm">Ingredients</h4>
                <ul className="text-sm space-y-1 text-muted-foreground bg-card/60 p-3 rounded-lg border border-border/50">
                  {activeItem?.ingredients?.map((ing, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{ing.name}</span>
                      <span className="text-xs opacity-70">{ing.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm">Special Instructions</h4>
                <Textarea
                  placeholder="Extra ice, no whip..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="resize-none bg-card/60"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <span className="font-medium">Quantity</span>
                <div className="flex items-center gap-3 bg-card/60 rounded-lg p-1 border border-border/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-md"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-md"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
              <motion.div className="w-full" whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {needsLotusBase && !selectedLotusBase
                    ? "Choose your Lotus base"
                    : needsMilk && !selectedMilk
                      ? "Choose your milk"
                      : needsTempChoice && !canAddToCart
                        ? "Choose Hot or Cold"
                        : isHappyHour
                          ? `Add to Cart • $${((applyHHDiscount(activePrice, hhDiscountType, hhDiscountValue) + selectedModifiers.reduce((s, m) => s + m.price, 0)) * quantity).toFixed(2)} 🎉`
                          : `Add to Cart • $${((activePrice + selectedModifiers.reduce((s, m) => s + m.price, 0)) * quantity).toFixed(2)}`}
                </Button>
              </motion.div>
            </DialogFooter>
                </motion.div>
              ) : (
                <motion.div
                  key="cup-stage"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="flex flex-col items-center justify-center py-10 min-h-[280px]"
                >
                  <DialogHeader className="sr-only">
                    <DialogTitle>Adding {activeItem?.name} to cart</DialogTitle>
                    <DialogDescription>Please wait while we add your drink.</DialogDescription>
                  </DialogHeader>
                  <motion.div
                    ref={cupStageRef}
                    animate={
                      addState === "done"
                        ? { y: -320, scale: 0.5, opacity: 0, rotate: -12 }
                        : { y: 0, scale: 1, opacity: 1, rotate: 0 }
                    }
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {addState === "loading" ? (
                      <DrinkMaking size={240} durationMs={3500} onComplete={handleMakingComplete} />
                    ) : (
                      <BubbleCupLoader size={130} message="Added to your cart!" />
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
        <ReviewsSection />

      </div>
    </CustomerLayout>
  );
}

type ReviewData = {
  id: number;
  reviewerName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

function StarRating({ rating, interactive = false, onRate }: { rating: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={`transition-colors ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
        >
          <Star
            className={`h-5 w-5 ${(hovered || rating) >= star ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 fill-muted-foreground/10"}`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewsSection() {
  const { user, isSignedIn } = useUser();
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      setName(user.fullName || user.firstName || "");
    }
  }, [isSignedIn, user]);

  const fetchReviews = () => {
    fetch("/api/reviews")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ReviewData[]) => setReviews(data))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, []);

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (rating === 0) { setError("Please select a star rating."); return; }
    if (!comment.trim()) { setError("Please write something about your experience."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reviewerName: name.trim(), rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to submit review");
      }
      setSubmitted(true);
      setRating(0);
      setComment("");
      fetchReviews();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-8 pt-6 border-t border-border/40">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif font-bold text-primary-foreground">Customer Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-muted-foreground">
                {avgRating.toFixed(1)} out of 5 · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-card/60">
        <CardHeader>
          <CardTitle className="text-lg font-serif">Leave a Review</CardTitle>
          <CardDescription>Share your experience with Sweet Street!</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="font-semibold text-lg">Thank you for your review!</p>
              <p className="text-muted-foreground text-sm">Your feedback means the world to us.</p>
              <Button variant="outline" size="sm" onClick={() => setSubmitted(false)} className="mt-2">
                Leave another review
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  className="bg-card/80"
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rating</label>
                <StarRating rating={rating} interactive onRate={setRating} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Review</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you loved (or what we can improve)..."
                  className="resize-none bg-card/80"
                  rows={3}
                  maxLength={500}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {submitting ? (
                  <span className="flex items-center gap-2"><BubbleCupLoader size={20} /> Submitting...</span>
                ) : (
                  <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Submit Review</span>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No reviews yet — be the first to share your experience!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {reviews.map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Card className="bg-card/60 backdrop-blur-sm border-card/60 hover:shadow-md transition-shadow">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{review.reviewerName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.comment && (
                      <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{review.comment}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
