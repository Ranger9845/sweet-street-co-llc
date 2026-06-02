import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Gift, Star, Clock, Phone } from "lucide-react";
import { CupSpinner } from "@/components/cup-spinner";
import { useState, useEffect, useRef } from "react";
import { useUser, Show } from "@clerk/react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

type Reward = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  discountType: string;
  discountValue: number;
  active: boolean;
};

type LoyaltyData = {
  found: boolean;
  balance: number;
  lifetimePoints?: number;
};

type PointsData = {
  balance: number;
  history: { id: number; points: number; type: string; description: string | null; createdAt: string }[];
};

const API = "/api";

/** Normalize a raw phone string to E.164 (+1XXXXXXXXXX), or return empty string. */
function normalizePhoneClient(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

export default function Rewards() {
  const { user, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [celebratingId, setCelebratingId] = useState<number | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved phone: Clerk primary OR saved in our DB
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(null);

  // Guest phone lookup state
  const [guestPhone, setGuestPhone] = useState("");
  const [guestLookupLoading, setGuestLookupLoading] = useState(false);
  const [guestLoyaltyData, setGuestLoyaltyData] = useState<LoyaltyData | null>(null);
  const [guestLookupDone, setGuestLookupDone] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/rewards`).then(r => r.ok ? r.json() : []).then(setRewards).catch(() => {});
  }, []);

  // Primary balance: points_ledger (Clerk-based) — covers feedback rewards + order points
  useEffect(() => {
    if (!user?.id) { setPointsData(null); return; }
    setLoading(true);
    fetch(`${API}/points/${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setPointsData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Resolve phone: prefer Clerk primary phone, fall back to saved DB phone
  useEffect(() => {
    const clerkPhone = user?.primaryPhoneNumber?.phoneNumber ?? null;
    if (clerkPhone) {
      setResolvedPhone(clerkPhone);
      return;
    }
    if (!user?.id) { setResolvedPhone(null); return; }
    fetch(`${API}/user/profile?clerkUserId=${encodeURIComponent(user.id)}`)
      .then(r => r.ok ? r.json() : { phone_number: null })
      .then((data: { phone_number: string | null }) => setResolvedPhone(data.phone_number))
      .catch(() => setResolvedPhone(null));
  }, [user?.id, user?.primaryPhoneNumber?.phoneNumber]);

  // Secondary: Square Loyalty balance by resolved phone
  useEffect(() => {
    if (!resolvedPhone) { setLoyaltyData(null); return; }
    const normalized = normalizePhoneClient(resolvedPhone);
    if (!normalized) { setLoyaltyData(null); return; }
    fetch(`${API}/loyalty/account?phone=${encodeURIComponent(normalized)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: LoyaltyData | null) => setLoyaltyData(data))
      .catch(() => setLoyaltyData(null));
  }, [resolvedPhone]);

  const handleGuestLookup = async () => {
    const normalized = normalizePhoneClient(guestPhone);
    if (!normalized) return;
    setGuestLookupLoading(true);
    setGuestLookupDone(false);
    try {
      const res = await fetch(`${API}/loyalty/account?phone=${encodeURIComponent(normalized)}`);
      const data: LoyaltyData = res.ok ? await res.json() : { found: false, balance: 0 };
      setGuestLoyaltyData(data);
    } catch {
      setGuestLoyaltyData({ found: false, balance: 0 });
    } finally {
      setGuestLookupLoading(false);
      setGuestLookupDone(true);
    }
  };

  const handleUseReward = (rewardId: number) => {
    if (celebratingId !== null) return;
    setCelebratingId(rewardId);
    redirectTimerRef.current = setTimeout(() => {
      sessionStorage.setItem("pendingRewardId", String(rewardId));
      setLocation("/order");
    }, 750);
  };

  const activeRewards = rewards.filter(r => r.active);
  // Square is the single source of truth for points balance
  const displayBalance = loyaltyData?.balance ?? 0;

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className="text-center space-y-3 py-6">
          <Gift className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-serif font-bold text-primary-foreground">Sweet Rewards</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Earn 1 ice cube for every dollar spent. Redeem your cubes for discounts and free treats!
          </p>
        </section>

        {/* Signed-in balance card */}
        <Show when="signed-in">
          {loading ? (
            <Card className="p-8 text-center">
              <div className="flex justify-center"><CupSpinner size={32} /></div>
            </Card>
          ) : (
            <Card className="bg-gradient-to-r from-primary/10 to-secondary/20 border-primary/20">
              <CardContent className="pt-6 pb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Your Ice Cube Balance</p>
                  <p className="text-4xl font-bold text-primary-foreground mt-1">{displayBalance}</p>
                  <p className="text-xs text-muted-foreground mt-1">ice cubes available</p>
                  {loyaltyData?.lifetimePoints !== undefined && loyaltyData.lifetimePoints > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{loyaltyData.lifetimePoints} lifetime cubes earned</p>
                  )}
                  {displayBalance === 0 && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Earn cubes on your next order!
                    </p>
                  )}
                </div>
                <Star className="h-16 w-16 text-primary/20" />
              </CardContent>
            </Card>
          )}
        </Show>

        {/* Guest balance lookup */}
        <Show when="signed-out">
          <Card className="bg-pink-50 border-pink-200">
            <CardContent className="pt-6 pb-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-primary-foreground">Sign in to track your ice cubes and redeem rewards</p>
                  <p className="text-sm text-muted-foreground mt-1">Create an account to start earning ice cubes on every order.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setLocation("/sign-in")}>Sign in</Button>
                  <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setLocation("/sign-up")}>Sign up</Button>
                </div>
              </div>

              {/* Phone number lookup for guests */}
              <div className="border-t border-pink-200 pt-4 space-y-3">
                <p className="text-sm font-medium text-primary-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Check your balance by phone
                </p>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="(801) 555-1234"
                    value={guestPhone}
                    onChange={(e) => { setGuestPhone(e.target.value); setGuestLookupDone(false); }}
                    className="rounded-xl bg-white/80 border-border/40"
                    onKeyDown={(e) => e.key === "Enter" && handleGuestLookup()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGuestLookup}
                    disabled={guestLookupLoading || !guestPhone.trim()}
                    className="shrink-0"
                  >
                    {guestLookupLoading ? <CupSpinner size={18} /> : "Look up"}
                  </Button>
                </div>
                {guestLookupDone && guestLoyaltyData && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${guestLoyaltyData.found ? "bg-blue-50 border border-blue-200 text-blue-800" : "bg-muted/50 border border-border text-muted-foreground"}`}>
                    {guestLoyaltyData.found ? (
                      <>
                        <span className="font-bold text-lg text-primary-foreground">{guestLoyaltyData.balance}</span>
                        <span className="ml-1">ice cubes available</span>
                        {guestLoyaltyData.lifetimePoints !== undefined && guestLoyaltyData.lifetimePoints > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">({guestLoyaltyData.lifetimePoints} lifetime)</span>
                        )}
                      </>
                    ) : (
                      "No loyalty account found for that number. Earn cubes on your next order!"
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Show>

        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-primary-foreground">Available Rewards</h2>
          {activeRewards.length === 0 ? (
            <Card className="p-8 text-center">
              <Gift className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No rewards available yet. Check back soon!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRewards.map((r) => {
                const canAfford = displayBalance >= r.pointsCost;
                return (
                  <Card key={r.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-serif">{r.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs font-bold">{r.pointsCost} cubes</Badge>
                      </div>
                      {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                    </CardHeader>
                    <CardContent className="flex-1 pb-2">
                      <Badge variant="outline" className="text-xs">
                        {r.discountType === "percent"
                          ? `${r.discountValue ?? 0}% off`
                          : r.discountType === "free_item"
                            ? "Free item"
                            : `$${(r.discountValue ?? 0).toFixed(2)} off`}
                      </Badge>
                    </CardContent>
                    <div className="p-4 pt-0 relative overflow-hidden">
                      <Show when="signed-in">
                        <Button
                          className="w-full"
                          disabled={!canAfford || celebratingId !== null}
                          onClick={() => handleUseReward(r.id)}
                        >
                          {canAfford ? "Use at Checkout" : `Need ${r.pointsCost - displayBalance} more cubes`}
                        </Button>
                      </Show>
                      <AnimatePresence>
                        {celebratingId === r.id && (
                          <motion.div
                            key={`celebrate-${r.id}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.3 }}
                            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                            className="absolute inset-0 flex items-center justify-center rounded-b-lg bg-gradient-to-r from-blue-100 to-pink-100 pointer-events-none"
                          >
                            <span className="text-2xl select-none">🎉🧊✨</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
