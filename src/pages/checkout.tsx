import { CustomerLayout } from "@/components/layout/customer-layout";
import { getDevHeaders, isDevMode } from "@/components/dev-mode-panel";
import { useCart, getItemPrice, formatSize } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOrder } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag, LogIn, Tag, CheckCircle2, CreditCard, XCircle, CalendarClock, Clock } from "lucide-react";
import { CupSpinner } from "@/components/cup-spinner";
import { Separator } from "@/components/ui/separator";
import { useUser, Show } from "@clerk/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useGetOrderStats, useGetSettings } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { BubbleCupLoader } from "@/components/bubble-cup-loader";

const BUDDY_MESSAGES = [
  "Your loyalty is absolutely fizzing — you earned every bit of this! 🫧",
  "Look at those Ice Cubes paying off! You're basically Sweet Street royalty now 👑",
  "Yaaas! Those cubes were just waiting for this moment — enjoy every sip! ✨",
  "This is your reward era and we are HERE for it! 🎊",
  "Sweet Street loves you SO much for coming back — this one's all yours! 💖",
  "Ice Cubes redeemed, happiness incoming — you totally deserve this! 🥤",
  "You showed up, you sipped, you conquered. This reward is 100% earned! 🏆",
  "Your dedication to dirty soda is honestly inspiring — cheers to you! 🫧",
  "The cubes have spoken and they say: treat yourself! You're amazing! 🧊🎉",
  "VIP treatment, activated! Sweet Street sees your loyalty and loves it! 💫",
];

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(7, "Phone number is required"),
  notes: z.string().optional(),
  smsConsent: z.boolean().default(false),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

type SquarePaymentForm = {
  tokenize: () => Promise<{ token?: string; errors?: { message: string }[] }>;
  attach?: (selector: string) => Promise<void>;
};

type SquarePaymentRequest = {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
};

type SquareDigitalWallet = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: unknown[] }>;
};

type SquarePayments = {
  card: () => Promise<SquarePaymentForm>;
  paymentRequest: (opts: SquarePaymentRequest) => SquarePaymentRequest;
  googlePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareDigitalWallet>;
};

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

type DiscountInfo = {
  code: string;
  schoolName: string;
  discountType: string;
  discountAmount: number;
} | null;

type RewardInfo = {
  id: number;
  name: string;
  pointsCost: number;
  discountType: string;
  discountValue: number;
  active?: boolean;
} | null;

type SquareConfig = {
  configured: boolean;
  applicationId: string | null;
  locationId: string | null;
  environment: string;
} | null;

export default function Checkout() {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const createOrder = useCreateOrder();
  const { user, isLoaded } = useUser();
  const { data: stats } = useGetOrderStats();
  const { data: settings } = useGetSettings();
  const isBusy = (stats ? (stats.pendingCount + stats.preparingCount) > 10 : false);
  const isSunday = settings?.isSunday === true;
  const isClosed = !isDevMode() && (settings?.isOpen === false || isSunday);
  const isHappyHour = !!(settings as any)?.isHappyHour;
  const happyHourDiscountType: string = (settings as any)?.happyHourDiscountType ?? "percent";
  const happyHourDiscountValue: number = Number((settings as any)?.happyHourDiscountValue ?? "50");
  const happyHourDiscount = isHappyHour
    ? happyHourDiscountType === "dollar"
      ? Math.min(happyHourDiscountValue, total)
      : Math.round(total * (happyHourDiscountValue / 100) * 100) / 100
    : 0;
  const happyHourLabel = happyHourDiscountType === "dollar"
    ? `$${happyHourDiscountValue.toFixed(2)} off`
    : `${happyHourDiscountValue}% off`;

  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountInfo>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [appliedReward, setAppliedReward] = useState<RewardInfo>(null);
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [availableRewards, setAvailableRewards] = useState<NonNullable<RewardInfo>[]>([]);
  const [celebrationReward, setCelebrationReward] = useState<RewardInfo>(null);
  const [celebrationMsg, setCelebrationMsg] = useState("");

  // Square loyalty balance shown next to phone field
  const [phoneLoyaltyBalance, setPhoneLoyaltyBalance] = useState<number | null>(null);
  const phoneLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRewardCelebration = (r: NonNullable<RewardInfo>) => {
    setAppliedReward(r);
    setCelebrationReward(r);
    setCelebrationMsg(BUDDY_MESSAGES[Math.floor(Math.random() * BUDDY_MESSAGES.length)]);
  };

  /** Normalize a raw phone string to E.164 (+1XXXXXXXXXX), or return empty string. */
  const normalizePhoneClient = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return "";
  };

  /** Debounced loyalty balance lookup triggered by phone field changes. */
  const lookupPhoneLoyalty = (rawPhone: string) => {
    if (phoneLookupTimer.current) clearTimeout(phoneLookupTimer.current);
    const normalized = normalizePhoneClient(rawPhone);
    if (!normalized) { setPhoneLoyaltyBalance(null); return; }
    phoneLookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/loyalty/account?phone=${encodeURIComponent(normalized)}`);
        if (res.ok) {
          const data = await res.json() as { found: boolean; balance: number };
          setPhoneLoyaltyBalance(data.found ? data.balance : 0);
        }
      } catch {
        // Silently ignore — balance display is non-critical
      }
    }, 600);
  };

  useEffect(() => {
    if (!user?.id) return;
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    const pointsUrl = `/api/points/${user.id}${email ? `?email=${encodeURIComponent(email)}` : ""}`;
    Promise.all([
      fetch(pointsUrl).then(r => r.ok ? r.json() : null),
      fetch("/api/rewards").then(r => r.ok ? r.json() : []),
    ]).then(([pts, rewards]) => {
      setPointsBalance(pts?.balance ?? 0);
      setAvailableRewards((Array.isArray(rewards) ? rewards : []).filter((r: NonNullable<RewardInfo>) => r?.active !== false));
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const pending = sessionStorage.getItem("pendingRewardId");
    if (!pending || !user?.id) return;
    const rewardId = parseInt(pending, 10);
    Promise.all([
      fetch(`/api/rewards`).then(r => r.ok ? r.json() : []),
      fetch(`/api/points/${user.id}`).then(r => r.ok ? r.json() : null),
    ]).then(([rewards, points]) => {
      const r = (rewards as RewardInfo[]).find((x) => x?.id === rewardId);
      const balance = points?.balance ?? 0;
      setPointsBalance(balance);
      if (r && balance >= r.pointsCost) {
        triggerRewardCelebration(r);
      }
      sessionStorage.removeItem("pendingRewardId");
    }).catch(() => sessionStorage.removeItem("pendingRewardId"));
  }, [user?.id]);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");

  const [squareConfig, setSquareConfig] = useState<SquareConfig>(null);
  const [squareReady, setSquareReady] = useState(false);
  const [squareCard, setSquareCard] = useState<SquarePaymentForm | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "later">("card");
  const [googlePayReady, setGooglePayReady] = useState(false);
  const squareContainerRef = useRef<HTMLDivElement>(null);
  const googlePayContainerRef = useRef<HTMLDivElement>(null);
  const squareInitialized = useRef(false);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const googlePayRef = useRef<SquareDigitalWallet | null>(null);

  const computedDiscountAmount = appliedDiscount
    ? appliedDiscount.discountType === "percent"
      ? Math.round(total * appliedDiscount.discountAmount) / 100
      : appliedDiscount.discountType === "free_delivery"
        ? 0
        : appliedDiscount.discountAmount
    : 0;
  const rewardDiscount = appliedReward
    ? appliedReward.discountType === "percent"
      ? Math.round(total * appliedReward.discountValue) / 100
      : appliedReward.discountType === "free_item"
        ? items.reduce((max, it) => {
            if (it.quantity <= 0) return max;
            const unit = getItemPrice(it.menuItem, it.size);
            return unit > max ? unit : max;
          }, 0)
        : appliedReward.discountValue
    : 0;
  const cappedRewardDiscount = Math.min(rewardDiscount, Math.max(0, total - computedDiscountAmount - happyHourDiscount));
  const discountedTotal = Math.max(0, total - computedDiscountAmount - cappedRewardDiscount - happyHourDiscount);

  const TAX_RATE = 0.0946;
  const taxAmount = Math.round(discountedTotal * TAX_RATE * 100) / 100;
  const grandTotal = discountedTotal + taxAmount;

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", notes: "", smsConsent: false },
  });

  useEffect(() => {
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "";
      const email = user.primaryEmailAddress?.emailAddress || "";
      const phone = user.primaryPhoneNumber?.phoneNumber || "";
      if (name) form.setValue("customerName", name);
      if (email) form.setValue("customerEmail", email);
      if (phone) { form.setValue("customerPhone", phone); lookupPhoneLoyalty(phone); }
    }
  }, [user, form]);

  // If Clerk has no phone, check our DB for a saved profile phone and pre-fill
  useEffect(() => {
    if (!user?.id || user.primaryPhoneNumber?.phoneNumber) return;
    fetch(`/api/user/profile?clerkUserId=${encodeURIComponent(user.id)}`)
      .then((r) => r.ok ? r.json() : { phone_number: null })
      .then((data: { phone_number: string | null }) => {
        if (data.phone_number && !form.getValues("customerPhone")) {
          form.setValue("customerPhone", data.phone_number);
          lookupPhoneLoyalty(data.phone_number);
        }
      })
      .catch(() => {});
  }, [user?.id, user?.primaryPhoneNumber?.phoneNumber, form]);

  useEffect(() => {
    fetch("/api/payments/config")
      .then((r) => r.ok ? r.json() : null)
      .then((cfg) => {
        setSquareConfig(cfg);
        if (!cfg || !cfg.configured) setPaymentMethod("later");
      })
      .catch(() => { setSquareConfig(null); setPaymentMethod("later"); });
  }, []);

  const initSquare = useCallback(async () => {
    if (squareInitialized.current || !squareConfig?.configured || !squareConfig.applicationId || !squareConfig.locationId) return;
    if (!squareContainerRef.current) return;

    squareInitialized.current = true;

    const loadSdk = () => new Promise<void>((resolve, reject) => {
      if (window.Square) { resolve(); return; }
      const src = squareConfig.environment === "production"
        ? "https://web.squarecdn.com/v1/square.js"
        : "https://sandbox.web.squarecdn.com/v1/square.js";
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Square SDK"));
      document.head.appendChild(script);
    });

    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Square SDK timed out")), ms))]);

    try {
      await withTimeout(loadSdk(), 12000);
      if (!window.Square) {
        squareInitialized.current = false;
        setPaymentMethod("later");
        return;
      }
      const payments = await withTimeout(
        window.Square.payments(squareConfig.applicationId, squareConfig.locationId),
        10000,
      );
      paymentsRef.current = payments;
      const card = await withTimeout(payments.card(), 10000);
      setSquareCard(card);
      setSquareReady(true);

      // Try to initialize Google Pay (may not be available in all environments)
      try {
        const paymentRequest = payments.paymentRequest({
          countryCode: "US",
          currencyCode: "USD",
          total: { amount: "0.01", label: "Total" },
        });
        const gp = await payments.googlePay(paymentRequest);
        googlePayRef.current = gp;
        setGooglePayReady(true);
      } catch {
        // Google Pay not available (sandbox, unsupported browser, etc.)
      }
    } catch (e) {
      console.error("Square init error:", e);
      squareInitialized.current = false;
      setPaymentMethod("later");
    }
  }, [squareConfig]);

  useEffect(() => {
    if (squareConfig?.configured && squareContainerRef.current && !squareInitialized.current) {
      initSquare();
    }
  }, [squareConfig, initSquare]);

  useEffect(() => {
    if (squareCard && squareContainerRef.current) {
      squareCard.attach?.("#square-card-container");
    }
  }, [squareCard]);

  useEffect(() => {
    if (googlePayReady && googlePayRef.current && googlePayContainerRef.current) {
      googlePayRef.current.attach("#google-pay-button").catch(() => {});
    }
  }, [googlePayReady]);

  const handleGooglePay = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    const data = form.getValues();
    if (!googlePayRef.current || !paymentsRef.current) return;

    setPaymentLoading(true);
    try {
      const paymentRequest = paymentsRef.current.paymentRequest({
        countryCode: "US",
        currencyCode: "USD",
        total: { amount: grandTotal.toFixed(2), label: "Sweet Street Co" },
      });
      const freshGP = await paymentsRef.current.googlePay(paymentRequest);
      const tokenResult = await freshGP.tokenize();
      if (tokenResult.status !== "OK") {
        alert("Google Pay failed. Please try a different payment method.");
        setPaymentLoading(false);
        return;
      }

      const clerkUserId = user?.id ?? undefined;
      const scheduledForIso = scheduleEnabled && scheduledFor ? new Date(scheduledFor).toISOString() : undefined;
      const gpTotalDiscount = Math.round((computedDiscountAmount + cappedRewardDiscount + happyHourDiscount) * 100) / 100;
      const orderPayload = {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        customerSmsConsent: !!data.smsConsent,
        notes: data.notes || null,
        discountCode: appliedDiscount?.code ?? null,
        discountAmount: gpTotalDiscount,
        totalAmount: grandTotal,
        clerkUserId,
        rewardId: appliedReward?.id ?? null,
        scheduledFor: scheduledForIso,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          size: i.size,
          temperature: i.temperature ?? null,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions || null,
          modifiers: (i.modifiers ?? []).map((m) => m.id),
        })),
      };

      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
        credentials: "include",
        body: JSON.stringify(orderPayload),
      });
      if (!createRes.ok) {
        const { error } = await createRes.json().catch(() => ({ error: "Order failed" }));
        alert(error || "Could not place order");
        setPaymentLoading(false);
        return;
      }
      const order = await createRes.json();

      const payRes = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
        credentials: "include",
        body: JSON.stringify({ orderId: order.id, sourceId: tokenResult.token, rewardId: appliedReward?.id ?? null }),
      });
      if (!payRes.ok) {
        const { error } = await payRes.json().catch(() => ({ error: "Payment failed" }));
        alert(error || "Payment failed");
        setPaymentLoading(false);
        return;
      }

      clearCart();
      setLocation(`/order-status/${order.id}`);
    } catch (e) {
      console.error("Google Pay error:", e);
      alert("Google Pay was cancelled or unavailable.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const applyDiscount = async () => {
    if (!discountCodeInput.trim()) return;
    setDiscountLoading(true);
    setDiscountError("");
    try {
      const res = await fetch("/api/discount-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountCodeInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setAppliedDiscount(data);
      } else {
        const { error } = await res.json();
        setDiscountError(error || "Invalid code");
        setAppliedDiscount(null);
      }
    } catch {
      setDiscountError("Failed to validate code");
    } finally {
      setDiscountLoading(false);
    }
  };

  const onSubmit = async (data: CheckoutForm) => {
    if (items.length === 0) return;

    if (isClosed) {
      return;
    }

    const clerkUserId = user?.id ?? undefined;
    const scheduledForIso = scheduleEnabled && scheduledFor ? new Date(scheduledFor).toISOString() : undefined;
    const totalDiscount = Math.round((computedDiscountAmount + cappedRewardDiscount + happyHourDiscount) * 100) / 100;
    const orderPayload = {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || null,
      customerSmsConsent: !!data.smsConsent,
      notes: data.notes || null,
      discountCode: appliedDiscount?.code ?? null,
      discountAmount: totalDiscount,
      totalAmount: grandTotal,
      clerkUserId,
      rewardId: appliedReward?.id ?? null,
      scheduledFor: scheduledForIso,
      items: items.map((i) => ({
        menuItemId: i.menuItem.id,
        size: i.size,
        temperature: i.temperature ?? null,
        quantity: i.quantity,
        specialInstructions: i.specialInstructions || null,
        modifiers: (i.modifiers ?? []).map((m) => m.id),
      })),
    };

    const stashEarned = (orderId: number, total: number, awardsNow: boolean) => {
      if (!clerkUserId || !awardsNow) return;
      const earned = Math.floor(total);
      if (earned > 0) {
        sessionStorage.setItem(
          `pointsEarned_${orderId}`,
          JSON.stringify({ earned, prevBalance: pointsBalance }),
        );
      }
    };

    // Helper: create order via API and return it
    const createOrderViaApi = async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
        credentials: "include",
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Order creation failed" }));
        throw new Error(error || "Failed to create order");
      }
      return res.json();
    };

    if (paymentMethod === "card" && discountedTotal === 0) {
      setPaymentLoading(true);
      try {
        const order = await createOrderViaApi();
        const res = await fetch("/api/payments/process", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getDevHeaders() },
          credentials: "include",
          body: JSON.stringify({ orderId: order.id, sourceId: "FREE", rewardId: appliedReward?.id ?? null }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Failed to place order" }));
          alert(error || "Failed to place order");
          return;
        }
        stashEarned(order.id, grandTotal, true);
        clearCart();
        setLocation(`/order-status/${order.id}`);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to place order");
      } finally {
        setPaymentLoading(false);
      }
      return;
    }

    if (paymentMethod === "card" && squareReady && squareCard) {
      setPaymentLoading(true);
      try {
        // Create the order first so we have an orderId for the payment
        const order = await createOrderViaApi();

        const result = await squareCard.tokenize();
        if (!result.token) {
          const errMsg = result.errors?.[0]?.message ?? "Card tokenization failed";
          alert(errMsg);
          return;
        }

        const res = await fetch("/api/payments/process", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getDevHeaders() },
          credentials: "include",
          body: JSON.stringify({ orderId: order.id, sourceId: result.token, rewardId: appliedReward?.id ?? null }),
        });

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Payment failed" }));
          alert(error || "Payment failed");
          return;
        }

        stashEarned(order.id, grandTotal, true);
        clearCart();
        setLocation(`/order-status/${order.id}`);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Payment failed. Please try again.");
      } finally {
        setPaymentLoading(false);
      }
    } else {
      createOrder.mutate(orderPayload, {
        onSuccess: (order) => {
          stashEarned(order.id, Number(order.totalAmount ?? grandTotal), false);
          clearCart();
          setLocation(`/order-status/${order.id}`);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Failed to place order. Please try again.";
          alert(msg);
        },
      });
    }
  };

  // Auto-dismiss celebration modal after 3 seconds
  useEffect(() => {
    if (!celebrationReward) return;
    const t = setTimeout(() => setCelebrationReward(null), 3000);
    return () => clearTimeout(t);
  }, [celebrationReward]);

  // When closed, don't block — prompt them to schedule instead

  if (items.length === 0) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
          <div className="bg-primary/10 p-6 rounded-full">
            <ShoppingBag className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-primary-foreground">Your cart is empty</h2>
            <p className="text-muted-foreground">Looks like you haven't added any sweet treats yet.</p>
          </div>
          <Link href="/"><Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">Browse Menu</Button></Link>
        </div>
      </CustomerLayout>
    );
  }

  const isSubmitting = paymentLoading || createOrder.isPending;

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 animate-in fade-in duration-500">

        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60 mb-0.5">Sweet Street</p>
              <h1 className="text-3xl font-serif font-bold leading-none" style={{ color: "hsl(345,45%,18%)" }}>Checkout</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">Almost there — just a few details and your order is on its way.</p>

          {isClosed && (
            <div className="flex flex-col items-center gap-4 bg-red-50 border-2 border-red-200 rounded-2xl px-6 py-8 text-center">
              <span className="text-4xl">🔒</span>
              <div>
                <p className="text-lg font-bold text-red-800">
                  {isSunday ? "We're closed on Sundays" : "We're not taking orders right now"}
                </p>
                <p className="text-sm text-red-700 mt-1">Orders are temporarily paused. Check back soon!</p>
              </div>
            </div>
          )}

          {!isClosed && isBusy && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800">
              <Clock className="h-5 w-5 flex-shrink-0 text-amber-500" />
              <p className="text-sm font-medium">We're a bit busy right now — expect your order in <strong>3–8 extra minutes</strong>. Thanks for your patience!</p>
            </div>
          )}

          <Show when="signed-out">
            <Card className="bg-pink-50 border-pink-200 shadow-sm">
              <CardContent className="pt-5 pb-5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-primary-foreground">Sign in to get your order updates by email</p>
                  <p className="text-sm text-muted-foreground mt-1">Your name and email will be pre-filled automatically.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setLocation("/sign-in")}>
                    <LogIn className="h-4 w-4 mr-1" /> Sign in
                  </Button>
                  <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setLocation("/sign-up")}>
                    Sign up
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Show>

          <Card className="bg-card border-0 shadow-md">
            <CardHeader><CardTitle className="text-xl">Your Details</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="customerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="Jane Doe" {...field} className="rounded-xl bg-white/80 border-border/40" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="customerEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="jane@example.com" {...field} className="rounded-xl bg-white/80 border-border/40" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="(801) 555-1234"
                          {...field}
                          className="rounded-xl bg-white/80 border-border/40"
                          onChange={(e) => {
                            field.onChange(e);
                            lookupPhoneLoyalty(e.target.value);
                          }}
                        />
                      </FormControl>
                      {phoneLoyaltyBalance !== null && (
                        <p className="text-xs text-blue-700 flex items-center gap-1 mt-1">
                          🧊 You have <strong>{phoneLoyaltyBalance}</strong> ice cube{phoneLoyaltyBalance !== 1 ? "s" : ""}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="smsConsent" render={({ field }) => (
                    <FormItem className="flex items-start gap-3 rounded-lg bg-pink-50/60 border border-pink-200 px-3 py-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                          className="mt-0.5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-snug">
                        <FormLabel className="text-sm font-medium text-pink-900 cursor-pointer">
                          Text me when my order is ready
                        </FormLabel>
                        <p className="text-xs text-pink-800/70">
                          I agree to receive a one-time SMS from Sweet Street at the number above when my order is ready. Message &amp; data rates may apply. Reply STOP to opt out.
                        </p>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any general instructions for the shop?" {...field} className="rounded-xl bg-white/80 border-border/40 resize-none" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Schedule for Later */}
          <Card className={`bg-card border-0 shadow-md overflow-hidden ${isClosed ? "ring-2 ring-amber-400" : ""}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-primary" /> Schedule for Later
                </CardTitle>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scheduleEnabled}
                  onClick={() => {
                    const next = !scheduleEnabled;
                    setScheduleEnabled(next);
                    if (!next) setScheduledFor("");
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${scheduleEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${scheduleEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </CardHeader>
            {scheduleEnabled && (
              <CardContent className="pt-0 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Pick a date and time for us to start making your order. We won't begin until then.
                </p>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  min={(() => {
                    const d = new Date(Date.now() + 15 * 60 * 1000);
                    d.setSeconds(0, 0);
                    return d.toISOString().slice(0, 16);
                  })()}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {scheduledFor && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    Scheduled for <strong>{new Date(scheduledFor).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong>
                  </p>
                )}
              </CardContent>
            )}
            {!scheduleEnabled && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">Toggle on to order ahead — we won't start making it until your chosen time.</p>
              </CardContent>
            )}
          </Card>

          {/* Ice Cubes Rewards - inline picker for signed-in users */}
          {user && availableRewards.length > 0 && (
            <Card className="bg-card border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2">
                  🧊 Redeem Ice Cubes
                  <span className="ml-auto text-sm font-normal text-muted-foreground">{pointsBalance + (phoneLoyaltyBalance ?? 0)} cubes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {appliedReward ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 text-lg">🧊</span>
                      <div>
                        <p className="font-medium text-blue-800">{appliedReward.name} applied!</p>
                        <p className="text-sm text-blue-600">
                          {appliedReward.discountType === "percent"
                            ? `${appliedReward.discountValue}% off`
                            : appliedReward.discountType === "free_item"
                              ? "Free highest-priced item"
                              : `$${(appliedReward.discountValue ?? 0).toFixed(2)} off`}
                          {" "}· {appliedReward.pointsCost} cubes
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAppliedReward(null)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableRewards.map(reward => {
                      const canAfford = (pointsBalance + (phoneLoyaltyBalance ?? 0)) >= reward.pointsCost;
                      return (
                        <button
                          key={reward.id}
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            if (!canAfford) return;
                            setAppliedReward(reward);
                            setCelebrationReward(reward);
                            setCelebrationMsg(BUDDY_MESSAGES[Math.floor(Math.random() * BUDDY_MESSAGES.length)]);
                          }}
                          className={`text-left rounded-xl border-2 p-3 transition-all ${
                            canAfford
                              ? "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 cursor-pointer"
                              : "border-muted bg-muted/40 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-foreground">{reward.name}</span>
                            <Badge variant="secondary" className={canAfford ? "bg-blue-100 text-blue-700" : ""}>
                              🧊 {reward.pointsCost}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {reward.discountType === "percent"
                              ? `${reward.discountValue ?? 0}% off your order`
                              : reward.discountType === "free_item"
                                ? "Free highest-priced drink"
                                : `$${(reward.discountValue ?? 0).toFixed(2)} off`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* School Discount Code */}
          <Card className="bg-card border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" /> School Discount Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appliedDiscount ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">{appliedDiscount.code} applied!</p>
                      <p className="text-sm text-green-600">
                        {appliedDiscount.schoolName} —{" "}
                        {appliedDiscount.discountType === "percent"
                          ? `${appliedDiscount.discountAmount}% off`
                          : appliedDiscount.discountType === "free_delivery"
                            ? "Free delivery"
                            : `$${appliedDiscount.discountAmount.toFixed(2)} off`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setAppliedDiscount(null); setDiscountCodeInput(""); }}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter school code (e.g. SUMMIT2025)"
                      value={discountCodeInput}
                      onChange={(e) => { setDiscountCodeInput(e.target.value.toUpperCase()); setDiscountError(""); }}
                      className="rounded-xl bg-white/80 border-border/40 font-mono uppercase"
                      onKeyDown={(e) => e.key === "Enter" && applyDiscount()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={applyDiscount}
                      disabled={discountLoading || !discountCodeInput.trim()}
                      className="shrink-0"
                    >
                      {discountLoading ? <CupSpinner size={18} /> : "Apply"}
                    </Button>
                  </div>
                  {discountError && <p className="text-sm text-destructive">{discountError}</p>}
                  <p className="text-xs text-muted-foreground">Students enter your school's code to receive a discount.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="bg-card border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {squareConfig === null ? (
                <p className="text-sm text-muted-foreground">Loading payment options...</p>
              ) : squareConfig.configured ? (
                <div className="space-y-4">
                  {/* Google Pay / digital wallet button */}
                  {googlePayReady && discountedTotal > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Digital Wallet</p>
                      <div
                        id="google-pay-button"
                        ref={googlePayContainerRef}
                        onClick={handleGooglePay}
                        className="cursor-pointer rounded-lg overflow-hidden min-h-[48px]"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-border/60" />
                        <span className="text-xs text-muted-foreground">or pay with card</span>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={paymentMethod === "card" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setPaymentMethod("card")}
                    >
                      <CreditCard className="h-4 w-4 mr-2" /> Pay by Card
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "later" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setPaymentMethod("later")}
                    >
                      Pay in Store
                    </Button>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="space-y-2">
                      <div id="square-card-container" ref={squareContainerRef} className="min-h-[100px] border border-border/50 rounded-lg p-3 bg-white" />
                      {!squareReady && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <CupSpinner size={14} /> Loading card form...
                        </p>
                      )}
                    </div>
                  )}
                  {paymentMethod === "later" && (
                    <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                      You'll pay when you pick up your order at the shop.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">Pay in Store at Pickup</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You'll pay when you come to pick up your order.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-5">
          <Card className="sticky top-24 border-0 shadow-xl overflow-hidden">
            {/* Gradient header */}
            <div className="relative px-6 py-5 bg-gradient-to-br from-[hsl(5,76%,54%)] via-[hsl(350,72%,58%)] to-[hsl(345,65%,62%)] overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_80%_15%,_rgba(255,255,255,0.65)_0%,_transparent_55%)]" />
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/60 mb-1">Your</p>
                  <h2 className="text-2xl font-serif font-bold text-white leading-none">Order</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/60 mb-0.5">{items.length} {items.length === 1 ? "item" : "items"}</p>
                  <p className="text-2xl font-bold text-white">${grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4 pt-5">
              <div className="max-h-[40vh] overflow-y-auto pr-2 space-y-4">
                {items.map((item) => {
                  const price = getItemPrice(item.menuItem, item.size);
                  return (
                    <div key={`${item.menuItem.id}-${item.size}-${item.temperature ?? "x"}`} className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{item.menuItem.name}</span>
                          <span>${(price * item.quantity).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(item.size)}
                          {item.temperature && (
                            <span className="ml-2 capitalize">• {item.temperature}</span>
                          )}
                        </p>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            + {item.modifiers.map((m) => m.name).join(", ")}
                          </p>
                        )}
                        {item.specialInstructions && (
                          <p className="text-xs text-muted-foreground italic line-clamp-2">"{item.specialInstructions}"</p>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 bg-white/50 rounded-md border border-border/50">
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={() => updateQuantity(item.menuItem.id, item.size, item.temperature, (item.modifiers ?? []).map(m => m.id), item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={() => updateQuantity(item.menuItem.id, item.size, item.temperature, (item.modifiers ?? []).map(m => m.id), item.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.menuItem.id, item.size, item.temperature, (item.modifiers ?? []).map(m => m.id))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="bg-border/60" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                {isHappyHour && (
                  <div className="flex justify-between text-orange-600 font-semibold">
                    <span className="flex items-center gap-1">🎉 Happy Hour ({happyHourLabel})</span>
                    <span>-${happyHourDiscount.toFixed(2)}</span>
                  </div>
                )}
                {appliedDiscount && (
                  <div className="flex justify-between text-green-700 font-medium">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {appliedDiscount.code}
                    </span>
                    <span>
                      {appliedDiscount.discountType === "percent"
                        ? `-${appliedDiscount.discountAmount}%`
                        : appliedDiscount.discountType === "free_delivery"
                          ? "Free delivery"
                          : `-$${appliedDiscount.discountAmount.toFixed(2)}`}
                    </span>
                  </div>
                )}
                {appliedReward && (
                  <div className="flex justify-between text-pink-700 font-medium items-start gap-2">
                    <span className="flex items-center gap-1 flex-1">
                      🎁 {appliedReward.name}
                      <button
                        type="button"
                        onClick={() => setAppliedReward(null)}
                        className="text-xs text-muted-foreground hover:text-red-600 ml-1 underline"
                      >
                        remove
                      </button>
                    </span>
                    <span>-${cappedRewardDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (9.46%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-foreground pt-2 border-t-2 border-border/60">
                  <span>Total due</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3 px-6 pb-6">
              <motion.div className="w-full" whileTap={{ scale: isSubmitting ? 1 : 0.98 }}>
                <Button
                  type="submit"
                  form="checkout-form"
                  className="w-full rounded-full py-6 text-base font-bold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-[hsl(5,76%,54%)] to-[hsl(345,65%,62%)] hover:from-[hsl(5,76%,48%)] hover:to-[hsl(345,65%,56%)] text-white border-0 disabled:opacity-60"
                  disabled={isClosed || isSubmitting || (paymentMethod === "card" && squareConfig?.configured && !squareReady)}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isSubmitting ? (
                      <motion.span
                        key="processing"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center"
                      >
                        <CupSpinner size={20} color="white" className="mr-2" /> Pouring up your order…
                      </motion.span>
                    ) : paymentMethod === "card" && squareConfig?.configured ? (
                      <motion.span
                        key="pay"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center"
                      >
                        <CreditCard className="mr-2 h-5 w-5" /> Pay ${grandTotal.toFixed(2)}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="place"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center"
                      >
                        Place Order <ArrowRight className="ml-2 h-5 w-5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
              <AnimatePresence>
                {isSubmitting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden w-full flex justify-center pt-2"
                  >
                    <BubbleCupLoader
                      size={64}
                      message="Hang tight — we're sending your order to the kitchen."
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardFooter>
          </Card>
        </div>
      </div>
      {/* Reward Celebration Modal */}
      <AnimatePresence>
        {celebrationReward && (
          <motion.div
            key="celebration-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/65"
            onClick={() => setCelebrationReward(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="bg-white rounded-3xl shadow-2xl px-8 py-10 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-4">🎉🧊✨</div>
              <h2 className="text-3xl font-extrabold text-primary mb-2">
                Congrats{user?.firstName ? `, ${user.firstName}` : ""}!
              </h2>
              <p className="text-base text-slate-700 leading-relaxed mt-2">{celebrationMsg}</p>
              <div className="mt-5 inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-2 rounded-full">
                <span>🧊</span>
                <span>{celebrationReward.name}</span>
                {celebrationReward.discountType === "percent" ? (
                  <span className="text-blue-500 font-normal">· {celebrationReward.discountValue}% off</span>
                ) : celebrationReward.discountType === "free_item" ? (
                  <span className="text-blue-500 font-normal">· free item!</span>
                ) : (
                  <span className="text-blue-500 font-normal">· saves ${(celebrationReward.discountValue ?? 0).toFixed(2)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-6 italic">Tap anywhere to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CustomerLayout>
  );
}
