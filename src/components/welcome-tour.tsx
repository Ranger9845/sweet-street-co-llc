import { useEffect, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Snowflake,
  Flame,
  Zap,
  Coffee,
  Ruler,
  MessageSquare,
  ShoppingCart,
  Receipt,
  Gift,
  Calendar,
  Tag,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  HelpCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const TOUR_KEY = "sweetstreet:tour-seen-v1";

type Step = {
  icon: ReactNode;
  title: string;
  body: ReactNode;
};

const STEPS: Step[] = [
  {
    icon: <Sparkles className="h-7 w-7 text-primary" />,
    title: "Welcome to Sweet Street!",
    body: (
      <>
        <p>
          We make hand-crafted dirty sodas, Lotus energy drinks, coffee, and
          sweet treats. This quick tour shows you how to order in under a
          minute.
        </p>
        <p className="text-sm text-muted-foreground">
          You can re-open this tour any time from the <strong>?</strong> button
          in the header.
        </p>
      </>
    ),
  },
  {
    icon: <Sparkles className="h-7 w-7 text-primary" />,
    title: "1. Browse the menu",
    body: (
      <>
        <p>
          Scroll the homepage to see every drink and treat. Each card shows the
          name, base ingredient, and price range.
        </p>
        <p className="text-sm">Look for these badges on each card:</p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 gap-1">
            <Snowflake className="h-3 w-3" /> Cold
          </Badge>
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 gap-1">
            <Flame className="h-3 w-3" /> Hot
          </Badge>
          <Badge className="bg-gradient-to-r from-yellow-300 to-amber-400 text-amber-900 border-amber-300 hover:from-yellow-300 gap-1">
            <Zap className="h-3 w-3" fill="currentColor" /> Energy
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Energy = made with Lotus. Tap <strong>Add to Order</strong> on any
          drink to start customizing.
        </p>
      </>
    ),
  },
  {
    icon: <Ruler className="h-7 w-7 text-primary" />,
    title: "2. Pick your size",
    body: (
      <>
        <p>Every drink comes in three sizes:</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border-2 border-border/60 bg-white/50 p-3">
            <div className="font-semibold">16 oz</div>
            <div className="text-xs text-muted-foreground">Regular</div>
          </div>
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
            <div className="font-semibold">24 oz</div>
            <div className="text-xs text-muted-foreground">Large</div>
          </div>
          <div className="rounded-lg border-2 border-border/60 bg-white/50 p-3">
            <div className="font-semibold">32 oz</div>
            <div className="text-xs text-muted-foreground">XL</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Each size has its own price — you'll see it under the size button
          before you commit.
        </p>
      </>
    ),
  },
  {
    icon: <Flame className="h-7 w-7 text-orange-500" />,
    title: "3. Hot or cold?",
    body: (
      <>
        <p>
          Some drinks (like coffees and chai) can be served either way. When
          that's the case, you'll get a <strong>Hot or Cold?</strong> picker in
          the dialog.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border-2 border-orange-400 bg-orange-50 p-3 text-center text-orange-700">
            <Flame className="h-5 w-5 mx-auto" />
            <div className="text-sm font-medium mt-1">Hot</div>
          </div>
          <div className="flex-1 rounded-lg border-2 border-sky-400 bg-sky-50 p-3 text-center text-sky-700">
            <Snowflake className="h-5 w-5 mx-auto" />
            <div className="text-sm font-medium mt-1">Cold</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Drinks that are only ever cold (or only hot) skip this step.
        </p>
      </>
    ),
  },
  {
    icon: <Zap className="h-7 w-7 text-amber-500" fill="currentColor" />,
    title: "4. Lotus base (energy drinks)",
    body: (
      <>
        <p>
          For Lotus energy drinks, pick the base that mixes with your Lotus
          shot:
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 text-amber-800 text-sm font-medium">
            Sprite
          </div>
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 text-amber-800 text-sm font-medium">
            Lemonade
          </div>
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 text-amber-800 text-sm font-medium">
            Soda Water
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Sprite = sweetest, Lemonade = bright + tart, Soda Water = lower sugar.
        </p>
      </>
    ),
  },
  {
    icon: <Coffee className="h-7 w-7 text-primary" />,
    title: "5. Coffee milk choice",
    body: (
      <>
        <p>Ordering a coffee, latte, or mocha? Pick your milk:</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          {["Whole", "Oat", "Almond", "Coconut"].map((m) => (
            <div
              key={m}
              className="rounded-lg border-2 border-primary/30 bg-primary/5 p-2 text-sm font-medium text-primary"
            >
              {m}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Dairy-free options (Oat, Almond, Coconut) are no extra charge.
        </p>
      </>
    ),
  },
  {
    icon: <MessageSquare className="h-7 w-7 text-primary" />,
    title: "6. Special instructions",
    body: (
      <>
        <p>
          The <strong>Special Instructions</strong> box is for anything else you
          want the barista to know. Examples:
        </p>
        <ul className="text-sm space-y-1.5 bg-white/60 border border-border/50 rounded-lg p-3">
          <li>• "Extra ice please"</li>
          <li>• "Light on the syrup"</li>
          <li>• "No whipped cream"</li>
          <li>• "Allergic to coconut — keep separate"</li>
          <li>• "Half sweet"</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Keep it short — the barista sees this on the prep ticket.
        </p>
      </>
    ),
  },
  {
    icon: <ShoppingCart className="h-7 w-7 text-primary" />,
    title: "7. Cart & checkout",
    body: (
      <>
        <p>
          Tap <strong>Add to Cart</strong> and your drink flies up to the cart
          icon in the top-right corner. Add as many drinks as you like.
        </p>
        <p>
          When you're ready, tap the cart and you'll go to checkout where you
          can:
        </p>
        <ul className="text-sm space-y-1.5">
          <li className="flex items-start gap-2">
            <Tag className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <span>Apply a discount code</span>
          </li>
          <li className="flex items-start gap-2">
            <Gift className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <span>Redeem your ice-cubes for rewards</span>
          </li>
          <li className="flex items-start gap-2">
            <CreditCard className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <span>Pay with card now, or pay in store on pickup</span>
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: <Gift className="h-7 w-7 text-primary" />,
    title: "8. Earn ice-cubes (rewards)",
    body: (
      <>
        <p>
          Sign in or sign up and you'll earn <strong>1 ice-cube</strong> for
          every dollar you spend. Save them up to redeem free drinks, dollars
          off, and more.
        </p>
        <p className="text-sm">
          Your ice-cube balance lives in the top-right of the header. Tap it
          any time to see what rewards you can claim.
        </p>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
          <strong>Pro tip:</strong> Even pay-in-store orders earn ice-cubes once
          the owner marks the order paid.
        </div>
      </>
    ),
  },
  {
    icon: <Receipt className="h-7 w-7 text-primary" />,
    title: "9. Track your orders",
    body: (
      <>
        <p>
          After you place an order you'll get a tracking page showing the
          status: <em>pending → preparing → ready → picked up</em>.
        </p>
        <p>
          Signed-in customers can also tap <strong>My Orders</strong> in the
          header to see every order in progress and your full history.
        </p>
      </>
    ),
  },
  {
    icon: <Calendar className="h-7 w-7 text-primary" />,
    title: "One last thing",
    body: (
      <>
        <p>
          We're <strong>closed on Sundays</strong> so the team can rest. The
          menu is browsable but ordering is paused. Everything else is
          business-as-usual.
        </p>
        <p className="text-sm text-muted-foreground">
          That's the whole tour — go build a drink!
        </p>
      </>
    ),
  },
];

export function WelcomeTour({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];

  // Reset to first step whenever the tour is reopened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const next = () => {
    if (step < total - 1) setStep((s) => s + 1);
    else finish();
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : finish())}>
      <DialogContent
        className="sm:max-w-[460px] bg-background overflow-hidden p-0 gap-0 max-h-[88vh] flex flex-col border-2 border-primary/20"
        style={{ maxHeight: "min(90dvh, calc(100vh - 1.5rem))" }}
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Tour step {step + 1} of {total}
        </DialogDescription>

        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-primary">{step + 1}</span>
            <span>of {total}</span>
          </div>
          <button
            type="button"
            onClick={finish}
            className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-2 shrink-0">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-primary/15"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain px-6 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {current.icon}
                </div>
                <h2 className="text-xl font-serif font-bold text-primary-foreground leading-tight">
                  {current.title}
                </h2>
              </div>
              <div className="space-y-3 text-foreground/90 text-[0.95rem] leading-relaxed">
                {current.body}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border/50 bg-background/95 backdrop-blur-sm shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          {step < total - 1 ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
                Skip
              </Button>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={next}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={finish}
            >
              Start ordering
              <Sparkles className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useWelcomeTour() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(TOUR_KEY);
      if (!seen) {
        // Slight delay so it doesn't fight the page's mount animations.
        const t = setTimeout(() => setOpen(true), 700);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return {
    open,
    setOpen,
    openTour: () => setOpen(true),
  };
}

export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground"
      onClick={onClick}
      title="Take the tour"
    >
      <HelpCircle className="h-4 w-4 sm:mr-1" />
      <span className="hidden sm:inline">Tour</span>
    </Button>
  );
}
