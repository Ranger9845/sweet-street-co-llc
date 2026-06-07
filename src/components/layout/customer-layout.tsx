import { Link, useLocation } from "wouter";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useCart } from "../cart-provider";
import { ShoppingCart, LogIn, LogOut, User, Receipt, Clock3, MapPin, Globe, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser, useClerk, Show } from "@clerk/react";
import { AnimatePresence, motion } from "framer-motion";
import { PointsCupBadge, PointsEarnedCelebration } from "../points-cup";
import { useCartFly } from "../cart-fly";
import { SuperBusyOverlay } from "../super-busy-overlay";
import { WelcomeTour, useWelcomeTour, TourButton } from "../welcome-tour";

import { DevNotificationModal } from "../dev-notification-modal";
import { useVisitorHeartbeat } from "@/hooks/use-visitor-heartbeat";
import { usePlatform } from "@/hooks/use-platform";
import { ThemePicker } from "@/components/theme-picker";
import { PhoneCaptureModal } from "@/components/phone-capture-modal";
import { HelpBubble } from "@/components/help-bubble";
import { FeedbackWidget } from "../feedback-widget";

type Reward = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  discountType: string;
  discountValue: number;
  active: boolean;
};

const shopHours = [
  { day: "Mon", hours: "7:00 AM – 7:00 PM" },
  { day: "Tue", hours: "7:00 AM – 7:00 PM" },
  { day: "Wed", hours: "7:00 AM – 7:00 PM" },
  { day: "Thu", hours: "7:00 AM – 7:00 PM" },
  { day: "Fri", hours: "7:00 AM – 8:00 PM" },
  { day: "Sat", hours: "8:00 AM – 8:00 PM" },
  { day: "Sun", hours: "Closed (restock day)", muted: true },
] as const;

export function CustomerLayout({ children }: { children: ReactNode }) {
  useVisitorHeartbeat();
  const { items } = useCart();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const isOrderStatusPage = location.startsWith("/order-status");
  const { registerCartTarget } = useCartFly();
  const cartBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    registerCartTarget(cartBtnRef.current);
    return () => registerCartTarget(null);
  }, [registerCartTarget]);

  const [celebration, setCelebration] = useState<{
    earned: number;
    prevBalance: number;
    rewards: Reward[];
  } | null>(null);

  const tour = useWelcomeTour();
  const {
    platform,
    rawPlatform,
    hasChosen,
    choosePlatformTheme,
    chooseDefaultTheme,
    resetChoice,
  } = usePlatform();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/points/${user.id}/unseen-earnings`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data || data.earned <= 0) return;
        const rewardsRes = await fetch(`/api/rewards`);
        const rewards = rewardsRes.ok ? await rewardsRes.json() : [];
        if (cancelled) return;
        setCelebration({
          earned: data.earned,
          prevBalance: data.previousBalance ?? 0,
          rewards: rewards || [],
        });
        fetch(`/api/points/${user.id}/mark-earnings-seen`, { method: "POST" }).catch(() => {});
      } catch {
        /* ignore */
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user?.id]);

  return (
    <div
      className={`min-h-[100dvh] flex flex-col font-sans text-foreground selection:bg-primary/20 platform-${platform}${platform === "ios" ? " isolate" : " bg-background"}`}
    >
      {/* iOS: vivid fixed gradient lives here (z-index:-1 inside isolate context)
          so every card's backdrop-filter has colorful pixels to blur */}
      {platform === "ios" && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -1,
            /* Soft color-orb background — organic blobs that flow into each other,
               like a real iPhone wallpaper. Each orb fades at the edges so they
               blend smoothly rather than having hard transition lines. */
            background: [
              "radial-gradient(ellipse 75% 80% at 18% 18%, hsl(var(--ss-ios-orb1-h, 275) 72% 60%) 0%, transparent 58%)",
              "radial-gradient(ellipse 85% 65% at 84% 14%, hsl(var(--ss-ios-orb2-h, 325) 82% 58%) 0%, transparent 56%)",
              "radial-gradient(ellipse 65% 75% at 55% 86%, hsl(var(--ss-ios-orb3-h, 6) 88% 62%) 0%, transparent 55%)",
              "radial-gradient(ellipse 60% 55% at 25% 78%, hsl(var(--ss-ios-orb4-h, 348) 76% 62%) 0%, transparent 52%)",
              "radial-gradient(ellipse 50% 50% at 70% 52%, hsl(var(--ss-ios-orb5-h, 18) 80% 64%) 0%, transparent 50%)",
              "hsl(var(--ss-ios-base-h, 305) 50% 50%)",
            ].join(", "),
          }}
        />
      )}
      <header className="sticky top-0 z-50 w-full border-b border-white/50 bg-background/85 backdrop-blur-3xl supports-[backdrop-filter]:bg-background/70 shadow-[0_2px_28px_-6px_hsl(345_45%_74%/0.5)]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 min-w-0 group">
              <img
                src="/logo.png"
                alt="Sweet Street Co"
                className="h-12 w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
              />
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-base font-bold tracking-tight text-foreground">Sweet Street</p>
                <p className="truncate text-xs font-medium text-muted-foreground">Sodas & Energy</p>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-3">
              <TourButton onClick={tour.openTour} />
              {rawPlatform !== "other" && (
                <button
                  onClick={resetChoice}
                  title={`Switch theme (${rawPlatform === "ios" ? "iOS" : "Android"} mode active)`}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white/50 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              )}
              <Show when="signed-in">
                <PointsCupBadge />
                <span className="hidden lg:inline text-sm font-medium text-muted-foreground">
                  {user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 font-medium"
                  onClick={() => setLocation("/my-orders")}
                >
                  <Receipt className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Orders</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 font-medium"
                  onClick={() => signOut({ redirectUrl: `${window.location.origin}${basePath}/` })}
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </Show>

              <Show when="signed-out">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 font-medium"
                  onClick={() => setLocation("/sign-in")}
                >
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-primary text-white shadow-md hover:bg-primary/90 font-semibold"
                  onClick={() => setLocation("/sign-up")}
                >
                  <User className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign up</span>
                </Button>
              </Show>

              <Link href="/order">
                <Button
                  ref={cartBtnRef}
                  variant="outline"
                  className="relative rounded-full border-white/50 bg-white/70 backdrop-blur-sm px-4 hover:bg-white/90 shadow-md transition-all font-semibold"
                >
                  <ShoppingCart className="h-4 w-4 mr-2 text-foreground/80" />
                  <span className="hidden sm:inline font-semibold">Cart</span>
                  <AnimatePresence>
                    {itemCount > 0 && (
                      <motion.span
                        key={itemCount}
                        initial={{ scale: 0.4, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.4, opacity: 0, y: -10 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className="absolute -top-2 -right-2"
                      >
                        <Badge className="h-6 w-6 flex items-center justify-center rounded-full p-0 text-xs shadow-md bg-primary text-white border-2 border-white">
                          {itemCount}
                        </Badge>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {children}
      </main>

      {!isOrderStatusPage && <SuperBusyOverlay />}

      <DevNotificationModal />

      <WelcomeTour open={tour.open} onOpenChange={tour.setOpen} />

      <HelpBubble />

      <FeedbackWidget hideTrigger />

      <ThemePicker
        rawPlatform={rawPlatform}
        hasChosen={hasChosen}
        onChoosePlatform={choosePlatformTheme}
        onChooseDefault={chooseDefaultTheme}
      />

      <AnimatePresence>
        {celebration && (
          <PointsEarnedCelebration
            earned={celebration.earned}
            startBalance={celebration.prevBalance}
            rewards={celebration.rewards}
            onClose={() => setCelebration(null)}
          />
        )}
      </AnimatePresence>

      <PhoneCaptureModal />

      <footer className="mt-auto border-t border-white/30 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">

            {/* Brand */}
            <div className="space-y-5 lg:col-span-5">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Sweet Street Co" className="h-10 w-auto object-contain drop-shadow-sm" />
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Sweet Street</h3>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Meeker, OK</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Your local stop for hand-crafted sodas, Lotus energy drinks, and cozy coffee runs.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Pickup ready", "Custom mixes", "Rewards"].map((tag) => (
                  <span key={tag} className="text-xs font-semibold px-3 py-1 rounded-full bg-white/60 text-foreground/70 border border-white/50">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Hours */}
            <div className="space-y-4 lg:col-span-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" /> Shop hours
              </h4>
              <ul className="space-y-2.5 text-sm">
                {shopHours.map((entry) => (
                  <li key={entry.day} className="flex justify-between gap-4">
                    <span className={`font-semibold ${"muted" in entry && entry.muted ? "text-muted-foreground/60" : "text-foreground"}`}>{entry.day}</span>
                    <span className={`${"muted" in entry && entry.muted ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{entry.hours}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div className="space-y-4 lg:col-span-3">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> Find us
              </h4>
              <p className="text-sm text-muted-foreground">Follow along for new flavors and drops.</p>
              <div className="flex flex-col gap-2.5">
                <a
                  href="https://www.facebook.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors group"
                >
                  <div className="h-9 w-9 rounded-full bg-[#1877F2]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1877F2]/20 transition-colors">
                    <Globe className="h-4 w-4 text-[#1877F2]" />
                  </div>
                  Facebook
                </a>
                <a
                  href="https://www.instagram.com/sweetstreetco.ok/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors group"
                >
                  <div className="h-9 w-9 rounded-full bg-[#E4405F]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#E4405F]/20 transition-colors">
                    <Heart className="h-4 w-4 text-[#E4405F]" />
                  </div>
                  Instagram
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Sweet Street Co. LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
