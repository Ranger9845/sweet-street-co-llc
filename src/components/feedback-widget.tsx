import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X, Send, CheckCircle2, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/react";

const PRESET_ISSUES = [
  { id: "order_wrong", label: "My order was wrong" },
  { id: "payment_issue", label: "Payment problem" },
  { id: "app_broken", label: "Something isn't working" },
  { id: "order_late", label: "Order took too long" },
  { id: "missing_item", label: "Missing item" },
  { id: "other", label: "Other / general feedback" },
];

const ORDER_RELATED = new Set(["order_wrong", "order_late", "missing_item"]);

type Phase = "idle" | "open" | "sending" | "done" | "error";

interface OrderSummary {
  id: number;
  customerName: string;
  items: { name: string; quantity: number; size?: string }[];
  total: number;
  createdAt: string;
}

function formatOrderDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function FeedbackWidget() {
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.fullName || user.firstName || "");
      setEmail(user.emailAddresses?.[0]?.emailAddress || "");
    }
  }, [user]);

  useEffect(() => {
    if (selectedIssue && ORDER_RELATED.has(selectedIssue) && user) {
      setOrdersLoading(true);
      setSelectedOrderId(null);
      fetch("/api/orders?clerkUserId=1", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          setOrders(Array.isArray(data) ? data.slice(0, 8) : []);
          setOrdersLoading(false);
        })
        .catch(() => setOrdersLoading(false));
    } else {
      setOrders([]);
      setSelectedOrderId(null);
    }
  }, [selectedIssue, user]);

  const open = () => {
    setPhase("open");
    setSelectedIssue(null);
    setMessage("");
    setErrorMsg("");
    setOrders([]);
    setSelectedOrderId(null);
  };

  const close = () => {
    setPhase("idle");
    setSelectedIssue(null);
    setMessage("");
    setErrorMsg("");
    setOrders([]);
    setSelectedOrderId(null);
  };

  const submit = async () => {
    if (!selectedIssue && !message.trim()) {
      setErrorMsg("Please pick an issue or write a message.");
      return;
    }

    setPhase("sending");
    setErrorMsg("");

    const issueLabel = PRESET_ISSUES.find((i) => i.id === selectedIssue)?.label ?? selectedIssue ?? "No preset selected";
    const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

    const orderInfo = selectedOrder
      ? {
          orderId: selectedOrder.id,
          orderDate: selectedOrder.createdAt,
          orderItems: selectedOrder.items.map((i) => `${i.quantity}× ${i.name}${i.size ? ` (${i.size})` : ""}`).join(", "),
          orderTotal: `$${selectedOrder.total.toFixed(2)}`,
        }
      : null;

    const log = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}×${window.screen.height}`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || "—",
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: issueLabel,
          issueId: selectedIssue,
          message: message.trim() || null,
          name: name.trim() || null,
          email: email.trim() || null,
          clerkUserId: user?.id ?? null,
          orderInfo,
          log,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }

      setPhase("done");
      setTimeout(() => setPhase("idle"), 3200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("open");
    }
  };

  const needsOrderPicker = selectedIssue !== null && ORDER_RELATED.has(selectedIssue) && user;

  return (
    <>
      <AnimatePresence>
        {phase === "idle" && (
          <motion.button
            key="trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            onClick={open}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2.5 shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors text-sm font-medium"
            aria-label="Send feedback"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(phase === "open" || phase === "sending" || phase === "done" || phase === "error") && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={phase === "open" ? close : undefined}
            />

            <motion.div
              key="panel"
              className="fixed bottom-6 right-6 z-50 w-[min(92vw,380px)] bg-white rounded-2xl shadow-2xl border border-border overflow-hidden"
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b bg-primary/5">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary-foreground">Send Feedback</span>
                </div>
                <button
                  onClick={close}
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {phase === "done" ? (
                  <motion.div
                    key="done"
                    className="p-8 flex flex-col items-center text-center gap-3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.05 }}
                    >
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </motion.div>
                    <p className="font-semibold text-lg text-primary-foreground">Got it — thanks!</p>
                    <p className="text-sm text-muted-foreground">Your feedback was sent. We'll look into it.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Preset issue chips */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        What's going on?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_ISSUES.map((issue) => (
                          <button
                            key={issue.id}
                            onClick={() => setSelectedIssue(selectedIssue === issue.id ? null : issue.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                              selectedIssue === issue.id
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-primary-foreground"
                            }`}
                          >
                            {issue.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Order picker — shown for order-related issues */}
                    <AnimatePresence>
                      {needsOrderPicker && (
                        <motion.div
                          key="order-picker"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <ShoppingBag className="h-3 w-3" />
                              Which order was it?
                            </p>

                            {ordersLoading ? (
                              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading your orders…
                              </div>
                            ) : orders.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 italic">No recent orders found — that's OK, just describe the issue below.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {orders.map((order) => {
                                  const isSelected = selectedOrderId === order.id;
                                  const itemNames = order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
                                  return (
                                    <button
                                      key={order.id}
                                      onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                                      className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                                        isSelected
                                          ? "border-primary bg-primary/8 shadow-sm"
                                          : "border-border/60 bg-white hover:border-primary/40"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-primary-foreground">
                                          Order #{order.id}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                          {formatOrderDate(order.createdAt)}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{itemNames}</p>
                                    </button>
                                  );
                                })}
                                <button
                                  onClick={() => setSelectedOrderId(null)}
                                  className={`w-full text-left rounded-xl border-2 px-3 py-2 text-xs transition-all ${
                                    selectedOrderId === null
                                      ? "border-muted-foreground/40 bg-muted/30 text-muted-foreground"
                                      : "border-border/40 text-muted-foreground/60 hover:border-muted-foreground/30"
                                  }`}
                                >
                                  Not sure / different order
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Message */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Details (optional)
                      </p>
                      <Textarea
                        placeholder="Tell us more — anything helps!"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="resize-none text-sm"
                        disabled={phase === "sending"}
                      />
                    </div>

                    {/* Name + email (if not signed in) */}
                    {!user && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="text-sm"
                          disabled={phase === "sending"}
                        />
                        <Input
                          placeholder="Email (optional)"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="text-sm"
                          disabled={phase === "sending"}
                        />
                      </div>
                    )}

                    {errorMsg && (
                      <p className="text-xs text-destructive font-medium">{errorMsg}</p>
                    )}

                    <Button
                      className="w-full"
                      onClick={submit}
                      disabled={phase === "sending"}
                    >
                      {phase === "sending" ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Sending…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Send Feedback
                        </span>
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center leading-tight">
                      Includes your browser info & page URL so we can reproduce issues.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
