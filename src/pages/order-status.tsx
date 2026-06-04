import { CustomerLayout } from "@/components/layout/customer-layout";
import { useGetOrder, getGetOrderQueryKey, useGetSettings, useGetOrderStats } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  ArrowLeft, Clock, CheckCircle2, ChefHat, Bell,
  CreditCard, Banknote, ShoppingBag, Tag, MapPin, Zap,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PointsEarnedCelebration } from "@/components/points-cup";
import { CupSpinner } from "@/components/cup-spinner";
import { useUser } from "@clerk/react";
import { ReviewPromptDialog, hasBeenPrompted, markReviewPrompted } from "@/components/review-prompt-dialog";

type Reward = {
  id: number; name: string; description: string | null;
  pointsCost: number; discountType: string; discountValue: number; active: boolean;
};

function playReadyChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch {}
}

function sendBrowserNotification(customerName: string, orderId: number) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Your order is ready! 🎉", {
      body: `${customerName}, Order #${orderId} is ready for pickup at Sweet Street!`,
      icon: "/favicon.ico",
      tag: `order-${orderId}-ready`,
    });
  }
}

// Status steps
const STEPS = [
  { key: "pending",   label: "Order Received",  icon: Clock,        color: "text-amber-500",  bg: "bg-amber-100" },
  { key: "preparing", label: "Being Prepared",   icon: ChefHat,      color: "text-blue-500",   bg: "bg-blue-100"  },
  { key: "ready",     label: "Ready for Pickup", icon: CheckCircle2, color: "text-emerald-500",bg: "bg-emerald-100"},
];

function StatusTracker({ status }: { status: string }) {
  const currentIdx = STEPS.findIndex(s => s.key === status);
  const pct = currentIdx === 0 ? 5 : currentIdx === 1 ? 55 : 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute left-0 right-0 top-5 h-1 bg-slate-100 rounded-full mx-8 z-0" />
        <div
          className="absolute left-0 top-5 h-1 bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-500 rounded-full z-10 mx-8 transition-all duration-700"
          style={{ width: `calc(${pct}% - 4rem)` }}
        />
        {STEPS.map((step, idx) => {
          const done = currentIdx >= idx;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex flex-col items-center z-20 gap-2">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                  done ? `${step.bg} border-current ${step.color}` : "bg-white border-slate-200 text-slate-300"
                }`}
                animate={done && step.key === status ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                transition={{ duration: 1.5, repeat: done && step.key === status ? Infinity : 0, ease: "easeInOut" }}
              >
                <Icon className="h-5 w-5" />
              </motion.div>
              <span className={`text-xs font-medium text-center leading-tight ${done ? "text-slate-700" : "text-slate-400"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReceiptLine({ label, value, bold, green, red, muted, small }: {
  label: string; value: string; bold?: boolean; green?: boolean; red?: boolean; muted?: boolean; small?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${small ? "py-0.5" : "py-1"}`}>
      <span className={`${muted ? "text-slate-400" : "text-slate-600"} ${small ? "text-xs" : "text-sm"}`}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-slate-900" : muted ? "text-slate-400" : "text-slate-700"} ${green ? "text-emerald-600 font-semibold" : ""} ${red ? "text-red-600 font-semibold" : ""} ${small ? "text-xs" : "text-sm"}`}>{value}</span>
    </div>
  );
}

export default function OrderStatus() {
  const params = useParams();
  const orderId = parseInt(params.id || "0", 10);
  const prevStatusRef = useRef<string | null>(null);
  const { user } = useUser();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [showReview, setShowReview] = useState(false);
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: order, isLoading, isError } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId), refetchInterval: 5000 }
  });
  const { data: settings } = useGetSettings();
  const { data: queueStats } = useGetOrderStats({ query: { refetchInterval: 30000 } });

  const [celebration, setCelebration] = useState<{
    earned: number; prevBalance: number; rewards: Reward[];
  } | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const key = `pointsEarned_${orderId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    let parsed: { earned: number; prevBalance: number } | null = null;
    try { parsed = JSON.parse(raw); } catch { sessionStorage.removeItem(key); return; }
    if (!parsed || parsed.earned <= 0) { sessionStorage.removeItem(key); return; }
    sessionStorage.removeItem(key);
    fetch("/api/rewards")
      .then((r) => (r.ok ? r.json() : []))
      .then((rewards: Reward[]) => {
        setCelebration({ earned: parsed!.earned, prevBalance: parsed!.prevBalance ?? 0, rewards: rewards || [] });
      })
      .catch(() => {
        setCelebration({ earned: parsed!.earned, prevBalance: parsed!.prevBalance ?? 0, rewards: [] });
      });
    if (user?.id) {
      fetch(`/api/points/${user.id}/mark-earnings-seen`, { method: "POST" }).catch(() => {});
    }
  }, [orderId, user?.id]);

  const requestNotifPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  }, []);

  useEffect(() => {
    if (order && (order.status === "pending" || order.status === "preparing")) {
      requestNotifPermission();
    }
  }, [order?.status, requestNotifPermission]);

  useEffect(() => {
    if (!order) return;
    const prev = prevStatusRef.current;
    if (prev && prev !== "ready" && order.status === "ready") {
      playReadyChime();
      sendBrowserNotification(order.customerName ?? "", order.id);
    }
    prevStatusRef.current = order.status ?? null;
  }, [order?.status, order?.customerName, order?.id]);

  useEffect(() => {
    if (!order) return;
    if (order.status !== "ready" && order.status !== "completed") return;
    if (hasBeenPrompted(order.id)) return;
    reviewTimerRef.current = setTimeout(() => setShowReview(true), 1800);
    return () => { if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current); };
  }, [order?.id, order?.status]);

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <CupSpinner size={42} />
          <p className="text-muted-foreground">Loading your order…</p>
        </div>
      </CustomerLayout>
    );
  }

  if (isError || !order) {
    return (
      <CustomerLayout>
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">Order not found</h3>
          <p className="text-slate-500 mt-2 mb-6 text-sm">We couldn't find an order with that ID.</p>
          <Link href="/"><Button>Return to Menu</Button></Link>
        </div>
      </CustomerLayout>
    );
  }

  const isSquare = order.source === "square-online";
  const isPos = order.source === "pos";
  const isWaiting = order.status === "pending" || order.status === "preparing";
  const queueDepth = (queueStats?.pendingCount ?? 0) + (queueStats?.preparingCount ?? 0);
  const estMins = Math.max(2, Math.ceil(queueDepth * 3));
  const waitLabel = estMins <= 5 ? "~5 min" : estMins <= 10 ? "~10 min" : estMins <= 15 ? "~15 min" : "~20+ min";
  const isCompleted = order.status === "completed" || order.status === "ready";
  const statusLabel = order.status === "pending" ? "Received" : order.status === "preparing" ? "Preparing" : order.status === "ready" ? "Ready for Pickup" : order.status === "completed" ? "Completed" : "Unknown";
  const readyMessage = settings?.readyMessage?.replace("{name}", order.customerName ?? "") ?? `${order.customerName ?? ""}, your order is ready for pickup!`;

  const subtotal = (order as any).subtotalAmount ?? (Number(order.totalAmount) + Number(order.discountAmount ?? 0));
  const taxAmount = (order as any).taxAmount ?? 0;
  const discountAmount = Number(order.discountAmount ?? 0);
  const totalAmount = Number(order.totalAmount);

  return (
    <CustomerLayout>
      <motion.div
        className="max-w-lg mx-auto space-y-4"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Link href="/">
          <Button variant="ghost" size="sm" className="pl-0 text-slate-500 hover:text-slate-800">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to menu
          </Button>
        </Link>

        {/* Source badge */}
        {isSquare && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <ShoppingBag className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">Square Online Order — your payment was processed through Square</p>
          </div>
        )}

        {/* Status card */}
        <motion.div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
        >
          {/* Colored top bar */}
          <div className={`h-1.5 w-full ${order.status === "ready" ? "bg-emerald-400" : order.status === "preparing" ? "bg-blue-400" : "bg-amber-400"}`} />

          <div className="px-6 py-5">
            {/* Order header */}
            <div className="text-center mb-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Order Confirmation</p>
              <h1 className="text-3xl font-bold text-slate-800">#{order.id}</h1>
              <p className="text-sm text-slate-500 mt-1">{order.customerName}</p>
              {(order as any).scheduledFor && (
                <motion.div
                  initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1"
                >
                  🗓 Scheduled for {format(new Date((order as any).scheduledFor), "EEEE, MMM d 'at' h:mm a")}
                </motion.div>
              )}
            </div>

            {/* Status tracker */}
            {order.status !== "cancelled" && order.status !== "completed" && (
              <StatusTracker status={order.status ?? "pending"} />
            )}

            {/* Status message */}
            <motion.div
              className={`rounded-xl px-4 py-3 text-center mb-5 ${
                order.status === "ready"
                  ? "bg-emerald-50 border-2 border-emerald-200"
                  : order.status === "preparing"
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
              animate={order.status === "ready" ? { scale: [1, 1.01, 1] } : { scale: 1 }}
              transition={order.status === "ready" ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
            >
              <p className={`font-semibold text-sm ${order.status === "ready" ? "text-emerald-800 text-base" : "text-slate-700"}`}>
                {order.status === "ready" ? readyMessage
                  : order.status === "preparing" ? "Our team is making your drinks right now! 🥤"
                  : "We've got your order and will start making it soon!"}
              </p>
            </motion.div>

            {/* Notify prompt */}
            {isWaiting && (
              <motion.div
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2 mb-5"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-center gap-2 text-slate-600">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm font-semibold">We'll let you know when it's ready</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-xs text-slate-400">Keep this page open for a sound alert + email notification.</p>
                  {isWaiting && queueStats && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 shrink-0">
                      <Clock className="h-3 w-3" /> {waitLabel}
                    </span>
                  )}
                </div>
                {notifPermission === "default" && (
                  <Button variant="outline" size="sm" onClick={requestNotifPermission} className="h-8 text-xs mt-1">
                    <Bell className="h-3 w-3 mr-1" /> Enable browser alerts
                  </Button>
                )}
                {notifPermission === "denied" && (
                  <p className="text-xs text-amber-600">Notifications are blocked in your browser settings.</p>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Receipt card */}
        <motion.div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <div className="px-6 py-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Receipt</h2>

            {/* Items */}
            <div className="space-y-2 mb-4">
              {(order.items ?? []).map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">{item.quantity}×</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{item.menuItemName}</span>
                    </div>
                    {item.size && (
                      <p className="text-xs text-slate-400 ml-5">{item.size}</p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-xs text-slate-400 italic ml-5">"{item.specialInstructions}"</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 tabular-nums shrink-0">
                    ${((item.unitPrice ?? 0) * (item.quantity ?? 0)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-slate-200 pt-3 space-y-0.5">
              <ReceiptLine label="Subtotal" value={`$${subtotal.toFixed(2)}`} small />
              {discountAmount > 0 && (
                <ReceiptLine
                  label={`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`}
                  value={`-$${discountAmount.toFixed(2)}`}
                  green small
                />
              )}
              <ReceiptLine label="Sales Tax (9% – Meeker, OK)" value={`$${taxAmount.toFixed(2)}`} muted small />
              <div className="border-t border-slate-200 mt-2 pt-2">
                <ReceiptLine label="Total" value={`$${totalAmount.toFixed(2)}`} bold />
              </div>
            </div>

            {/* Payment method */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              {order.paidAt ? (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {isSquare ? <ShoppingBag className="h-4 w-4 shrink-0" /> : <CreditCard className="h-4 w-4 shrink-0" />}
                  <div>
                    <p className="text-xs font-bold">
                      {isSquare ? "Paid via Square Online" : isPos ? "Paid via POS" : "Paid by Card"}
                    </p>
                    <p className="text-[10px] text-emerald-600">Nothing to pay at pickup</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Banknote className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Pay in Store</p>
                    <p className="text-[10px] text-amber-600">Bring cash or card at pickup</p>
                  </div>
                </div>
              )}

              {/* Square Loyalty sync notice */}
              {order.paidAt && !isSquare && (order as any).customerPhone && (
                <div className="flex items-center gap-2 text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                  <Zap className="h-4 w-4 shrink-0" />
                  <p className="text-xs font-semibold">Points synced to your Square loyalty account</p>
                </div>
              )}
            </div>

            {/* Order meta */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                <span>Sweet Street Co. · Meeker, OK</span>
              </div>
              <span>{order.createdAt ? format(new Date(order.createdAt), "MMM d 'at' h:mm a") : ""}</span>
            </div>

            {(order as any).source && (
              <div className="mt-2 flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-slate-300" />
                <span className="text-[10px] text-slate-300 uppercase tracking-wider">
                  {isSquare ? "Square Online Order" : isPos ? "In-Store (POS)" : "Online Order"}
                </span>
              </div>
            )}
          </div>
        </motion.div>

      </motion.div>

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

      {order && (
        <ReviewPromptDialog
          open={showReview}
          onClose={() => setShowReview(false)}
          orderId={order.id}
          customerName={order.customerName ?? ""}
        />
      )}
    </CustomerLayout>
  );
}
