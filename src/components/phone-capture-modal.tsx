import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Normalize a raw phone string to E.164 (+1XXXXXXXXXX), or return empty string. */
function normalizePhoneClient(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

const SKIP_KEY = "phone_prompt_skipped";

export function PhoneCaptureModal() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [visible, setVisible] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  // Track whether we've confirmed no saved phone in DB
  const [checkedDb, setCheckedDb] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    // If Clerk already has their phone number, don't prompt
    if (user.primaryPhoneNumber?.phoneNumber) return;

    // If user skipped for this session, don't prompt
    if (sessionStorage.getItem(SKIP_KEY)) return;

    // Check DB for saved phone
    fetch(`/api/user/profile?clerkUserId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : { phone_number: null }))
      .then((data: { phone_number: string | null }) => {
        setCheckedDb(true);
        if (!data.phone_number) {
          setVisible(true);
        }
      })
      .catch(() => {
        setCheckedDb(true);
        // On error, silently skip — don't block the user
      });
  }, [isLoaded, isSignedIn, user?.id, user?.primaryPhoneNumber?.phoneNumber]);

  const handleSkip = () => {
    sessionStorage.setItem(SKIP_KEY, "1");
    setVisible(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const normalized = normalizePhoneClient(phone);
    if (!normalized) {
      setError("Please enter a valid 10-digit US phone number.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId: user.id, phoneNumber: normalized }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save phone number.");
        return;
      }

      // Trigger Square loyalty lookup in the background (fire and forget)
      fetch(`/api/loyalty/account?phone=${encodeURIComponent(normalized)}`).catch(() => {});

      setSuccess(true);
      setTimeout(() => setVisible(false), 1800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Don't render until we've confirmed no DB phone and user hasn't skipped
  if (!checkedDb && !visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="phone-capture-modal"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-md mx-4 mb-4 bg-white rounded-2xl shadow-2xl border border-border/30 overflow-hidden">
            {success ? (
              <div className="px-6 py-8 text-center space-y-2">
                <div className="text-3xl">🧊✅</div>
                <p className="font-bold text-primary-foreground text-lg">Phone saved!</p>
                <p className="text-sm text-muted-foreground">Your loyalty points will sync automatically.</p>
              </div>
            ) : (
              <div className="px-6 py-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-primary-foreground leading-snug">
                    Save your phone for loyalty rewards 🧊
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your phone number to automatically earn and track Ice Cube points
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="(801) 555-1234"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && !saving && handleSave()}
                    className="rounded-xl bg-white border-border/40 flex-1"
                    disabled={saving}
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !phone.trim()}
                    className="shrink-0 bg-primary text-primary-foreground"
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
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
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
