import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Star, Clock } from "lucide-react";
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

type PointsData = {
  balance: number;
  history: { id: number; points: number; type: string; description: string | null; createdAt: string }[];
};

const API = "/api";

export default function Rewards() {
  const { user, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebratingId, setCelebratingId] = useState<number | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/rewards`).then(r => r.ok ? r.json() : []).then(setRewards).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setPointsData(null); return; }
    setLoading(true);
    fetch(`${API}/points/${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setPointsData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleUseReward = (rewardId: number) => {
    if (celebratingId !== null) return;
    setCelebratingId(rewardId);
    redirectTimerRef.current = setTimeout(() => {
      sessionStorage.setItem("pendingRewardId", String(rewardId));
      setLocation("/order");
    }, 750);
  };

  const activeRewards = rewards.filter(r => r.active);

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
                  <p className="text-4xl font-bold text-primary-foreground mt-1">{pointsData?.balance ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">ice cubes available</p>
                </div>
                <Star className="h-16 w-16 text-primary/20" />
              </CardContent>
            </Card>
          )}
        </Show>

        <Show when="signed-out">
          <Card className="bg-pink-50 border-pink-200">
            <CardContent className="pt-6 pb-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-primary-foreground">Sign in to track your ice cubes and redeem rewards</p>
                <p className="text-sm text-muted-foreground mt-1">Create an account to start earning ice cubes on every order.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => setLocation("/sign-in")}>Sign in</Button>
                <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setLocation("/sign-up")}>Sign up</Button>
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
                const canAfford = (pointsData?.balance ?? 0) >= r.pointsCost;
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
                          {canAfford ? "Use at Checkout" : `Need ${r.pointsCost - (pointsData?.balance ?? 0)} more cubes`}
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

        <Show when="signed-in">
          {pointsData && pointsData.history.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-serif font-bold text-primary-foreground">Recent Activity</h2>
              <Card>
                <CardContent className="pt-4">
                  <div className="divide-y">
                    {pointsData.history.map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center py-3">
                        <div>
                          <p className="text-sm font-medium">{entry.description || entry.type}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`font-bold text-sm ${entry.points > 0 ? "text-green-600" : "text-red-500"}`}>
                          {entry.points > 0 ? "+" : ""}{entry.points} cubes
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </Show>
      </div>
    </CustomerLayout>
  );
}
