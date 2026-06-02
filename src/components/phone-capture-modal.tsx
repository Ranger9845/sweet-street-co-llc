import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

function normalizePhoneClient(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

const SKIP_KEY = "phone_prompt_skipped";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; balance: number; lifetimePoints: number }
  | { status: "not_found" }
  | { status: "error" };

export function PhoneCaptureModal() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [visible, setVisible] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [checkedDb, setCheckedDb] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show modal if user has no phone saved
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    if (user.primaryPhoneNumber?.phoneNumber) return;
    if (sessionStorage.getItem(SKIP_KEY)) return;

    fetch(`/api/user/profile?clerkUserId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : { phone_number: null }))
      .then((data: { phone_number: string | null }) => {
        setCheckedDb(true);
        if (!data.phone_number) setVisible(true);
      })
      .catch(() => setCheckedDb(true));
  }, [isLoaded, isSignedIn, user?.id, user?.primaryPhoneNumber?.phoneNumber]);

  // Live lookup as user types (debounced 600ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pollRef.current) clearInterval(pollRef.current);

    const normalized = normalizePhoneClient(phone);
    if (!normalized) {
      setLookup({ status: "idle" });
      return;
    }

    setLookup({ status: "loading" });

    const doLookup = async () => {
      try {
        const res = await fetch(`/api/loyalty/account?phone=${encodeURIComponent(normalized)}`);
        const data = res.ok ? await res.json() : null;
        if (data?.found) {
          setLookup({ status: "found", balance: data.balance ?? 0, lifetimePoints: data.lifetimePoints ?? 0 });
          // Poll every 12s to keep balance live
          pollRef.current = setInterval(async () => {
            try {
              const r = await fetch(`/api/loyalty/account?phone=${encodeURIComponent(normalized)}`);
              const d = r.ok ? await r.json() : null;
              if (d?.found) setLookup({ status: "found", balance: d.balance ?? 0, lifetimePoints: d.lifetimePoints ?? 0 });
            } catch {}
          }, 12000);
        } else {
          setLookup({ status: "not_found" });
        }
      } catch {
        setLookup({ status: "error" });
      }
    };

    debounceRef.current = setTimeout(doLookup, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phone]);

  const handleSkip = () => {
    sessionStorage.setItem(SKIP_KEY, "1");
    setVisible(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const normalized = normalizePhoneClient(phone);
    if (!normalized) {
      setSaveError("Please enter a valid 10-digit US phone number.");
      return;
    }
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId: user.id, phoneNumber: normalized }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError(body.error ?? "Failed to save. Try again.");
        return;
      }
      setSaved(true);
      setTimeout(() => setVisible(false), 2000);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!checkedDb && !visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="phone-capture"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-md mx-4 mb-4 bg-white rounded-2xl shadow-2xl border border-border/30 overflow-hidden">
            <AnimatePresence mode="wait">
              {saved ? (
                <motion.div
                  key="saved"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-6 py-8 text-center space-y-2"
                >
                  <div className="text-4xl">🧊✅</div>
                  <p className="font-bold text-primary-foreground text-lg">You're all set!</p>
                  <p className="text-sm text-muted-foreground">Points will sync automatically on every order.</p>
                </motion.div>
              ) : (
                <motion.div key="form" className="px-6 py-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-primary-foreground leading-snug">
                      🧊 Link your phone for Ice Cube points
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Earn 1 ice cube per $1 spent — redeemable for discounts
                    </p>
                  </div>

                  {/* Phone input */}
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder="(405) 555-1234"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setSaveError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && !saving && handleSave()}
                      className="rounded-xl flex-1"
                      disabled={saving}
                      autoFocus
                    />
                    <Button
                      onClick={handleSave}
                      disabled={saving || !phone.trim() || lookup.status === "loading"}
                      className="shrink-0 bg-primary text-primary-foreground"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>

                  {/* Live lookup result */}
                  <AnimatePresence mode="wait">
                    {lookup.status === "loading" && (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 text-sm text-muted-foreground py-1"
                      >
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Looking up your account…
                      </motion.div>
                    )}

                    {lookup.status === "found" && (
                      <motion.div
                        key="found"
                        initial={{ opacity: 0, scale: 0.95, height: 0 }}
                        animate={{ opacity: 1, scale: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gradient-to-r from-primary/10 to-secondary/20 rounded-xl px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Current balance</p>
                          <motion.p
                            key={lookup.balance}
                            initial={{ scale: 1.3, color: "#e85d04" }}
                            animate={{ scale: 1, color: "#1a1a1a" }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className="text-3xl font-bold text-primary-foreground"
                          >
                            {lookup.balance}
                          </motion.p>
                          <p className="text-xs text-muted-foreground">ice cubes</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl">🧊</span>
                          {lookup.lifetimePoints > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{lookup.lifetimePoints} lifetime</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {lookup.status === "not_found" && (
                      <motion.div
                        key="not_found"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-muted/50 rounded-xl px-4 py-3 text-sm text-muted-foreground"
                      >
                        No loyalty account found for this number — save it and you'll start earning on your next order!
                      </motion.div>
                    )}

                    {lookup.status === "error" && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-destructive"
                      >
                        Couldn't reach the loyalty service. You can still save your number.
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {saveError && (
                    <p className="text-xs text-destructive">{saveError}</p>
                  )}

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Skip for now
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
