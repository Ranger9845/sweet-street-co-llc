import { CustomerLayout } from "@/components/layout/customer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@clerk/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Gift, CreditCard, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PRESET_AMOUNTS = [10, 25, 50, 100];

type GCSquarePaymentForm = {
  tokenize: () => Promise<{ token?: string; errors?: { message: string }[] }>;
  attach: (selector: string) => Promise<void>;
};
type _GCSquarePayments = { card: () => Promise<GCSquarePaymentForm> };

type SquareConfig = { configured: boolean; applicationId: string | null; locationId: string | null; environment: string } | null;

export default function GiftCardPage() {
  const { user } = useUser();

  // Amount
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Recipient
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientMessage, setRecipientMessage] = useState("");

  // Buyer
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  // Square
  const [squareConfig, setSquareConfig] = useState<SquareConfig>(null);
  const [squareReady, setSquareReady] = useState(false);
  const [squareCard, setSquareCard] = useState<GCSquarePaymentForm | null>(null);
  const squareContainerRef = useRef<HTMLDivElement>(null);
  const squareInitialized = useRef(false);

  // Flow
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ gan: string; amountCents: number } | null>(null);

  const finalAmount = useCustom ? Number(parseFloat(customAmount || "0").toFixed(2)) : selectedAmount;
  const finalAmountCents = Math.round(finalAmount * 100);

  // Pre-fill buyer info from Clerk
  useEffect(() => {
    if (user) {
      setBuyerName([user.firstName, user.lastName].filter(Boolean).join(" ") || "");
      setBuyerEmail(user.primaryEmailAddress?.emailAddress || "");
    }
  }, [user]);

  // Load Square config
  useEffect(() => {
    fetch("/api/payments/config")
      .then(r => r.ok ? r.json() : null)
      .then(cfg => setSquareConfig(cfg))
      .catch(() => {});
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
      script.onerror = reject;
      document.head.appendChild(script);
    });

    try {
      await loadSdk();
      const sq = (window as typeof window & { Square?: { payments: (a: string, b: string) => Promise<_GCSquarePayments> } }).Square;
      const payments = await sq!.payments(squareConfig.applicationId!, squareConfig.locationId!);
      const card = await payments.card() as GCSquarePaymentForm;
      await card.attach("#gc-square-card");
      setSquareCard(card);
      setSquareReady(true);
    } catch (e) {
      console.error("Square init error:", e);
    }
  }, [squareConfig]);

  useEffect(() => {
    if (squareConfig?.configured) initSquare();
  }, [squareConfig, initSquare]);

  const handleSubmit = async () => {
    setError("");

    if (!recipientEmail) { setError("Recipient email is required"); return; }
    if (!buyerEmail) { setError("Your email is required"); return; }
    if (finalAmountCents < 500) { setError("Minimum amount is $5.00"); return; }
    if (finalAmountCents > 50000) { setError("Maximum amount is $500.00"); return; }

    if (!squareCard) { setError("Card payment is not ready. Please refresh and try again."); return; }

    setLoading(true);
    try {
      const tokenResult = await squareCard.tokenize();
      if (!tokenResult.token) {
        setError(tokenResult.errors?.[0]?.message ?? "Card tokenization failed. Check your card details.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/gift-cards/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          amountCents: finalAmountCents,
          recipientName: recipientName.trim() || null,
          recipientEmail: recipientEmail.trim(),
          recipientMessage: recipientMessage.trim() || null,
          buyerName: buyerName.trim() || null,
          buyerEmail: buyerEmail.trim(),
          clerkUserId: user?.id ?? null,
        }),
      });

      const data = await res.json() as { success?: boolean; gan?: string; amountCents?: number; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Purchase failed. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess({ gan: data.gan!, amountCents: data.amountCents! });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    const formattedGan = success.gan.replace(/(.{4})/g, "$1 ").trim();
    const amount = (success.amountCents / 100).toFixed(2);
    return (
      <CustomerLayout>
        <div className="max-w-lg mx-auto text-center py-8">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Gift card sent! 🎁</h1>
            <p className="text-muted-foreground mb-8">
              We emailed the gift card to <strong>{recipientEmail}</strong>.
            </p>

            <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl p-8 mb-6">
              <p className="text-pink-800 text-xs font-bold uppercase tracking-widest mb-3">Gift Card Value</p>
              <p className="text-4xl font-extrabold text-pink-600 mb-6">${amount}</p>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Card Number</p>
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 inline-block">
                <p className="font-mono text-xl font-bold text-gray-800 tracking-wider">{formattedGan}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              This card works online and at our counter — they can read it off at Square register or enter it at checkout.
            </p>
            <Button onClick={() => { setSuccess(null); setRecipientEmail(""); setRecipientName(""); setRecipientMessage(""); }} variant="outline" className="rounded-full">
              Send another gift card
            </Button>
          </motion.div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-pink-50 border border-pink-200 text-pink-700 rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            E-Gift Card
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Send a Sweet Street gift card</h1>
          <p className="text-muted-foreground">Works online and at our counter. Delivered instantly by email.</p>
        </div>

        <div className="space-y-6">
          {/* Amount */}
          <div className="bg-white rounded-2xl border border-border/60 p-6 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" /> Choose an amount
            </h2>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRESET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => { setSelectedAmount(amt); setUseCustom(false); }}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    !useCustom && selectedAmount === amt
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-white text-foreground hover:border-primary/50"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseCustom(true)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all ${
                  useCustom ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                Custom amount
              </button>
              {useCustom && (
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                  <Input
                    type="number"
                    min="5"
                    max="500"
                    step="1"
                    placeholder="25"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    className="pl-7"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          {/* Recipient */}
          <div className="bg-white rounded-2xl border border-border/60 p-6 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4">Who's it for?</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Recipient name</label>
                <Input placeholder="Their name" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Recipient email <span className="text-destructive">*</span></label>
                <Input type="email" placeholder="their@email.com" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Personal message <span className="text-muted-foreground/60">(optional)</span></label>
                <Textarea
                  placeholder="Happy birthday! Enjoy your favorite drink 🧋"
                  value={recipientMessage}
                  onChange={e => setRecipientMessage(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Buyer info */}
          <div className="bg-white rounded-2xl border border-border/60 p-6 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4">Your info</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Your name</label>
                <Input placeholder="Your name" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Your email <span className="text-destructive">*</span></label>
                <Input type="email" placeholder="you@email.com" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl border border-border/60 p-6 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Payment
            </h2>
            <div id="gc-square-card" ref={squareContainerRef} className="min-h-[80px]" />
            {!squareReady && squareConfig?.configured && (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Loading card form…
              </div>
            )}
            {squareConfig !== null && !squareConfig.configured && (
              <p className="text-sm text-muted-foreground py-2">Card payments are not configured. Please contact us directly.</p>
            )}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-destructive font-medium bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Summary + submit */}
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-foreground">Gift card value</span>
              <span className="font-bold text-foreground">${finalAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-medium text-foreground">You pay</span>
              <span className="font-bold text-lg text-primary">${finalAmount.toFixed(2)}</span>
            </div>
            <Button
              className="w-full rounded-full text-base font-bold py-6 shadow-lg"
              onClick={handleSubmit}
              disabled={loading || !squareReady || finalAmountCents < 500}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Send ${finalAmount.toFixed(2)} gift card
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
